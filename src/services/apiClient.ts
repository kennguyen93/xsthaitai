import type {
  ProvinceDrawResult,
  ProvinceInfo,
  VietlottMax3DResult,
  VietlottMegaResult,
  VietlottPowerResult,
  XSMBResult,
} from '../types/lottery';
import { getDayNameVN } from '../utils/lotteryEngine';

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

async function fetchWithRetry(
  url: string,
  errorMessage: string,
  signal?: AbortSignal,
  maxRetries = 2
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (res.ok) return res;
      // Only retry transient 5xx responses
      if (res.status < 500 || attempt === maxRetries) {
        let serverError = errorMessage;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) serverError = body.error;
        } catch {
          // Ignore non-JSON error body
        }
        throw new Error(serverError);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      lastErr = err;
      if (attempt === maxRetries) {
        throw err instanceof Error ? err : new Error(errorMessage);
      }
    }
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error(errorMessage);
}

export async function fetchResultsByDate(date: string, signal?: AbortSignal) {
  const res = await fetchWithRetry(
    `/api/results?date=${encodeURIComponent(date)}`,
    'Không thể tải kết quả xổ số từ máy chủ.',
    signal
  );
  return (await res.json()) as { date: string; count: number; results: DbLotteryRow[] };
}

export async function fetchProvinces(): Promise<DbProvinceRow[]> {
  const res = await fetchWithRetry('/api/provinces', 'Không thể tải danh sách tỉnh.');
  return (await res.json()) as DbProvinceRow[];
}

export async function fetchProvinceHistory(slug: string, limit = 10) {
  const res = await fetchWithRetry(
    `/api/results/province/${encodeURIComponent(slug)}?limit=${limit}`,
    'Không thể tải lịch sử kết quả tỉnh.'
  );
  return (await res.json()) as { province: DbProvinceRow; draws: DbLotteryRow[] };
}

export async function fetchVietlottByDate(date: string) {
  const res = await fetchWithRetry(
    `/api/vietlott?date=${encodeURIComponent(date)}`,
    'Không thể tải kết quả Vietlott.'
  );
  return (await res.json()) as { date: string; results: DbVietlottRow[] };
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
  const res = await fetchWithRetry(
    `/api/statistics?${params.toString()}`,
    'Không thể tải dữ liệu thống kê.'
  );
  return (await res.json()) as ServerStatisticsData;
}

export async function fetchSeoMetadata(): Promise<SeoRow[]> {
  const res = await fetch('/api/seo');
  if (!res.ok) return [];
  return (await res.json()) as SeoRow[];
}

export async function fetchActiveAds(): Promise<AdRow[]> {
  const res = await fetch('/api/ads');
  if (!res.ok) return [];
  return (await res.json()) as AdRow[];
}
