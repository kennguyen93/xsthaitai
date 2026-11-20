import type {
  ProvinceDrawResult,
  ProvinceInfo,
  VietlottMax3DResult,
  VietlottMegaResult,
  VietlottPowerResult,
  XSMBResult,
} from '../types/lottery';
import { getDayNameVN } from '../utils/lotteryEngine';
import {
  fetchProvinceHistoryFromPhaVNDirect,
  fetchRegionHistoryFromPhaVNDirect,
  fetchResultsFromPhaVNDirect,
  getStaticProvincesList,
} from './phavnDirectClient';

const CONFIGURED_API_BASE = (import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

const STATIC_HOST_SESSION_KEY = 'xoso_direct_phavn_host';

function isDirectBackendHost(): boolean {
  if (typeof window === 'undefined') return true;
  if (CONFIGURED_API_BASE) return true;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.run.app')
  );
}

function isKnownStaticFrontendHost(): boolean {
  if (typeof window === 'undefined' || CONFIGURED_API_BASE) return false;
  const host = window.location.hostname.toLowerCase();
  if (
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.github.io') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.surge.sh') ||
    host.endsWith('.workers.dev')
  ) {
    return true;
  }
  try {
    return window.sessionStorage.getItem(STATIC_HOST_SESSION_KEY) === host;
  } catch {
    return false;
  }
}

let backendApiUnavailable = isKnownStaticFrontendHost();
let backendProbePromise: Promise<boolean> | null = isDirectBackendHost()
  ? Promise.resolve(true)
  : backendApiUnavailable
  ? Promise.resolve(false)
  : null;

function markBackendUnavailable(): void {
  backendApiUnavailable = true;
  backendProbePromise = Promise.resolve(false);
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(STATIC_HOST_SESSION_KEY, window.location.hostname.toLowerCase());
    }
  } catch {
    // Ignore storage restriction
  }
}

export async function ensureBackendChecked(): Promise<boolean> {
  if (backendApiUnavailable) return false;
  if (backendProbePromise) return backendProbePromise;

  backendProbePromise = (async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/health'), {
        headers: { Accept: 'application/json' },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const body = (await res.json()) as { ok?: boolean };
        if (body?.ok) return true;
      }
      if (res.status === 404 || res.status === 405 || !ct.includes('application/json')) {
        markBackendUnavailable();
        return false;
      }
      return true;
    } catch {
      markBackendUnavailable();
      return false;
    }
  })();

  return backendProbePromise;
}

export function resolveApiUrl(apiPath: string): string {
  if (!CONFIGURED_API_BASE) return apiPath;
  return `${CONFIGURED_API_BASE}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
}

export function isBackendApiUnavailable(): boolean {
  return backendApiUnavailable;
}

class ApiNotFoundError extends Error {
  constructor() {
    super('Backend API endpoint not found on this domain');
    this.name = 'ApiNotFoundError';
  }
}

export interface DbLotteryRow {
  id: number;
  drawDate: string;
  region: 'MB' | 'MN' | 'MT';
  provinceCode: string;
  provinceName: string;
  kyHieu: string[];
  prizes: Record<string, string[]>;
  allTails: string[];
  specialTail: string;
  source: string;
}

export interface DbProvinceRow {
  id: number;
  code: string;
  name: string;
  slug: string;
  region: 'MB' | 'MN' | 'MT';
  drawDays: number[];
  drawTime: string;
}

export interface DbVietlottRow {
  id: number;
  gameType: 'MEGA_645' | 'POWER_655' | 'MAX_3D';
  period: string;
  drawDate: string;
  numbers: number[];
  bonusNumber: number | null;
  jackpot1Value: string;
  jackpot2Value: string;
  prizeBreakdown: Record<string, unknown>;
  source: string;
}

export interface SeoRow {
  id: number;
  routePath: string;
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
}

export interface AdRow {
  id: number;
  slotKey: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  altText: string;
  isActive: boolean;
  impressions: number;
  clicks: number;
}

export interface ServerStatisticsData {
  region: 'MB' | 'MN' | 'MT';
  daysRequested: number;
  actualDrawsAnalyzed: number;
  actualDaysCovered: number;
  dateFrom: string;
  dateTo: string;
  pairs: {
    pair: string;
    count: number;
    daysSinceLast: number;
    maxGap: number;
    lastSeenDate: string;
  }[];
  topHot: {
    pair: string;
    count: number;
    daysSinceLast: number;
    maxGap: number;
    lastSeenDate: string;
  }[];
  topLoGan: {
    pair: string;
    count: number;
    daysSinceLast: number;
    maxGap: number;
    lastSeenDate: string;
  }[];
  headTail: {
    digit: string;
    headCount: number;
    tailCount: number;
    specialHeadCount: number;
    specialTailCount: number;
  }[];
  specialHistory: {
    drawDate: string;
    provinceCode: string;
    provinceName: string;
    specialNumber: string;
    specialTail: string;
    head: string;
    tail: string;
    sum: number;
  }[];
  monthlySeries: {
    month: string;
    draws: number;
    avgSpecialSum: number;
    topPair: string;
  }[];
  coOccurrences: {
    pairA: string;
    pairB: string;
    count: number;
    lastDate: string;
  }[];
  mirrorPairs: {
    pairA: string;
    pairB: string;
    pairLabel: string;
    totalCount: number;
    daysSinceLast: number;
    maxGap: number;
    lastSeenDate: string;
  }[];
  recentDays: {
    drawDate: string;
    tails: string[];
    specialTail: string;
  }[];
  nextDaySpecial: {
    triggerTail: string;
    triggerDate: string;
    sampleCount: number;
    nextTails: { pair: string; count: number }[];
    nextHeads: { digit: string; count: number }[];
    nextTailsDigit: { digit: string; count: number }[];
    history: {
      triggerDate: string;
      nextDate: string;
      nextSpecial: string;
      nextTail: string;
    }[];
  };
  cacheStatus: string;
}

export function mapDbRowToXSMB(row: DbLotteryRow): XSMBResult {
  return {
    date: row.drawDate,
    dayOfWeekLabel: getDayNameVN(row.drawDate),
    provinceName: row.provinceName,
    provinceCode: row.provinceCode,
    kyHieu: row.kyHieu || [],
    prizes: {
      db: row.prizes.db || [],
      g1: row.prizes.g1 || [],
      g2: row.prizes.g2 || [],
      g3: row.prizes.g3 || [],
      g4: row.prizes.g4 || [],
      g5: row.prizes.g5 || [],
      g6: row.prizes.g6 || [],
      g7: row.prizes.g7 || [],
    },
  };
}

export function mapDbRowToProvinceDraw(row: DbLotteryRow): ProvinceDrawResult {
  const province: ProvinceInfo = {
    code: row.provinceCode,
    name: row.provinceName,
    region: row.region,
  };
  return {
    province,
    date: row.drawDate,
    prizes: {
      g8: row.prizes.g8 || [],
      g7: row.prizes.g7 || [],
      g6: row.prizes.g6 || [],
      g5: row.prizes.g5 || [],
      g4: row.prizes.g4 || [],
      g3: row.prizes.g3 || [],
      g2: row.prizes.g2 || [],
      g1: row.prizes.g1 || [],
      db: row.prizes.db || [],
    },
  };
}

export function mapVietlottRows(rows: DbVietlottRow[]): {
  mega: VietlottMegaResult | null;
  power: VietlottPowerResult | null;
  max3d: VietlottMax3DResult | null;
} {
  const megaRow = rows.find((r) => r.gameType === 'MEGA_645');
  const powerRow = rows.find((r) => r.gameType === 'POWER_655');
  const max3dRow = rows.find((r) => r.gameType === 'MAX_3D');

  const mega: VietlottMegaResult | null = megaRow
    ? {
        period: megaRow.period,
        date: megaRow.drawDate,
        numbers: megaRow.numbers,
        jackpotValue: megaRow.jackpot1Value,
        winnersJackpot: Number(megaRow.prizeBreakdown.winnersJackpot || 0),
        winnersFirst: Number(megaRow.prizeBreakdown.winnersFirst || 14),
        winnersSecond: Number(megaRow.prizeBreakdown.winnersSecond || 680),
        winnersThird: Number(megaRow.prizeBreakdown.winnersThird || 12400),
      }
    : null;

  const power: VietlottPowerResult | null = powerRow
    ? {
        period: powerRow.period,
        date: powerRow.drawDate,
        numbers: powerRow.numbers,
        bonusNumber: powerRow.bonusNumber || 1,
        jackpot1Value: powerRow.jackpot1Value,
        jackpot2Value: powerRow.jackpot2Value,
        winnersJp1: Number(powerRow.prizeBreakdown.winnersJp1 || 0),
        winnersJp2: Number(powerRow.prizeBreakdown.winnersJp2 || 0),
      }
    : null;

  const max3d: VietlottMax3DResult | null = max3dRow
    ? {
        period: max3dRow.period,
        date: max3dRow.drawDate,
        special: (max3dRow.prizeBreakdown.special as string[]) || [],
        first: (max3dRow.prizeBreakdown.first as string[]) || [],
        second: (max3dRow.prizeBreakdown.second as string[]) || [],
        third: (max3dRow.prizeBreakdown.third as string[]) || [],
      }
    : null;

  return { mega, power, max3d };
}

async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function fetchJsonWithRetry<T>(
  apiPath: string,
  errorMessage: string,
  signal?: AbortSignal,
  maxRetries = 5
): Promise<T> {
  const hasBackend = await ensureBackendChecked();
  if (!hasBackend || backendApiUnavailable) {
    throw new ApiNotFoundError();
  }

  const url = resolveApiUrl(apiPath);
  const retryDelays = [700, 1200, 1800, 2500, 3200];
  let lastErr: unknown;
  const allowJson404 = apiPath.startsWith('/api/results/province/');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        signal,
        headers: { Accept: 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (res.ok && isJson) {
        return (await res.json()) as T;
      }

      // Static host / other domain without Express /api/* returns 404/405 or SPA index.html
      if (res.status === 405 || (res.status === 404 && (!isJson || !allowJson404))) {
        markBackendUnavailable();
        throw new ApiNotFoundError();
      }

      if (res.ok && !isJson) {
        const htmlSample = await res.text().catch(() => '');
        if (htmlSample.includes('id="root"') || htmlSample.includes("id='root'")) {
          markBackendUnavailable();
          throw new ApiNotFoundError();
        }
      }

      const isTransientHtmlOr5xx = !isJson || res.status >= 500;
      if (!isTransientHtmlOr5xx || attempt === maxRetries) {
        let serverError = errorMessage;
        if (isJson) {
          try {
            const body = (await res.json()) as { error?: string };
            if (body?.error) serverError = body.error;
          } catch {
            // Ignore malformed JSON
          }
        }
        throw new Error(serverError);
      }

      lastErr = new Error(errorMessage);
    } catch (err: unknown) {
      if (err instanceof ApiNotFoundError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      lastErr = err;
      if (attempt === maxRetries) {
        throw new Error(
          err instanceof Error && err.message && !err.message.includes('Failed to fetch')
            ? err.message
            : errorMessage
        );
      }
    }

    const baseDelay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
    const jitter = Math.floor(Math.random() * 250);
    await sleepWithAbort(baseDelay + jitter, signal);
  }

  throw lastErr instanceof Error ? lastErr : new Error(errorMessage);
}

export async function fetchResultsByDate(date: string, signal?: AbortSignal) {
  try {
    return await fetchJsonWithRetry<{ date: string; count: number; results: DbLotteryRow[] }>(
      `/api/results?date=${encodeURIComponent(date)}`,
      'Không thể tải kết quả xổ số từ máy chủ.',
      signal
    );
  } catch (err: unknown) {
    if (err instanceof ApiNotFoundError) {
      // Fixed official external source on any domain without backend: https://pha.vn/api/v1/traditional
      return fetchResultsFromPhaVNDirect(date, signal);
    }
    throw err;
  }
}

export async function fetchProvinces(): Promise<DbProvinceRow[]> {
  try {
    return await fetchJsonWithRetry<DbProvinceRow[]>(
      '/api/provinces',
      'Không thể tải danh sách tỉnh.'
    );
  } catch (err: unknown) {
    if (err instanceof ApiNotFoundError) {
      return getStaticProvincesList();
    }
    throw err;
  }
}

export async function fetchProvinceHistory(slug: string, limit = 10) {
  try {
    return await fetchJsonWithRetry<{ province: DbProvinceRow; draws: DbLotteryRow[] }>(
      `/api/results/province/${encodeURIComponent(slug)}?limit=${limit}`,
      'Không thể tải lịch sử kết quả tỉnh.'
    );
  } catch (err: unknown) {
    if (err instanceof ApiNotFoundError) {
      return fetchProvinceHistoryFromPhaVNDirect(slug, limit);
    }
    throw err;
  }
}

export async function fetchRegionHistory(
  region: 'MB' | 'MN' | 'MT' | 'ALL',
  startDate: string,
  limit = 7,
  signal?: AbortSignal
) {
  try {
    return await fetchJsonWithRetry<{
      region: 'MB' | 'MN' | 'MT' | 'ALL';
      startDate: string;
      limit: number;
      count: number;
      draws: DbLotteryRow[];
    }>(
      `/api/results/region/${region}?date=${encodeURIComponent(startDate)}&limit=${limit}`,
      'Không thể tải danh sách kết quả xổ số.',
      signal
    );
  } catch (err: unknown) {
    if (err instanceof ApiNotFoundError) {
      return fetchRegionHistoryFromPhaVNDirect(region, startDate, limit, signal);
    }
    throw err;
  }
}

export async function fetchXsmbHistory(startDate: string, limit = 7, signal?: AbortSignal) {
  return fetchRegionHistory('MB', startDate, limit, signal);
}

export async function fetchVietlottByDate(date: string) {
  try {
    return await fetchJsonWithRetry<{ date: string; results: DbVietlottRow[] }>(
      `/api/vietlott?date=${encodeURIComponent(date)}`,
      'Không thể tải kết quả Vietlott.'
    );
  } catch (err: unknown) {
    if (err instanceof ApiNotFoundError) {
      return { date, results: [] };
    }
    throw err;
  }
}

export async function fetchVietlottHistory(
  startDate: string,
  limit = 7,
  signal?: AbortSignal
) {
  try {
    return await fetchJsonWithRetry<{
      startDate: string;
      limit: number;
      count: number;
      results: DbVietlottRow[];
    }>(
      `/api/vietlott/history?date=${encodeURIComponent(startDate)}&limit=${limit}`,
      'Không thể tải danh sách kết quả Vietlott.',
      signal
    );
  } catch (err: unknown) {
    if (err instanceof ApiNotFoundError) {
      return { startDate, limit, count: 0, results: [] as DbVietlottRow[] };
    }
    throw err;
  }
}

export async function fetchStatistics(
  date: string,
  region: 'MB' | 'MN' | 'MT',
  days: number,
  provinceCode?: string
): Promise<ServerStatisticsData> {
  const params = new URLSearchParams({
    date,
    region,
    days: String(days),
  });
  if (provinceCode) params.set('provinceCode', provinceCode);
  try {
    return await fetchJsonWithRetry<ServerStatisticsData>(
      `/api/statistics?${params.toString()}`,
      'Không thể tải dữ liệu thống kê.'
    );
  } catch (err: unknown) {
    if (err instanceof ApiNotFoundError) {
      throw new Error(
        'Thống kê dữ liệu lịch sử yêu cầu kết nối máy chủ backend (cấu hình VITE_API_BASE_URL hoặc chạy kèm Express server).'
      );
    }
    throw err;
  }
}

export async function fetchSeoMetadata(): Promise<SeoRow[]> {
  if (backendApiUnavailable) return [];
  try {
    return await fetchJsonWithRetry<SeoRow[]>('/api/seo', 'Không thể tải cấu hình SEO.', undefined, 2);
  } catch {
    return [];
  }
}

export async function fetchActiveAds(): Promise<AdRow[]> {
  if (backendApiUnavailable) return [];
  try {
    return await fetchJsonWithRetry<AdRow[]>('/api/ads', 'Không thể tải quảng cáo.', undefined, 2);
  } catch {
    return [];
  }
}
