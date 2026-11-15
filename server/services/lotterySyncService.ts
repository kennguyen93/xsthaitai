import os from 'os';
import { and, count, desc, eq, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  advertisements,
  apiProviders,
  lotteryProvinces,
  lotteryResults,
  seoMetadata,
  syncLogs,
  syncSessions,
  vietlottResults,
} from '../../src/db/schema.ts';
import { cacheService } from '../cache/redisCache.ts';
import {
  buildDrawsForDate,
  buildVietlottForDate,
  computePrizesHash,
  extractTailsFromPrizes,
  getAllServerProvinces,
  getDayOfWeekUTC,
  getTodayVNISO,
  getVNTimeNow,
  mergeIncrementalPrizes,
  REGION_DRAW_WINDOWS,
  REGION_WINDOW_MAP,
  sanitizeAndInspectPrizes,
  shiftDateStr,
  XSMB_SCHEDULE_MAP,
  XSMN_SCHEDULE_MAP,
  XSMT_SCHEDULE_MAP,
} from './lotteryDataHelper.ts';
import {
  fetchRegionDrawsFromProvider,
  getRateLimiterSnapshot,
  resolveBackendApiAuth,
} from './externalProviderClient.ts';
import { ExternalApiError, fetchXosoVNMVietlott, vnDateToISO } from './xosovnmClient.ts';

export type SyncMode = 'AUTO_SCHEDULER' | 'CLOUD_SCHEDULER' | 'MANUAL' | 'ON_DEMAND';

export interface SyncRegionOptions {
  syncMode?: SyncMode;
  force?: boolean;
}

export interface SyncRegionResult {
  status:
    | 'SUCCESS'
    | 'PARTIAL_UPDATED'
    | 'VERIFIED_COMPLETED'
    | 'SKIPPED_DUPLICATE'
    | 'NO_DATA_YET'
    | 'LOCKED_SKIPPED'
    | 'ALREADY_COMPLETED'
    | 'FAILED';
  providerUsed: string;
  recordsSynced: number;
  skippedDuplicates: number;
  provincesCompleted: number;
  provincesExpected: number;
  prizesFound: number;
  prizesExpected: number;
  attempts: number;
  message: string;
}

const INSTANCE_ID = `${os.hostname()}-${process.pid}`;
const inFlightSyncLocks = new Set<string>();

let seedPromise: Promise<void> | null = null;

export async function ensureDatabaseSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const [{ value: provCount }] = await db
        .select({ value: count() })
        .from(lotteryProvinces);
      if (Number(provCount) === 0) {
        const provs = getAllServerProvinces();
        await db.insert(lotteryProvinces).values(provs).onConflictDoNothing();
      }

      // Enforce https://api.xosovnm.net/api as the sole external API provider
      await db.delete(apiProviders).where(ne(apiProviders.providerKey, 'xosovnm'));
      await db
        .insert(apiProviders)
        .values([
          {
            providerKey: 'xosovnm',
            name: 'XosoVNM.net Public API',
            adapterType: 'xosovnm',
            baseUrl: 'https://api.xosovnm.net/api',
            priority: 1,
            isEnabled: true,
            envSecretName: process.env.XOSOVNM_API_KEY
              ? 'XOSOVNM_API_KEY'
              : 'PUBLIC_NO_KEY_REQUIRED',
            authHeader: process.env.XOSOVNM_API_KEY ? 'x-api-key' : 'none',
            customEndpointPath: '/lottery/region',
            rateLimitPerMin: 30,
            timeoutMs: 8000,
            maxRetries: 3,
            lastStatus: 'READY',
          },
        ])
        .onConflictDoUpdate({
          target: apiProviders.providerKey,
          set: {
            adapterType: 'xosovnm',
            baseUrl: 'https://api.xosovnm.net/api',
            updatedAt: new Date(),
          },
        });

      const [{ value: seoCount }] = await db
        .select({ value: count() })
        .from(seoMetadata);
      if (Number(seoCount) === 0) {
        await db
          .insert(seoMetadata)
          .values([
            {
              routePath: '/',
              title:
                'xosothantai1.com - Kết Quả Xổ Số 3 Miền Bắc Trung Nam & Vietlott Nhanh Nhất',
              description:
                'Xem trực tiếp kết quả xổ số Miền Bắc (XSMB), Miền Nam (XSMN), Miền Trung (XSMT), Vietlott và thống kê Lô Gan 10 năm chính xác trên xosothantai1.com.',
              keywords:
                'xosothantai1.com, ket qua xo so, xsmb, xsmn, xsmt, vietlott, lo gan',
              ogTitle: 'xosothantai1.com - Trực Tiếp Kết Quả Xổ Số 3 Miền & Vietlott',
              ogDescription:
                'Tra cứu KQXS 3 miền, thống kê tần suất 00-99, lô gan, đầu đuôi giải đặc biệt 10 năm.',
              canonicalUrl: '/',
            },
            {
              routePath: '/xsmb',
              title: 'XSMB - Kết Quả Xổ Số Miền Bắc Hôm Nay | xosothantai1.com',
              description:
                'Bảng kết quả XSMB trực tiếp lúc 18:15 hàng ngày, đầy đủ bảng lô tô đầu đuôi.',
              keywords: 'xsmb, xo so mien bac, kqxs mien bac',
              ogTitle: 'XSMB - Kết Quả Xổ Số Miền Bắc | xosothantai1.com',
              ogDescription: 'Trực tiếp XSMB nhanh chóng và chính xác nhất.',
              canonicalUrl: '/xsmb',
            },
            {
              routePath: '/xsmn',
              title: 'XSMN - Kết Quả Xổ Số Miền Nam Hôm Nay | xosothantai1.com',
              description:
                'Trực tiếp kết quả XSMN lúc 16:15 hàng ngày đầy đủ các đài mở thưởng.',
              keywords: 'xsmn, xo so mien nam, kqxs mien nam',
              ogTitle: 'XSMN - Kết Quả Xổ Số Miền Nam | xosothantai1.com',
              ogDescription: 'Xem KQXS Miền Nam 16h15 hôm nay và lịch sử 10 năm.',
              canonicalUrl: '/xsmn',
            },
            {
              routePath: '/xsmt',
              title: 'XSMT - Kết Quả Xổ Số Miền Trung Hôm Nay | xosothantai1.com',
              description:
                'Trực tiếp kết quả XSMT lúc 17:15 hàng ngày và bảng lô tô đầu đuôi.',
              keywords: 'xsmt, xo so mien trung, kqxs mien trung',
              ogTitle: 'XSMT - Kết Quả Xổ Số Miền Trung | xosothantai1.com',
              ogDescription: 'Xem KQXS Miền Trung 17h15 hôm nay và thống kê chi tiết.',
              canonicalUrl: '/xsmt',
            },
            {
              routePath: '/vietlott',
              title: 'Kết Quả Vietlott Power 6/55, Mega 6/45, Max 3D | xosothantai1.com',
              description:
                'Cập nhật kết quả xổ số tự chọn Vietlott nhanh nhất và giá trị Jackpot mới nhất.',
              keywords: 'vietlott, power 6/55, mega 6/45, max 3d',
              ogTitle: 'Vietlott Hôm Nay | xosothantai1.com',
              ogDescription: 'Tra cứu kết quả Vietlott Power 6/55, Mega 6/45 và Max 3D.',
              canonicalUrl: '/vietlott',
            },
            {
              routePath: '/thong-ke',
              title:
                'Thống Kê Lô Gan, Tần Suất 00-99 & Giải Đặc Biệt 10 Năm | xosothantai1.com',
              description:
                'Phân tích tần suất 00-99, lô gan cực đại, đầu đuôi và biểu đồ lịch sử 7 ngày đến 10 năm.',
              keywords: 'thong ke lo gan, tan suat loto, giai dac biet',
              ogTitle: 'Thống Kê Xổ Số 10 Năm | xosothantai1.com',
              ogDescription: 'Biểu đồ lịch sử, tần suất 00-99 và lô gan dài nhất.',
              canonicalUrl: '/thong-ke',
            },
          ])
          .onConflictDoNothing();
      }

      const [{ value: adCount }] = await db
        .select({ value: count() })
        .from(advertisements);
      if (Number(adCount) === 0) {
        await db
          .insert(advertisements)
          .values([
            {
              slotKey: 'sidebar_top',
              title: 'Dò Vé Số xosothantai1.com Siêu Tốc',
              imageUrl: '',
              targetUrl: '/do-ve-so',
              altText: 'Công cụ dò vé số kiến thiết 3 miền chính xác',
              isActive: true,
            },
          ])
          .onConflictDoNothing();
      }

      // Seed historical archive only for dates strictly before today (never fabricate today's draw)
      const [{ value: resCount }] = await db
        .select({ value: count() })
        .from(lotteryResults);
      if (Number(resCount) === 0) {
        await backfillHistoricalDays(120, 'InitialArchive', true);
      }
    } catch (error) {
      console.error('Failed during ensureDatabaseSeeded:', error);
      seedPromise = null;
      throw error;
    }
  })();

  return seedPromise;
}

export async function backfillHistoricalDays(
  days: number,
  source = 'HistoricalBackfill',
  excludeToday = true
): Promise<{ daysProcessed: number; resultsInserted: number; vietlottInserted: number }> {
  const today = getTodayVNISO();
  const clampedDays = Math.max(1, Math.min(3650, days));
  let resultsInserted = 0;
  let vietlottInserted = 0;

  const startOffset = excludeToday ? 1 : 0;
  const chunkSize = 30;
  for (let start = startOffset; start < clampedDays + startOffset; start += chunkSize) {
    const end = Math.min(clampedDays + startOffset, start + chunkSize);
    const drawBatch = [];
    const vietlottBatch = [];

    for (let offset = start; offset < end; offset++) {
      const dateStr = shiftDateStr(today, -offset);
      const builtDraws = buildDrawsForDate(dateStr, source).map((d) => ({
        ...d,
        syncStatus: 'COMPLETED',
        prizesFound: d.region === 'MB' ? 27 : 18,
        prizesExpected: d.region === 'MB' ? 27 : 18,
        payloadHash: computePrizesHash(d.kyHieu, d.prizes),
        version: 1,
        verifiedAt: new Date(),
      }));
      drawBatch.push(...builtDraws);
      vietlottBatch.push(...buildVietlottForDate(dateStr, source));
    }

    if (drawBatch.length > 0) {
      const inserted = await db
        .insert(lotteryResults)
        .values(drawBatch)
        .onConflictDoNothing()
        .returning({ id: lotteryResults.id });
      resultsInserted += inserted.length;
    }

    if (vietlottBatch.length > 0) {
      const insertedV = await db
        .insert(vietlottResults)
        .values(vietlottBatch)
        .onConflictDoNothing()
        .returning({ id: vietlottResults.id });
      vietlottInserted += insertedV.length;
    }
  }

  await cacheService.invalidatePrefix('xoso365:');
  return { daysProcessed: clampedDays, resultsInserted, vietlottInserted };
}

export function getScheduledProvincesForRegionDate(
  region: 'MB' | 'MN' | 'MT',
  dateStr: string
): { code: string; name: string; slug: string }[] {
  const dow = getDayOfWeekUTC(dateStr);
  if (region === 'MB') {
    const p = XSMB_SCHEDULE_MAP[dow];
    return p ? [p] : [];
  }
  if (region === 'MN') return XSMN_SCHEDULE_MAP[dow] || [];
  return XSMT_SCHEDULE_MAP[dow] || [];
}

export async function ensureTodaySyncSessions(dateStr = getTodayVNISO()) {
  const createdOrExisting = [];
  for (const win of REGION_DRAW_WINDOWS) {
    const expectedProvs = getScheduledProvincesForRegionDate(win.region, dateStr);
    await db
      .insert(syncSessions)
      .values({
        drawDate: dateStr,
        region: win.region,
        status: 'PENDING',
        scheduledStart: win.scheduledStart,
        drawStart: win.drawStart,
        scheduledEnd: win.scheduledEnd,
        provincesExpected: expectedProvs.length,
        provincesCompleted: 0,
      })
      .onConflictDoNothing();

    const [row] = await db
      .select()
      .from(syncSessions)
      .where(
        and(eq(syncSessions.drawDate, dateStr), eq(syncSessions.region, win.region))
      )
      .limit(1);
    if (row) createdOrExisting.push(row);
  }
  return createdOrExisting;
}

async function tryAcquireRegionLock(
  region: 'MB' | 'MN' | 'MT',
  targetDate: string
): Promise<boolean> {
  const lockKey = `${region}:${targetDate}`;
  if (inFlightSyncLocks.has(lockKey)) {
    return false;
  }
  inFlightSyncLocks.add(lockKey);

  try {
    const win = REGION_WINDOW_MAP[region];
    const expectedProvs = getScheduledProvincesForRegionDate(region, targetDate);

    await db
      .insert(syncSessions)
      .values({
        drawDate: targetDate,
        region,
        status: 'PENDING',
        scheduledStart: win.scheduledStart,
        drawStart: win.drawStart,
        scheduledEnd: win.scheduledEnd,
        provincesExpected: expectedProvs.length,
        provincesCompleted: 0,
      })
      .onConflictDoNothing();

    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 45_000);

    const acquired = await db
      .update(syncSessions)
      .set({
        lockedBy: INSTANCE_ID,
        lockedUntil: leaseUntil,
        updatedAt: now,
      })
      .where(
        and(
          eq(syncSessions.drawDate, targetDate),
          eq(syncSessions.region, region),
          sql`(${syncSessions.lockedUntil} IS NULL OR ${syncSessions.lockedUntil} < NOW() OR ${syncSessions.lockedBy} = ${INSTANCE_ID})`
        )
      )
      .returning({ id: syncSessions.id });

    if (acquired.length === 0) {
      inFlightSyncLocks.delete(lockKey);
      return false;
    }
    return true;
  } catch (err) {
    inFlightSyncLocks.delete(lockKey);
    throw err;
  }
}

async function releaseRegionLock(region: 'MB' | 'MN' | 'MT', targetDate: string) {
  const lockKey = `${region}:${targetDate}`;
  try {
    await db
      .update(syncSessions)
      .set({
        lockedBy: '',
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(syncSessions.drawDate, targetDate),
          eq(syncSessions.region, region),
          eq(syncSessions.lockedBy, INSTANCE_ID)
        )
      );
  } finally {
    inFlightSyncLocks.delete(lockKey);
  }
}

export async function synchronizeVietlottFromXosoVNM(): Promise<number> {
  try {
    const [xosovnmProv] = await db
      .select()
      .from(apiProviders)
      .where(eq(apiProviders.providerKey, 'xosovnm'))
      .limit(1);

    const baseUrl = 'https://api.xosovnm.net/api';
    const auth = xosovnmProv ? resolveBackendApiAuth(xosovnmProv) : undefined;
    const data = await fetchXosoVNMVietlott(baseUrl, xosovnmProv?.timeoutMs || 8000, auth);
    let synced = 0;

    for (const item of data.mega) {
      const drawDate = vnDateToISO(item.date);
      const nums = (item.data.numbers || []).map(Number).filter((n) => !Number.isNaN(n));
      if (nums.length === 6) {
        await db
          .insert(vietlottResults)
          .values({
            gameType: 'MEGA_645',
            period: item.date,
            drawDate,
            numbers: nums,
            bonusNumber: null,
            jackpot1Value: item.data.jackpot || '',
            jackpot2Value: '',
            prizeBreakdown: {
              winnersJackpot: item.data.prizes?.[0]?.count || 0,
              winnersFirst: item.data.prizes?.[1]?.count || 0,
              winnersSecond: item.data.prizes?.[2]?.count || 0,
              winnersThird: item.data.prizes?.[3]?.count || 0,
            },
            source: 'XosoVNM.net',
          })
          .onConflictDoUpdate({
            target: [vietlottResults.gameType, vietlottResults.drawDate],
            set: {
              numbers: nums,
              jackpot1Value: item.data.jackpot || '',
              prizeBreakdown: {
                winnersJackpot: item.data.prizes?.[0]?.count || 0,
                winnersFirst: item.data.prizes?.[1]?.count || 0,
                winnersSecond: item.data.prizes?.[2]?.count || 0,
                winnersThird: item.data.prizes?.[3]?.count || 0,
              },
              source: 'XosoVNM.net',
            },
          });
        synced++;
      }
    }

    for (const item of data.power) {
      const drawDate = vnDateToISO(item.date);
      const allNums = (item.data.numbers || []).map(Number).filter((n) => !Number.isNaN(n));
      if (allNums.length >= 6) {
        const mainNums = allNums.slice(0, 6);
        const bonus = allNums.length >= 7 ? allNums[6] : null;
        await db
          .insert(vietlottResults)
          .values({
            gameType: 'POWER_655',
            period: item.date,
            drawDate,
            numbers: mainNums,
            bonusNumber: bonus,
            jackpot1Value: item.data.jackpot || '',
            jackpot2Value: item.data.jackpot2 || '',
            prizeBreakdown: {
              winnersJp1: item.data.prizes?.[0]?.count || 0,
              winnersJp2: item.data.prizes?.[1]?.count || 0,
            },
            source: 'XosoVNM.net',
          })
          .onConflictDoUpdate({
            target: [vietlottResults.gameType, vietlottResults.drawDate],
            set: {
              numbers: mainNums,
              bonusNumber: bonus,
              jackpot1Value: item.data.jackpot || '',
              jackpot2Value: item.data.jackpot2 || '',
              prizeBreakdown: {
                winnersJp1: item.data.prizes?.[0]?.count || 0,
                winnersJp2: item.data.prizes?.[1]?.count || 0,
              },
              source: 'XosoVNM.net',
            },
          });
        synced++;
      }
    }

    for (const item of data.max3d) {
      const drawDate = vnDateToISO(item.date);
      const nums = item.data.numbers || [];
      if (nums.length >= 20) {
        await db
          .insert(vietlottResults)
          .values({
            gameType: 'MAX_3D',
            period: item.date,
            drawDate,
            numbers: [],
            bonusNumber: null,
            jackpot1Value: '1.000.000.000đ',
            jackpot2Value: '',
            prizeBreakdown: {
              special: nums.slice(0, 2),
              first: nums.slice(2, 6),
              second: nums.slice(6, 12),
              third: nums.slice(12, 20),
            },
            source: 'XosoVNM.net',
          })
          .onConflictDoUpdate({
            target: [vietlottResults.gameType, vietlottResults.drawDate],
            set: {
              prizeBreakdown: {
                special: nums.slice(0, 2),
                first: nums.slice(2, 6),
                second: nums.slice(6, 12),
                third: nums.slice(12, 20),
              },
              source: 'XosoVNM.net',
            },
          });
        synced++;
      }
    }

    if (synced > 0) {
      await cacheService.invalidatePrefix('xoso365:vietlott:');
    }
    return synced;
  } catch (err) {
    console.warn('Vietlott XosoVNM sync warning:', err);
    return 0;
  }
}

export async function getLatestVietlottFromDB(dateISO: string) {
  const gameTypes = ['POWER_655', 'MEGA_645', 'MAX_3D'] as const;
  const minWindow = shiftDateStr(dateISO, -7);
  const out = [];
  for (const gt of gameTypes) {
    const liveRows = await db
      .select()
      .from(vietlottResults)
      .where(
        and(
          eq(vietlottResults.gameType, gt),
          eq(vietlottResults.source, 'XosoVNM.net'),
          lte(vietlottResults.drawDate, dateISO)
        )
      )
      .orderBy(desc(vietlottResults.drawDate))
      .limit(1);

    if (liveRows[0] && liveRows[0].drawDate >= minWindow) {
      out.push(liveRows[0]);
      continue;
    }

    const rows = await db
      .select()
      .from(vietlottResults)
      .where(and(eq(vietlottResults.gameType, gt), lte(vietlottResults.drawDate, dateISO)))
      .orderBy(desc(vietlottResults.drawDate))
      .limit(1);
    if (rows[0]) out.push(rows[0]);
  }
  return out;
}

export async function synchronizeRegionResults(
  region: 'MB' | 'MN' | 'MT',
  targetDate: string,
  options: SyncRegionOptions = {}
): Promise<SyncRegionResult> {
  const syncMode: SyncMode = options.syncMode || 'MANUAL';
  const force = Boolean(options.force);
  const startedAt = Date.now();
  const scheduledProvs = getScheduledProvincesForRegionDate(region, targetDate);
  const provincesExpected = scheduledProvs.length;

  // 1. Concurrency lock (anti-concurrent execution across workers / timers)
  const lockAcquired = await tryAcquireRegionLock(region, targetDate);
  if (!lockAcquired) {
    return {
      status: 'LOCKED_SKIPPED',
      providerUsed: '-',
      recordsSynced: 0,
      skippedDuplicates: 0,
      provincesCompleted: 0,
      provincesExpected,
      prizesFound: 0,
      prizesExpected: 0,
      attempts: 0,
      message: `Tiến trình đồng bộ ${region} ngày ${targetDate} đang chạy ở worker khác, bỏ qua để tránh xung đột.`,
    };
  }

  try {
    // 2. Check existing province completion status for (region, targetDate)
    const existingRows = await db
      .select()
      .from(lotteryResults)
      .where(
        and(eq(lotteryResults.drawDate, targetDate), eq(lotteryResults.region, region))
      );

    const existingByCode = new Map(existingRows.map((r) => [r.provinceCode, r]));
    const alreadyCompletedCodes = new Set(
      existingRows
        .filter((r) => r.syncStatus === 'COMPLETED' && r.isVerified && r.source !== 'InitialArchive' && r.source !== 'ArchiveSeed' && r.source !== 'OnDemandArchive')
        .map((r) => r.provinceCode)
    );

    if (
      !force &&
      provincesExpected > 0 &&
      alreadyCompletedCodes.size >= provincesExpected
    ) {
      await db
        .update(syncSessions)
        .set({
          status: 'COMPLETED',
          provincesCompleted: alreadyCompletedCodes.size,
          provincesExpected,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(syncSessions.drawDate, targetDate), eq(syncSessions.region, region))
        );

      return {
        status: 'ALREADY_COMPLETED',
        providerUsed: 'Database',
        recordsSynced: 0,
        skippedDuplicates: alreadyCompletedCodes.size,
        provincesCompleted: alreadyCompletedCodes.size,
        provincesExpected,
        prizesFound: existingRows.reduce((s, r) => s + r.prizesFound, 0),
        prizesExpected: existingRows.reduce((s, r) => s + r.prizesExpected, 0),
        attempts: 0,
        message: `Miền ${region} ngày ${targetDate} đã hoàn tất xác minh đủ ${alreadyCompletedCodes.size}/${provincesExpected} đài, tự động dừng đồng bộ.`,
      };
    }

    const pendingProvinceCodes = force
      ? scheduledProvs.map((p) => p.code)
      : scheduledProvs
          .map((p) => p.code)
          .filter((code) => !alreadyCompletedCodes.has(code));

    const providers = await db
      .select()
      .from(apiProviders)
      .where(and(eq(apiProviders.providerKey, 'xosovnm'), eq(apiProviders.isEnabled, true)))
      .orderBy(apiProviders.priority);

    if (providers.length === 0) {
      return {
        status: 'FAILED',
        providerUsed: 'Không có nguồn kích hoạt',
        recordsSynced: 0,
        skippedDuplicates: 0,
        provincesCompleted: alreadyCompletedCodes.size,
        provincesExpected,
        prizesFound: 0,
        prizesExpected: 0,
        attempts: 0,
        message: 'Không có nhà cung cấp API nào đang được kích hoạt.',
      };
    }

    let lastErrMsg = 'API chưa có dữ liệu kết quả cho kỳ quay này.';
    let totalAttempts = 0;
    let totalApiRequests = 0;

    for (const provider of providers) {
      const maxRetries = Math.max(1, Math.min(3, provider.maxRetries));

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        totalAttempts++;
        try {
          const fetchRes = await fetchRegionDrawsFromProvider(
            provider,
            region,
            targetDate,
            pendingProvinceCodes
          );
          totalApiRequests += fetchRes.requestsMade;

          if (fetchRes.draws.length === 0) {
            await db.insert(syncLogs).values({
              providerKey: provider.providerKey,
              region,
              targetDate,
              syncMode,
              endpointUrl: fetchRes.endpointUrl,
              httpStatus: fetchRes.httpStatus,
              status: 'NO_DATA_YET',
              recordsSynced: 0,
              prizesFound: 0,
              prizesExpected:
                provincesExpected * (region === 'MB' ? 27 : 18),
              attempts: totalAttempts,
              durationMs: Date.now() - startedAt,
              errorMessage: `API chưa trả về giải nào cho ${region} ngày ${targetDate}.`,
            });

            await db
              .update(syncSessions)
              .set({
                status: 'RUNNING',
                pollCount: sql`${syncSessions.pollCount} + 1`,
                apiRequestsCount: sql`${syncSessions.apiRequestsCount} + ${totalApiRequests}`,
                lastPollAt: new Date(),
                provincesCompleted: alreadyCompletedCodes.size,
                lastError: '',
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(syncSessions.drawDate, targetDate),
                  eq(syncSessions.region, region)
                )
              );

            // Try next provider only if another fallback provider exists, otherwise stop gracefully without fabricating
            lastErrMsg = `Chưa có kết quả từ ${provider.name} (API sẽ kiểm tra lại ở chu kỳ tiếp theo).`;
            break;
          }

          let recordsSynced = 0;
          let skippedDuplicates = 0;
          let totalPrizesFound = 0;
          let totalPrizesExpected = 0;
          const sourceLabel = provider.providerKey === 'xosovnm' ? 'XosoVNM.net' : provider.name;
          const verifyingProvinces: {
            provinceCode: string;
            payloadHash: string;
            rowId: number;
          }[] = [];

          for (const d of fetchRes.draws) {
            const existing = existingByCode.get(d.provinceCode);
            if (existing?.source === 'Manual') {
              skippedDuplicates++;
              continue;
            }

            const incomingCheck = sanitizeAndInspectPrizes(region, d.prizes);
            if (incomingCheck.prizesFound === 0) {
              continue;
            }

            // Merge incremental prizes if existing row is from live sync and still partial/verifying
            const shouldMergeWithExisting =
              existing &&
              (existing.syncStatus === 'PARTIAL' || existing.syncStatus === 'VERIFYING') &&
              existing.source === sourceLabel;

            const mergedPrizes = shouldMergeWithExisting
              ? mergeIncrementalPrizes(region, existing.prizes, incomingCheck.prizes)
              : incomingCheck.prizes;

            const finalInspect = sanitizeAndInspectPrizes(region, mergedPrizes);
            totalPrizesFound += finalInspect.prizesFound;
            totalPrizesExpected += finalInspect.prizesExpected;

            const mergedKyHieu =
              d.kyHieu && d.kyHieu.length > 0 ? d.kyHieu : existing?.kyHieu || [];
            const newHash = computePrizesHash(mergedKyHieu, finalInspect.prizes);
            const { allTails, specialTail } = extractTailsFromPrizes(finalInspect.prizes);

            // Exact duplicate check (unchanged payload and already in same or higher state)
            if (
              existing &&
              existing.payloadHash === newHash &&
              existing.source === sourceLabel &&
              existing.syncStatus === 'COMPLETED'
            ) {
              skippedDuplicates++;
              continue;
            }

            if (
              existing &&
              existing.payloadHash === newHash &&
              existing.source === sourceLabel &&
              existing.syncStatus === 'PARTIAL' &&
              !finalInspect.isComplete
            ) {
              skippedDuplicates++;
              continue;
            }

            const nextStatus = finalInspect.isComplete ? 'VERIFYING' : 'PARTIAL';
            const confirmedOnSecondPass =
              finalInspect.isComplete &&
              existing &&
              existing.syncStatus === 'VERIFYING' &&
              existing.payloadHash === newHash &&
              existing.source === sourceLabel;

            if (!existing) {
              const [inserted] = await db
                .insert(lotteryResults)
                .values({
                  drawDate: targetDate,
                  region,
                  provinceCode: d.provinceCode,
                  provinceName: d.provinceName,
                  kyHieu: mergedKyHieu,
                  prizes: finalInspect.prizes,
                  allTails,
                  specialTail,
                  source: sourceLabel,
                  isVerified: false,
                  syncStatus: nextStatus,
                  prizesFound: finalInspect.prizesFound,
                  prizesExpected: finalInspect.prizesExpected,
                  payloadHash: newHash,
                  version: 1,
                })
                .onConflictDoUpdate({
                  target: [lotteryResults.drawDate, lotteryResults.provinceCode],
                  set: {
                    kyHieu: mergedKyHieu,
                    prizes: finalInspect.prizes,
                    allTails,
                    specialTail,
                    source: sourceLabel,
                    isVerified: false,
                    syncStatus: nextStatus,
                    prizesFound: finalInspect.prizesFound,
                    prizesExpected: finalInspect.prizesExpected,
                    payloadHash: newHash,
                    updatedAt: new Date(),
                  },
                })
                .returning({ id: lotteryResults.id });

              recordsSynced++;
              if (finalInspect.isComplete && inserted) {
                verifyingProvinces.push({
                  provinceCode: d.provinceCode,
                  payloadHash: newHash,
                  rowId: inserted.id,
                });
              }
            } else if (confirmedOnSecondPass) {
              await db
                .update(lotteryResults)
                .set({
                  syncStatus: 'COMPLETED',
                  isVerified: true,
                  verifiedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(lotteryResults.id, existing.id));
              recordsSynced++;
            } else {
              // Update existing record (either upgrading archive, adding new prizes, or updating changed prizes)
              await db
                .update(lotteryResults)
                .set({
                  kyHieu: mergedKyHieu,
                  prizes: finalInspect.prizes,
                  allTails,
                  specialTail,
                  source: sourceLabel,
                  isVerified: false,
                  syncStatus: nextStatus,
                  prizesFound: finalInspect.prizesFound,
                  prizesExpected: finalInspect.prizesExpected,
                  payloadHash: newHash,
                  version: existing.version + 1,
                  verifiedAt: null,
                  updatedAt: new Date(),
                })
                .where(eq(lotteryResults.id, existing.id));
              recordsSynced++;

              if (finalInspect.isComplete) {
                verifyingProvinces.push({
                  provinceCode: d.provinceCode,
                  payloadHash: newHash,
                  rowId: existing.id,
                });
              }
            }
          }

          // Final consistency re-check when provinces reach full prize count
          let newlyVerifiedCount = 0;
          if (verifyingProvinces.length > 0) {
            await new Promise((r) => setTimeout(r, 900));
            try {
              const verifyFetch = await fetchRegionDrawsFromProvider(
                provider,
                region,
                targetDate,
                verifyingProvinces.map((v) => v.provinceCode)
              );
              totalApiRequests += verifyFetch.requestsMade;

              const verifyMap = new Map(
                verifyFetch.draws.map((vd) => [vd.provinceCode, vd])
              );

              for (const vp of verifyingProvinces) {
                const vd = verifyMap.get(vp.provinceCode);
                if (!vd) continue;
                const reInspect = sanitizeAndInspectPrizes(region, vd.prizes);
                const reHash = computePrizesHash(vd.kyHieu || [], reInspect.prizes);

                if (reInspect.isComplete && reHash === vp.payloadHash) {
                  await db
                    .update(lotteryResults)
                    .set({
                      syncStatus: 'COMPLETED',
                      isVerified: true,
                      verifiedAt: new Date(),
                      updatedAt: new Date(),
                    })
                    .where(eq(lotteryResults.id, vp.rowId));
                  newlyVerifiedCount++;
                } else if (reInspect.prizesFound > 0 && reHash !== vp.payloadHash) {
                  // Numbers changed on verification check -> update immediately, stay VERIFYING
                  const { allTails, specialTail } = extractTailsFromPrizes(reInspect.prizes);
                  await db
                    .update(lotteryResults)
                    .set({
                      kyHieu: vd.kyHieu || [],
                      prizes: reInspect.prizes,
                      allTails,
                      specialTail,
                      syncStatus: reInspect.isComplete ? 'VERIFYING' : 'PARTIAL',
                      isVerified: false,
                      prizesFound: reInspect.prizesFound,
                      prizesExpected: reInspect.prizesExpected,
                      payloadHash: reHash,
                      version: sql`${lotteryResults.version} + 1`,
                      updatedAt: new Date(),
                    })
                    .where(eq(lotteryResults.id, vp.rowId));
                }
              }
            } catch {
              // If verification call hits transient error or rate limit, next 30s tick will confirm
            }
          }

          if (provider.providerKey === 'xosovnm') {
            await synchronizeVietlottFromXosoVNM();
          }

          // Recalculate live completion status for this region + date
          const refreshedRows = await db
            .select()
            .from(lotteryResults)
            .where(
              and(
                eq(lotteryResults.drawDate, targetDate),
                eq(lotteryResults.region, region)
              )
            );
          const completedProvincesCount = refreshedRows.filter(
            (r) => r.syncStatus === 'COMPLETED' && r.isVerified
          ).length;
          const allProvincesComplete =
            provincesExpected > 0 && completedProvincesCount >= provincesExpected;

          await db
            .update(apiProviders)
            .set({ lastSyncAt: new Date(), lastStatus: 'OK', updatedAt: new Date() })
            .where(eq(apiProviders.id, provider.id));

          await db
            .update(syncSessions)
            .set({
              status: allProvincesComplete ? 'COMPLETED' : 'RUNNING',
              provincesExpected,
              provincesCompleted: completedProvincesCount,
              pollCount: sql`${syncSessions.pollCount} + 1`,
              apiRequestsCount: sql`${syncSessions.apiRequestsCount} + ${totalApiRequests}`,
              lastPollAt: new Date(),
              completedAt: allProvincesComplete ? new Date() : null,
              lastError: '',
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(syncSessions.drawDate, targetDate),
                eq(syncSessions.region, region)
              )
            );

          const logStatus: SyncRegionResult['status'] = allProvincesComplete
            ? 'VERIFIED_COMPLETED'
            : recordsSynced > 0
            ? 'PARTIAL_UPDATED'
            : 'SKIPPED_DUPLICATE';

          await db.insert(syncLogs).values({
            providerKey: provider.providerKey,
            region,
            targetDate,
            syncMode,
            endpointUrl: fetchRes.endpointUrl,
            httpStatus: fetchRes.httpStatus,
            status: logStatus,
            recordsSynced,
            prizesFound: totalPrizesFound,
            prizesExpected: totalPrizesExpected,
            attempts: totalAttempts,
            durationMs: Date.now() - startedAt,
            errorMessage:
              recordsSynced === 0 && skippedDuplicates > 0
                ? 'Không có giải mới (trùng khớp dữ liệu đã lưu).'
                : newlyVerifiedCount > 0
                ? `Đã xác minh lần cuối ${newlyVerifiedCount} đài đủ cơ cấu giải.`
                : '',
          });

          if (recordsSynced > 0 || newlyVerifiedCount > 0) {
            await cacheService.invalidatePrefix(`xoso365:results:${targetDate}`);
            await cacheService.invalidatePrefix('xoso365:stats:');
            await cacheService.invalidatePrefix('xoso365:province:');
          }

          return {
            status: allProvincesComplete
              ? 'VERIFIED_COMPLETED'
              : recordsSynced > 0
              ? 'PARTIAL_UPDATED'
              : 'SKIPPED_DUPLICATE',
            providerUsed: provider.name,
            recordsSynced,
            skippedDuplicates,
            provincesCompleted: completedProvincesCount,
            provincesExpected,
            prizesFound: totalPrizesFound,
            prizesExpected: totalPrizesExpected,
            attempts: totalAttempts,
            message: allProvincesComplete
              ? `Hoàn tất xác minh ${completedProvincesCount}/${provincesExpected} đài miền ${region} từ ${provider.name}.`
              : `Cập nhật ${recordsSynced} bản ghi (${totalPrizesFound}/${totalPrizesExpected} giải) từ ${provider.name}.`,
          };
        } catch (err: unknown) {
          const isApiErr = err instanceof ExternalApiError;
          const httpStatus = isApiErr ? err.httpStatus : null;
          const endpointUrl = isApiErr ? err.endpointUrl : provider.baseUrl;
          lastErrMsg = err instanceof Error ? err.message : 'Lỗi kết nối API';

          await db.insert(syncLogs).values({
            providerKey: provider.providerKey,
            region,
            targetDate,
            syncMode,
            endpointUrl,
            httpStatus,
            status:
              httpStatus === 429
                ? 'RATE_LIMITED'
                : attempt < maxRetries
                ? 'RETRY'
                : 'FAILED',
            recordsSynced: 0,
            prizesFound: 0,
            prizesExpected: provincesExpected * (region === 'MB' ? 27 : 18),
            attempts: attempt,
            durationMs: Date.now() - startedAt,
            errorMessage: lastErrMsg,
          });

          if (httpStatus === 429) {
            break; // Do not retry immediately if rate-limited
          }

          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
      }

      await db
        .update(apiProviders)
        .set({ lastSyncAt: new Date(), lastStatus: 'ERROR', updatedAt: new Date() })
        .where(eq(apiProviders.id, provider.id));
    }

    // Do NOT fabricate results when API has no data or errors out!
    await db
      .update(syncSessions)
      .set({
        status: 'RUNNING',
        pollCount: sql`${syncSessions.pollCount} + 1`,
        apiRequestsCount: sql`${syncSessions.apiRequestsCount} + ${totalApiRequests}`,
        lastPollAt: new Date(),
        lastError: lastErrMsg,
        updatedAt: new Date(),
      })
      .where(
        and(eq(syncSessions.drawDate, targetDate), eq(syncSessions.region, region))
      );

    return {
      status: lastErrMsg.includes('Chưa có kết quả') ? 'NO_DATA_YET' : 'FAILED',
      providerUsed: providers.map((p) => p.name).join(', '),
      recordsSynced: 0,
      skippedDuplicates: 0,
      provincesCompleted: alreadyCompletedCodes.size,
      provincesExpected,
      prizesFound: 0,
      prizesExpected: provincesExpected * (region === 'MB' ? 27 : 18),
      attempts: totalAttempts,
      message: lastErrMsg,
    };
  } finally {
    await releaseRegionLock(region, targetDate);
  }
}

export async function getAutoSyncDashboardState() {
  const vnNow = getVNTimeNow();
  const sessions = await ensureTodaySyncSessions(vnNow.dateStr);

  const todayRows = await db
    .select({
      region: lotteryResults.region,
      provinceCode: lotteryResults.provinceCode,
      provinceName: lotteryResults.provinceName,
      syncStatus: lotteryResults.syncStatus,
      prizesFound: lotteryResults.prizesFound,
      prizesExpected: lotteryResults.prizesExpected,
      isVerified: lotteryResults.isVerified,
      version: lotteryResults.version,
      source: lotteryResults.source,
      updatedAt: lotteryResults.updatedAt,
    })
    .from(lotteryResults)
    .where(eq(lotteryResults.drawDate, vnNow.dateStr))
    .orderBy(lotteryResults.region, lotteryResults.provinceCode);

  const recentLogs = await db
    .select()
    .from(syncLogs)
    .orderBy(desc(syncLogs.createdAt))
    .limit(40);

  return {
    vnTime: vnNow,
    timezone: 'Asia/Ho_Chi_Minh',
    schedulerConfig: {
      autoSyncEnabled: process.env.AUTO_SYNC_ENABLED !== 'false',
      pollIntervalSeconds: 30,
      preStartMinutes: 15,
      cloudSchedulerEndpoint: '/api/cron/sync',
      hasCronSecret: Boolean(
        process.env.CRON_SYNC_SECRET && process.env.CRON_SYNC_SECRET.trim().length > 0
      ),
      activeInMemoryLocks: Array.from(inFlightSyncLocks),
    },
    windows: REGION_DRAW_WINDOWS,
    sessions,
    todayProvincesProgress: todayRows,
    rateLimiter: getRateLimiterSnapshot(),
    recentLogs,
  };
}

export async function markExpiredSessionsTimeout(dateStr: string, totalMinutes: number) {
  for (const win of REGION_DRAW_WINDOWS) {
    if (totalMinutes > win.endMin) {
      await db
        .update(syncSessions)
        .set({
          status: 'TIMEOUT_STOPPED',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(syncSessions.drawDate, dateStr),
            eq(syncSessions.region, win.region),
            inArray(syncSessions.status, ['PENDING', 'RUNNING', 'ERROR'])
          )
        );
    }
  }
}

export async function getDatabaseCoverageStats() {
  const [res] = await db
    .select({
      totalResults: count(),
      minDate: sql<string>`min(${lotteryResults.drawDate})`,
      maxDate: sql<string>`max(${lotteryResults.drawDate})`,
    })
    .from(lotteryResults);

  const [{ value: vietlottCount }] = await db
    .select({ value: count() })
    .from(vietlottResults);

  return {
    totalResults: Number(res?.totalResults || 0),
    vietlottCount: Number(vietlottCount || 0),
    minDate: res?.minDate || null,
    maxDate: res?.maxDate || null,
  };
}
