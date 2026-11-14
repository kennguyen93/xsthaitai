import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { lotteryResults } from '../../src/db/schema.ts';
import { cacheService } from '../cache/redisCache.ts';
import { shiftDateStr } from './lotteryDataHelper.ts';

export interface StatPairRow {
  pair: string;
  count: number;
  daysSinceLast: number;
  maxGap: number;
  lastSeenDate: string;
}

export interface HeadTailStat {
  digit: string;
  headCount: number;
  tailCount: number;
  specialHeadCount: number;
  specialTailCount: number;
}

export interface SpecialPrizeHistoryItem {
  drawDate: string;
  provinceCode: string;
  provinceName: string;
  specialNumber: string;
  specialTail: string;
  head: string;
  tail: string;
  sum: number;
}

export interface FullStatisticsResponse {
  region: 'MB' | 'MN' | 'MT';
  daysRequested: number;
  actualDrawsAnalyzed: number;
  actualDaysCovered: number;
  dateFrom: string;
  dateTo: string;
  pairs: StatPairRow[];
  topHot: StatPairRow[];
  topLoGan: StatPairRow[];
  headTail: HeadTailStat[];
  specialHistory: SpecialPrizeHistoryItem[];
  monthlySeries: { month: string; draws: number; avgSpecialSum: number; topPair: string }[];
  cacheStatus: string;
}

export async function computePostgreSQLStatistics(
  endDate: string,
  region: 'MB' | 'MN' | 'MT',
  days: number,
  provinceCode?: string
): Promise<FullStatisticsResponse> {
  const allowedDays = [7, 30, 90, 365, 1095, 1825, 3650];
  const validDays = allowedDays.includes(days) ? days : Math.max(7, Math.min(3650, days));
  const cacheKey = `xoso365:stats:${region}:${endDate}:${validDays}:${provinceCode || 'ALL'}`;

  const cached = await cacheService.get<FullStatisticsResponse>(cacheKey);
  if (cached) {
    return { ...cached, cacheStatus: 'HIT' };
  }

  const startDate = shiftDateStr(endDate, -(validDays - 1));
  const conditions = [
    eq(lotteryResults.region, region),
    gte(lotteryResults.drawDate, startDate),
    lte(lotteryResults.drawDate, endDate),
  ];
  if (provinceCode && provinceCode.trim().length > 0) {
    conditions.push(eq(lotteryResults.provinceCode, provinceCode));
  }

  const rows = await db
    .select({
      drawDate: lotteryResults.drawDate,
      provinceCode: lotteryResults.provinceCode,
      provinceName: lotteryResults.provinceName,
      prizes: lotteryResults.prizes,
      allTails: lotteryResults.allTails,
      specialTail: lotteryResults.specialTail,
    })
    .from(lotteryResults)
    .where(and(...conditions))
    .orderBy(asc(lotteryResults.drawDate));

  // Group tails by unique drawDate chronologically
  const byDate = new Map<string, Set<string>>();
  const counts: Record<string, number> = {};
  const headCount: Record<string, number> = {};
  const tailCount: Record<string, number> = {};
  const specialHeadCount: Record<string, number> = {};
  const specialTailCount: Record<string, number> = {};
  const specialHistory: SpecialPrizeHistoryItem[] = [];
  const monthBuckets = new Map<
    string,
    { draws: number; sumTotal: number; pairFreq: Record<string, number> }
  >();

  for (let i = 0; i < 100; i++) {
    counts[String(i).padStart(2, '0')] = 0;
  }
  for (let d = 0; d < 10; d++) {
    const k = String(d);
    headCount[k] = 0;
    tailCount[k] = 0;
    specialHeadCount[k] = 0;
    specialTailCount[k] = 0;
  }

  for (const row of rows) {
    let dateSet = byDate.get(row.drawDate);
    if (!dateSet) {
      dateSet = new Set<string>();
      byDate.set(row.drawDate, dateSet);
    }

    const monthKey = row.drawDate.slice(0, 7); // YYYY-MM
    let mBucket = monthBuckets.get(monthKey);
    if (!mBucket) {
      mBucket = { draws: 0, sumTotal: 0, pairFreq: {} };
      monthBuckets.set(monthKey, mBucket);
    }
    mBucket.draws++;

    const tails = Array.isArray(row.allTails) ? row.allTails : [];
    for (const pair of tails) {
      if (pair.length === 2 && counts[pair] !== undefined) {
        counts[pair]++;
        headCount[pair[0]]++;
        tailCount[pair[1]]++;
        dateSet.add(pair);
        mBucket.pairFreq[pair] = (mBucket.pairFreq[pair] || 0) + 1;
      }
    }

    const spTail = row.specialTail || '00';
    if (spTail.length === 2) {
      specialHeadCount[spTail[0]]++;
      specialTailCount[spTail[1]]++;
      const sNum = row.prizes?.db?.[0] || spTail;
      const sum = Number(spTail[0]) + Number(spTail[1]);
      mBucket.sumTotal += sum;

      specialHistory.push({
        drawDate: row.drawDate,
        provinceCode: row.provinceCode,
        provinceName: row.provinceName,
        specialNumber: sNum,
        specialTail: spTail,
        head: spTail[0],
        tail: spTail[1],
        sum,
      });
    }
  }

  // Compute Lo Gan (days since last & max gap across ordered unique dates)
  const sortedDates = Array.from(byDate.keys()).sort();
  const currentGap: Record<string, number> = {};
  const maxGap: Record<string, number> = {};
  const lastSeen: Record<string, string> = {};

  for (let i = 0; i < 100; i++) {
    const p = String(i).padStart(2, '0');
    currentGap[p] = 0;
    maxGap[p] = 0;
    lastSeen[p] = 'Chưa về';
  }

  for (const dStr of sortedDates) {
    const setToday = byDate.get(dStr)!;
    for (let i = 0; i < 100; i++) {
      const p = String(i).padStart(2, '0');
      if (setToday.has(p)) {
        if (currentGap[p] > maxGap[p]) maxGap[p] = currentGap[p];
        currentGap[p] = 0;
        lastSeen[p] = dStr;
      } else {
        currentGap[p]++;
        if (currentGap[p] > maxGap[p]) maxGap[p] = currentGap[p];
      }
    }
  }

  const pairs: StatPairRow[] = Array.from({ length: 100 }, (_, i) => {
    const p = String(i).padStart(2, '0');
    return {
      pair: p,
      count: counts[p],
      daysSinceLast: currentGap[p],
      maxGap: maxGap[p],
      lastSeenDate: lastSeen[p],
    };
  });

  const topHot = [...pairs].sort((a, b) => b.count - a.count).slice(0, 20);
  const topLoGan = [...pairs]
    .sort((a, b) => b.daysSinceLast - a.daysSinceLast || b.maxGap - a.maxGap)
    .slice(0, 20);

  const headTail: HeadTailStat[] = Array.from({ length: 10 }, (_, d) => {
    const k = String(d);
    return {
      digit: k,
      headCount: headCount[k],
      tailCount: tailCount[k],
      specialHeadCount: specialHeadCount[k],
      specialTailCount: specialTailCount[k],
    };
  });

  const monthlySeries = Array.from(monthBuckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24)
    .map(([month, data]) => {
      let topPair = '00';
      let topPairCount = -1;
      for (const [p, c] of Object.entries(data.pairFreq)) {
        if (c > topPairCount) {
          topPairCount = c;
          topPair = p;
        }
      }
      return {
        month,
        draws: data.draws,
        avgSpecialSum: data.draws > 0 ? Number((data.sumTotal / data.draws).toFixed(1)) : 0,
        topPair,
      };
    });

  const result: FullStatisticsResponse = {
    region,
    daysRequested: validDays,
    actualDrawsAnalyzed: rows.length,
    actualDaysCovered: sortedDates.length,
    dateFrom: sortedDates[0] || startDate,
    dateTo: sortedDates[sortedDates.length - 1] || endDate,
    pairs,
    topHot,
    topLoGan,
    headTail,
    specialHistory: specialHistory.reverse().slice(0, 50),
    monthlySeries,
    cacheStatus: 'MISS',
  };

  await cacheService.set(cacheKey, result, 180);
  return result;
}
