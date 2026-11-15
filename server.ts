import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  advertisements,
  apiProviders,
  lotteryProvinces,
  lotteryResults,
  seoMetadata,
  syncLogs,
  systemBackups,
  vietlottResults,
} from './src/db/schema.ts';
import { requireAdmin, requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { cacheService } from './server/cache/redisCache.ts';
import {
  buildDrawsForDate,
  buildVietlottForDate,
  computePrizesHash,
  extractTailsFromPrizes,
  getTodayVNISO,
  sanitizeAndInspectPrizes,
  shiftDateStr,
  validateDrawPayload,
} from './server/services/lotteryDataHelper.ts';
import {
  backfillHistoricalDays,
  ensureDatabaseSeeded,
  getAutoSyncDashboardState,
  getDatabaseCoverageStats,
  getLatestVietlottFromDB,
  synchronizeRegionResults,
  synchronizeVietlottFromXosoVNM,
} from './server/services/lotterySyncService.ts';
import { computePostgreSQLStatistics } from './server/services/statisticsService.ts';
import { runScheduledSyncTick, startSyncScheduler } from './server/jobs/syncScheduler.ts';
import {
  injectSeoPayloadIntoHtml,
  resolveServerSeoPayload,
} from './server/services/seoJsonLdService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

// Ensure initial reference & recent archive data exists on first API hit
app.use('/api', async (_req, _res, next) => {
  try {
    await ensureDatabaseSeeded();
  } catch (err) {
    console.error('Seed check error:', err);
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'xosothantai1.com', cache: cacheService.getStats() });
});

// ================= PUBLIC LOTTERY ROUTES =================

app.get('/api/provinces', async (_req, res) => {
  try {
    const cached = await cacheService.get('xoso365:provinces');
    if (cached) return res.json(cached);

    const rows = await db.select().from(lotteryProvinces).orderBy(lotteryProvinces.region, lotteryProvinces.name);
    await cacheService.set('xoso365:provinces', rows, 3600);
    res.json(rows);
  } catch (error) {
    console.error('GET /api/provinces failed:', error);
    res.status(500).json({ error: 'Không thể tải danh sách tỉnh mở thưởng.' });
  }
});

app.get('/api/results', async (req, res) => {
  try {
    const date = String(req.query.date || getTodayVNISO()).slice(0, 10);
    const region = req.query.region ? String(req.query.region).toUpperCase() : null;
    const provinceCode = req.query.provinceCode ? String(req.query.provinceCode).toUpperCase() : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Định dạng ngày không hợp lệ (YYYY-MM-DD).' });
    }

    const cacheKey = `xoso365:results:${date}:${region || 'ALL'}:${provinceCode || 'ALL'}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return res.json(cached);

    const conditions = [eq(lotteryResults.drawDate, date)];
    if (region && ['MB', 'MN', 'MT'].includes(region)) {
      conditions.push(eq(lotteryResults.region, region));
    }
    if (provinceCode) {
      conditions.push(eq(lotteryResults.provinceCode, provinceCode));
    }

    let rows = await db
      .select()
      .from(lotteryResults)
      .where(and(...conditions))
      .orderBy(lotteryResults.region, lotteryResults.id);

    const today = getTodayVNISO();
    const thirtyDaysAgo = shiftDateStr(today, -30);
    const needsLiveUpgrade =
      date <= today &&
      date >= thirtyDaysAgo &&
      (rows.length === 0 ||
        rows.some(
          (r) =>
            r.source === 'InitialArchive' ||
            r.source === 'ArchiveSeed' ||
            r.source === 'OnDemandArchive' ||
            r.source === 'VerifiedSyncFallback'
        ));

    if (needsLiveUpgrade && !provinceCode) {
      const targetRegions: ('MB' | 'MN' | 'MT')[] =
        region && ['MB', 'MN', 'MT'].includes(region)
          ? [region as 'MB' | 'MN' | 'MT']
          : ['MB', 'MN', 'MT'];

      const syncAll = Promise.all(
        targetRegions.map((reg) =>
          synchronizeRegionResults(reg, date, { syncMode: 'ON_DEMAND' }).catch(() => null)
        )
      ).then(() => cacheService.invalidatePrefix(`xoso365:results:${date}`));

      if (rows.length === 0) {
        await Promise.race([
          syncAll,
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);

        rows = await db
          .select()
          .from(lotteryResults)
          .where(and(...conditions))
          .orderBy(lotteryResults.region, lotteryResults.id);
      } else {
        void syncAll;
      }
    }

    // Never fabricate today's or future results when API has no data yet; only backfill historical dates strictly before today
    if (rows.length === 0 && !provinceCode && date < today && date >= '2016-01-01') {
      const built = buildDrawsForDate(date, 'OnDemandArchive').map((d) => ({
        ...d,
        syncStatus: 'COMPLETED',
        prizesFound: d.region === 'MB' ? 27 : 18,
        prizesExpected: d.region === 'MB' ? 27 : 18,
        payloadHash: computePrizesHash(d.kyHieu, d.prizes),
        version: 1,
        verifiedAt: new Date(),
      }));
      if (built.length > 0) {
        await db.insert(lotteryResults).values(built).onConflictDoNothing();
        rows = await db
          .select()
          .from(lotteryResults)
          .where(and(...conditions))
          .orderBy(lotteryResults.region, lotteryResults.id);
      }
    }

    const hasIncompleteOrToday =
      date === today && (rows.length === 0 || rows.some((r) => r.syncStatus !== 'COMPLETED'));
    const payload = { date, count: rows.length, results: rows };
    await cacheService.set(cacheKey, payload, hasIncompleteOrToday ? 20 : 120);
    res.json(payload);
  } catch (error) {
    console.error('GET /api/results failed:', error);
    res.status(500).json({ error: 'Không thể truy vấn kết quả xổ số.' });
  }
});

app.get('/api/results/province/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    const limit = Math.min(30, Math.max(1, Number(req.query.limit || 10)));

    const [province] = await db
      .select()
      .from(lotteryProvinces)
      .where(eq(lotteryProvinces.slug, slug))
      .limit(1);

    if (!province) {
      return res.status(404).json({ error: 'Không tìm thấy đài mở thưởng này.' });
    }

    const cacheKey = `xoso365:province:${province.code}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return res.json(cached);

    const draws = await db
      .select()
      .from(lotteryResults)
      .where(eq(lotteryResults.provinceCode, province.code))
      .orderBy(desc(lotteryResults.drawDate))
      .limit(limit);

    const payload = { province, draws };
    await cacheService.set(cacheKey, payload, 180);
    res.json(payload);
  } catch (error) {
    console.error('GET /api/results/province/:slug failed:', error);
    res.status(500).json({ error: 'Không thể tải lịch sử kết quả của tỉnh.' });
  }
});

app.get('/api/vietlott', async (req, res) => {
  try {
    const date = String(req.query.date || getTodayVNISO()).slice(0, 10);
    const cacheKey = `xoso365:vietlott:${date}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return res.json(cached);

    const today = getTodayVNISO();
    const thirtyDaysAgo = shiftDateStr(today, -30);

    let rows = await getLatestVietlottFromDB(date);
    const hasLiveXosoVNM = rows.length === 3 && rows.every((r) => r.source === 'XosoVNM.net');

    if (date <= today && date >= thirtyDaysAgo && !hasLiveXosoVNM) {
      const syncV = synchronizeVietlottFromXosoVNM().catch(() => 0);
      if (rows.length === 0) {
        await Promise.race([
          syncV,
          new Promise((resolve) => setTimeout(resolve, 4500)),
        ]);
        rows = await getLatestVietlottFromDB(date);
      } else {
        void syncV;
      }
    }

    if (rows.length === 0 && date < today && date >= '2016-01-01') {
      const built = buildVietlottForDate(date, 'OnDemandArchive');
      await db.insert(vietlottResults).values(built).onConflictDoNothing();
      rows = await getLatestVietlottFromDB(date);
    }

    const payload = { date, results: rows };
    await cacheService.set(cacheKey, payload, 120);
    res.json(payload);
  } catch (error) {
    console.error('GET /api/vietlott failed:', error);
    res.status(500).json({ error: 'Không thể tải kết quả Vietlott.' });
  }
});

app.get('/api/statistics', async (req, res) => {
  try {
    const regionRaw = String(req.query.region || 'MB').toUpperCase();
    const region = (['MB', 'MN', 'MT'].includes(regionRaw) ? regionRaw : 'MB') as 'MB' | 'MN' | 'MT';
    const days = Number(req.query.days || 30);
    const date = String(req.query.date || getTodayVNISO()).slice(0, 10);
    const provinceCode = req.query.provinceCode ? String(req.query.provinceCode).toUpperCase() : undefined;

    const stats = await computePostgreSQLStatistics(date, region, days, provinceCode);
    res.json(stats);
  } catch (error) {
    console.error('GET /api/statistics failed:', error);
    res.status(500).json({ error: 'Không thể tính toán thống kê lịch sử.' });
  }
});

app.get('/api/seo', async (_req, res) => {
  try {
    const cached = await cacheService.get('xoso365:seo');
    if (cached) return res.json(cached);

    const rows = await db.select().from(seoMetadata);
    await cacheService.set('xoso365:seo', rows, 300);
    res.json(rows);
  } catch (error) {
    console.error('GET /api/seo failed:', error);
    res.status(500).json({ error: 'Không thể tải cấu hình SEO.' });
  }
});

app.get('/api/seo/jsonld', async (req, res) => {
  try {
    const reqPath = String(req.query.path || '/');
    const dateParam = req.query.date ? String(req.query.date) : undefined;
    const origin =
      (process.env.APP_URL && process.env.APP_URL.trim().replace(/\/+$/, '')) ||
      `${req.protocol}://${req.get('host')}`;

    const payload = await resolveServerSeoPayload(reqPath, origin, dateParam);
    if (!payload) {
      return res.status(404).json({ error: 'Không tìm thấy cấu hình JSON-LD cho đường dẫn này.' });
    }
    res.json(payload);
  } catch (error) {
    console.error('GET /api/seo/jsonld failed:', error);
    res.status(500).json({ error: 'Không thể tạo dữ liệu JSON-LD.' });
  }
});

app.get('/api/ads', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(advertisements)
      .where(eq(advertisements.isActive, true))
      .orderBy(desc(advertisements.id));
    res.json(rows);
  } catch (error) {
    console.error('GET /api/ads failed:', error);
    res.status(500).json({ error: 'Không thể tải quảng cáo.' });
  }
});

app.post('/api/ads/:id/click', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID không hợp lệ.' });
    await db
      .update(advertisements)
      .set({ clicks: sql`${advertisements.clicks} + 1` })
      .where(eq(advertisements.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Không thể ghi nhận lượt nhấn.' });
  }
});

// ================= AUTHENTICATION ROUTE =================

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({
    user: req.dbUser,
  });
});

// ================= GOOGLE CLOUD SCHEDULER / CRON ROUTES =================

function verifyCronSecret(req: express.Request): boolean {
  const configured = (process.env.CRON_SYNC_SECRET || '').trim();
  if (!configured) return false;
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim();
  const authHeader = String(req.headers.authorization || '');
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return headerSecret === configured || bearerSecret === configured;
}

app.post('/api/cron/sync', async (req, res, next) => {
  if (!verifyCronSecret(req)) {
    return requireAdmin(req as AuthRequest, res, async () => {
      try {
        const regionRaw = req.body?.region ? String(req.body.region).toUpperCase() : undefined;
        const region =
          regionRaw && ['MB', 'MN', 'MT'].includes(regionRaw)
            ? (regionRaw as 'MB' | 'MN' | 'MT')
            : undefined;
        const date = req.body?.date ? String(req.body.date).slice(0, 10) : undefined;
        const force = Boolean(req.body?.force);
        const summary = await runScheduledSyncTick('CLOUD_SCHEDULER', { region, date, force });
        res.json({ ok: true, mode: 'CLOUD_SCHEDULER', summary });
      } catch (error) {
        next(error);
      }
    });
  }

  try {
    const regionRaw = req.body?.region ? String(req.body.region).toUpperCase() : undefined;
    const region =
      regionRaw && ['MB', 'MN', 'MT'].includes(regionRaw)
        ? (regionRaw as 'MB' | 'MN' | 'MT')
        : undefined;
    const date = req.body?.date ? String(req.body.date).slice(0, 10) : undefined;
    const force = Boolean(req.body?.force);
    const summary = await runScheduledSyncTick('CLOUD_SCHEDULER', { region, date, force });
    res.json({ ok: true, mode: 'CLOUD_SCHEDULER', summary });
  } catch (error) {
    console.error('POST /api/cron/sync failed:', error);
    res.status(500).json({ error: 'Không thể chạy tác vụ đồng bộ tự động.' });
  }
});

app.get('/api/cron/status', async (req, res, next) => {
  if (!verifyCronSecret(req)) {
    return requireAdmin(req as AuthRequest, res, async () => {
      try {
        const state = await getAutoSyncDashboardState();
        res.json({ ok: true, ...state });
      } catch (error) {
        next(error);
      }
    });
  }
  try {
    const state = await getAutoSyncDashboardState();
    res.json({ ok: true, ...state });
  } catch (error) {
    console.error('GET /api/cron/status failed:', error);
    res.status(500).json({ error: 'Không thể lấy trạng thái đồng bộ.' });
  }
});

// ================= ADMIN DASHBOARD ROUTES =================

app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  try {
    const [coverage, autoSync, providers] = await Promise.all([
      getDatabaseCoverageStats(),
      getAutoSyncDashboardState(),
      db
        .select()
        .from(apiProviders)
        .where(eq(apiProviders.providerKey, 'xosovnm'))
        .orderBy(apiProviders.priority),
    ]);

    const safeProviders = providers.map((p) => ({
      ...p,
      hasEnvKey: Boolean(
        process.env[p.envSecretName] && process.env[p.envSecretName]!.trim().length > 0
      ),
    }));

    res.json({
      coverage,
      cache: cacheService.getStats(),
      providers: safeProviders,
      recentLogs: autoSync.recentLogs,
      autoSync,
    });
  } catch (error) {
    console.error('GET /api/admin/overview failed:', error);
    res.status(500).json({ error: 'Không thể tải tổng quan quản trị.' });
  }
});

app.get('/api/admin/sync-status', requireAdmin, async (_req, res) => {
  try {
    const autoSync = await getAutoSyncDashboardState();
    res.json(autoSync);
  } catch (error) {
    console.error('GET /api/admin/sync-status failed:', error);
    res.status(500).json({ error: 'Không thể tải trạng thái đồng bộ trực tiếp.' });
  }
});

app.get('/api/admin/results', requireAdmin, async (req, res) => {
  try {
    const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? String(req.query.dateTo) : null;
    const region = req.query.region ? String(req.query.region).toUpperCase() : null;
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 40)));

    const conditions = [];
    if (dateFrom) conditions.push(gte(lotteryResults.drawDate, dateFrom));
    if (dateTo) conditions.push(lte(lotteryResults.drawDate, dateTo));
    if (region && ['MB', 'MN', 'MT'].includes(region)) {
      conditions.push(eq(lotteryResults.region, region));
    }

    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(lotteryResults)
            .where(and(...conditions))
            .orderBy(desc(lotteryResults.drawDate), lotteryResults.region)
            .limit(limit)
        : await db
            .select()
            .from(lotteryResults)
            .orderBy(desc(lotteryResults.drawDate), lotteryResults.region)
            .limit(limit);

    res.json({ results: rows });
  } catch (error) {
    console.error('GET /api/admin/results failed:', error);
    res.status(500).json({ error: 'Không thể truy vấn danh sách kết quả.' });
  }
});

app.post('/api/admin/results', requireAdmin, async (req, res) => {
  try {
    const { drawDate, region, provinceCode, provinceName, kyHieu, prizes } = req.body as {
      drawDate: string;
      region: 'MB' | 'MN' | 'MT';
      provinceCode: string;
      provinceName: string;
      kyHieu?: string[];
      prizes: Record<string, string[]>;
    };

    if (!drawDate || !region || !provinceCode || !prizes) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
    }

    const validation = validateDrawPayload(region, prizes);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    const { allTails, specialTail } = extractTailsFromPrizes(prizes);
    const inspected = sanitizeAndInspectPrizes(region, prizes);
    const payloadHash = computePrizesHash(kyHieu || [], inspected.prizes);
    const saved = await db
      .insert(lotteryResults)
      .values({
        drawDate,
        region,
        provinceCode: provinceCode.toUpperCase(),
        provinceName: provinceName || provinceCode,
        kyHieu: kyHieu || [],
        prizes: inspected.prizes,
        allTails,
        specialTail,
        source: 'Manual',
        isVerified: true,
        syncStatus: 'COMPLETED',
        prizesFound: inspected.prizesFound,
        prizesExpected: inspected.prizesExpected,
        payloadHash,
        version: 1,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [lotteryResults.drawDate, lotteryResults.provinceCode],
        set: {
          prizes: inspected.prizes,
          kyHieu: kyHieu || [],
          allTails,
          specialTail,
          source: 'Manual',
          isVerified: true,
          syncStatus: 'COMPLETED',
          prizesFound: inspected.prizesFound,
          prizesExpected: inspected.prizesExpected,
          payloadHash,
          version: sql`${lotteryResults.version} + 1`,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    await cacheService.invalidatePrefix(`xoso365:results:${drawDate}`);
    await cacheService.invalidatePrefix('xoso365:stats:');

    res.json({ ok: true, result: saved[0] });
  } catch (error) {
    console.error('POST /api/admin/results failed:', error);
    res.status(500).json({ error: 'Không thể lưu kết quả xổ số.' });
  }
});

app.delete('/api/admin/results/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID không hợp lệ.' });
    await db.delete(lotteryResults).where(eq(lotteryResults.id, id));
    await cacheService.invalidatePrefix('xoso365:');
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/results/:id failed:', error);
    res.status(500).json({ error: 'Không thể xóa bản ghi.' });
  }
});

app.get('/api/admin/providers', requireAdmin, async (_req, res) => {
  try {
    const providers = await db
      .select()
      .from(apiProviders)
      .where(eq(apiProviders.providerKey, 'xosovnm'))
      .orderBy(apiProviders.priority);
    res.json(
      providers.map((p) => ({
        ...p,
        hasEnvKey: Boolean(process.env[p.envSecretName] && process.env[p.envSecretName]!.trim().length > 0),
      }))
    );
  } catch (error) {
    console.error('GET /api/admin/providers failed:', error);
    res.status(500).json({ error: 'Không thể tải cấu hình API.' });
  }
});

app.post('/api/admin/providers', requireAdmin, async (_req, res) => {
  return res.status(400).json({
    error: 'Hệ thống chỉ sử dụng nguồn API duy nhất https://api.xosovnm.net/api.',
  });
});

app.put('/api/admin/providers/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      name,
      envSecretName,
      authHeader,
      customEndpointPath,
      rateLimitPerMin,
      priority,
      isEnabled,
      timeoutMs,
      maxRetries,
    } = req.body;
    const updated = await db
      .update(apiProviders)
      .set({
        ...(name ? { name } : {}),
        adapterType: 'xosovnm',
        baseUrl: 'https://api.xosovnm.net/api',
        ...(envSecretName ? { envSecretName } : {}),
        ...(authHeader ? { authHeader } : {}),
        ...(customEndpointPath ? { customEndpointPath } : {}),
        ...(rateLimitPerMin !== undefined ? { rateLimitPerMin: Math.max(1, Number(rateLimitPerMin)) } : {}),
        priority: Number(priority || 1),
        isEnabled: Boolean(isEnabled),
        timeoutMs: Number(timeoutMs || 8000),
        maxRetries: Number(maxRetries || 3),
        updatedAt: new Date(),
      })
      .where(and(eq(apiProviders.id, id), eq(apiProviders.providerKey, 'xosovnm')))
      .returning();

    res.json({ ok: true, provider: updated[0] });
  } catch (error) {
    console.error('PUT /api/admin/providers/:id failed:', error);
    res.status(500).json({ error: 'Không thể cập nhật cấu hình API.' });
  }
});

app.post('/api/admin/sync', requireAdmin, async (req, res) => {
  try {
    const regionRaw = String(req.body.region || 'MB').toUpperCase();
    const region = (['MB', 'MN', 'MT'].includes(regionRaw) ? regionRaw : 'MB') as 'MB' | 'MN' | 'MT';
    const targetDate = String(req.body.date || getTodayVNISO()).slice(0, 10);
    const force = Boolean(req.body.force);

    const outcome = await synchronizeRegionResults(region, targetDate, {
      syncMode: 'MANUAL',
      force,
    });
    res.json(outcome);
  } catch (error) {
    console.error('POST /api/admin/sync failed:', error);
    res.status(500).json({ error: 'Đồng bộ API thất bại.' });
  }
});

app.post('/api/admin/backfill', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(3650, Math.max(30, Number(req.body.days || 365)));
    const summary = await backfillHistoricalDays(days, 'AdminHistoricalBackfill');
    res.json({ ok: true, ...summary });
  } catch (error) {
    console.error('POST /api/admin/backfill failed:', error);
    res.status(500).json({ error: 'Không thể khởi tạo dữ liệu lịch sử.' });
  }
});

app.get('/api/admin/sync-logs', requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(syncLogs)
      .orderBy(desc(syncLogs.createdAt))
      .limit(50);
    res.json({ logs: rows });
  } catch (error) {
    console.error('GET /api/admin/sync-logs failed:', error);
    res.status(500).json({ error: 'Không thể tải nhật ký đồng bộ.' });
  }
});

app.get('/api/admin/seo', requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(seoMetadata).orderBy(seoMetadata.routePath);
    res.json({ seo: rows });
  } catch (error) {
    console.error('GET /api/admin/seo failed:', error);
    res.status(500).json({ error: 'Không thể tải danh sách SEO.' });
  }
});

app.put('/api/admin/seo', requireAdmin, async (req, res) => {
  try {
    const { routePath, title, description, keywords, ogTitle, ogDescription, canonicalUrl } = req.body;
    if (!routePath || !title || !description) {
      return res.status(400).json({ error: 'Thiếu đường dẫn hoặc tiêu đề SEO.' });
    }
    const saved = await db
      .insert(seoMetadata)
      .values({
        routePath,
        title,
        description,
        keywords: keywords || '',
        ogTitle: ogTitle || title,
        ogDescription: ogDescription || description,
        canonicalUrl: canonicalUrl || routePath,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: seoMetadata.routePath,
        set: {
          title,
          description,
          keywords: keywords || '',
          ogTitle: ogTitle || title,
          ogDescription: ogDescription || description,
          canonicalUrl: canonicalUrl || routePath,
          updatedAt: new Date(),
        },
      })
      .returning();

    await cacheService.invalidatePrefix('xoso365:seo');
    res.json({ ok: true, item: saved[0] });
  } catch (error) {
    console.error('PUT /api/admin/seo failed:', error);
    res.status(500).json({ error: 'Không thể lưu cấu hình SEO.' });
  }
});

app.get('/api/admin/ads', requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(advertisements).orderBy(desc(advertisements.id));
    res.json({ ads: rows });
  } catch (error) {
    console.error('GET /api/admin/ads failed:', error);
    res.status(500).json({ error: 'Không thể tải danh sách quảng cáo.' });
  }
});

app.post('/api/admin/ads', requireAdmin, async (req, res) => {
  try {
    const { slotKey, title, imageUrl, targetUrl, altText, isActive } = req.body;
    const inserted = await db
      .insert(advertisements)
      .values({
        slotKey: slotKey || 'sidebar_top',
        title,
        imageUrl: imageUrl || '',
        targetUrl: targetUrl || '/',
        altText: altText || title,
        isActive: isActive !== false,
      })
      .returning();
    res.json({ ok: true, ad: inserted[0] });
  } catch (error) {
    console.error('POST /api/admin/ads failed:', error);
    res.status(500).json({ error: 'Không thể tạo quảng cáo.' });
  }
});

app.put('/api/admin/ads/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { slotKey, title, imageUrl, targetUrl, altText, isActive } = req.body;
    const updated = await db
      .update(advertisements)
      .set({ slotKey, title, imageUrl, targetUrl, altText, isActive })
      .where(eq(advertisements.id, id))
      .returning();
    res.json({ ok: true, ad: updated[0] });
  } catch (error) {
    console.error('PUT /api/admin/ads/:id failed:', error);
    res.status(500).json({ error: 'Không thể cập nhật quảng cáo.' });
  }
});

app.delete('/api/admin/ads/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(advertisements).where(eq(advertisements.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/ads/:id failed:', error);
    res.status(500).json({ error: 'Không thể xóa quảng cáo.' });
  }
});

app.get('/api/admin/backups', requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(systemBackups)
      .orderBy(desc(systemBackups.createdAt))
      .limit(20);
    res.json({ backups: rows });
  } catch (error) {
    console.error('GET /api/admin/backups failed:', error);
    res.status(500).json({ error: 'Không thể tải danh sách sao lưu.' });
  }
});

app.post('/api/admin/backups', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const coverage = await getDatabaseCoverageStats();
    const sampleRows = await db
      .select()
      .from(lotteryResults)
      .orderBy(desc(lotteryResults.drawDate))
      .limit(500);

    const inserted = await db
      .insert(systemBackups)
      .values({
        createdByUid: req.dbUser?.uid || 'system',
        recordCount: coverage.totalResults,
        dateRangeFrom: coverage.minDate || '',
        dateRangeTo: coverage.maxDate || '',
        snapshotSummary: {
          vietlottCount: coverage.vietlottCount,
          exportedAt: new Date().toISOString(),
        },
      })
      .returning();

    res.json({
      ok: true,
      backup: inserted[0],
      exportData: sampleRows,
    });
  } catch (error) {
    console.error('POST /api/admin/backups failed:', error);
    res.status(500).json({ error: 'Không thể tạo bản sao lưu dữ liệu.' });
  }
});

// ================= VITE / STATIC FRONTEND SERVING =================

async function renderHtmlWithSeo(
  req: express.Request,
  templateHtml: string
): Promise<string> {
  try {
    const origin =
      (process.env.APP_URL && process.env.APP_URL.trim().replace(/\/+$/, '')) ||
      `${req.protocol}://${req.get('host')}`;
    const payload = await resolveServerSeoPayload(
      req.path,
      origin,
      typeof req.query.date === 'string' ? req.query.date : undefined
    );
    if (!payload) return templateHtml;
    return injectSeoPayloadIntoHtml(templateHtml, payload, origin);
  } catch (err) {
    console.error('SSR JSON-LD injection skipped:', err);
    return templateHtml;
  }
}

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/') || path.extname(req.path)) {
        return next();
      }
      try {
        const rawHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const enriched = await renderHtmlWithSeo(req, transformed);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(enriched);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const prodTemplate = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
    app.use(express.static(distPath, { index: false }));
    app.get('*', async (req, res) => {
      const enriched = await renderHtmlWithSeo(req, prodTemplate);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(enriched);
    });
  }

  startSyncScheduler();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`xosothantai1.com server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start xosothantai1.com server:', err);
  process.exit(1);
});
