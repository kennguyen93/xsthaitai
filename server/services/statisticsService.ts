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

export interface CoOccurrenceStat {
  pairA: string;
  pairB: string;
  count: number;
  lastDate: string;
}

export interface MirrorPairStat {
  pairA: string;
  pairB: string;
  pairLabel: string;
  totalCount: number;
  daysSinceLast: number;
  maxGap: number;
  lastSeenDate: string;
}

export interface RecentDayTails {
  drawDate: string;
  tails: string[];
  specialTail: string;
}

export interface NextDaySpecialStats {
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
  coOccurrences: CoOccurrenceStat[];
  mirrorPairs: MirrorPairStat[];
  recentDays: RecentDayTails[];
  nextDaySpecial: NextDaySpecialStats;
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
  const cacheKey = `xoso365:stats:v2:${region}:${endDate}:${validDays}:${provinceCode || 'ALL'}`;

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
  const dateSpecialTail = new Map<string, string>();
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
      dateSpecialTail.set(row.drawDate, spTail);
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

  // Compute 45 mirror pairs (AB - BA, where A < B)
  const mirrorPairs: MirrorPairStat[] = [];
  for (let a = 0; a < 10; a++) {
    for (let b = a + 1; b < 10; b++) {
      const pairA = `${a}${b}`;
      const pairB = `${b}${a}`;
      let curGap = 0;
      let mGap = 0;
      let lastDate = 'Chưa về';
      for (const dStr of sortedDates) {
        const setToday = byDate.get(dStr)!;
        if (setToday.has(pairA) || setToday.has(pairB)) {
          if (curGap > mGap) mGap = curGap;
          curGap = 0;
          lastDate = dStr;
        } else {
          curGap++;
          if (curGap > mGap) mGap = curGap;
        }
      }
      mirrorPairs.push({
        pairA,
        pairB,
        pairLabel: `${pairA} - ${pairB}`,
        totalCount: counts[pairA] + counts[pairB],
        daysSinceLast: curGap,
        maxGap: mGap,
        lastSeenDate: lastDate,
      });
    }
  }
  mirrorPairs.sort((a, b) => b.totalCount - a.totalCount || a.daysSinceLast - b.daysSinceLast);

  // Compute top co-occurring pairs in the same draw day (up to last 365 dates for speed)
  const coMap = new Map<string, { count: number; lastDate: string }>();
  const coWindowDates = sortedDates.slice(-365);
  for (const dStr of coWindowDates) {
    const uniqueTails = Array.from(byDate.get(dStr)!).sort();
    for (let i = 0; i < uniqueTails.length; i++) {
      for (let j = i + 1; j < uniqueTails.length; j++) {
        const key = `${uniqueTails[i]}|${uniqueTails[j]}`;
        const existing = coMap.get(key);
        if (existing) {
          existing.count++;
          existing.lastDate = dStr;
        } else {
          coMap.set(key, { count: 1, lastDate: dStr });
        }
      }
    }
  }
  const coOccurrences: CoOccurrenceStat[] = Array.from(coMap.entries())
    .map(([key, val]) => {
      const [pairA, pairB] = key.split('|');
      return { pairA, pairB, count: val.count, lastDate: val.lastDate };
    })
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, 30);

  // Recent 20 days matrix for "Thống kê tần suất loto"
  const recentDays: RecentDayTails[] = sortedDates
    .slice(-20)
    .reverse()
    .map((dStr) => ({
      drawDate: dStr,
      tails: Array.from(byDate.get(dStr)!).sort(),
      specialTail: dateSpecialTail.get(dStr) || '',
    }));

  // Compute "Thống kê giải đặc biệt ngày mai" based on latest Special Prize 2-digit tail
  const latestSpecial = specialHistory[specialHistory.length - 1];
  const triggerTail = latestSpecial?.specialTail || '';
  const triggerDate = latestSpecial?.drawDate || '';
  const nextTailCounts: Record<string, number> = {};
  const nextHeadCounts: Record<string, number> = {};
  const nextTailDigitCounts: Record<string, number> = {};
  const nextHistory: NextDaySpecialStats['history'] = [];

  if (triggerTail && specialHistory.length > 1) {
    for (let i = 0; i < specialHistory.length - 1; i++) {
      if (specialHistory[i].specialTail === triggerTail) {
        const nxt = specialHistory[i + 1];
        nextTailCounts[nxt.specialTail] = (nextTailCounts[nxt.specialTail] || 0) + 1;
        nextHeadCounts[nxt.head] = (nextHeadCounts[nxt.head] || 0) + 1;
        nextTailDigitCounts[nxt.tail] = (nextTailDigitCounts[nxt.tail] || 0) + 1;
        nextHistory.push({
          triggerDate: specialHistory[i].drawDate,
          nextDate: nxt.drawDate,
          nextSpecial: nxt.specialNumber,
          nextTail: nxt.specialTail,
        });
      }
    }
  }

  const nextDaySpecial: NextDaySpecialStats = {
    triggerTail,
    triggerDate,
    sampleCount: nextHistory.length,
    nextTails: Object.entries(nextTailCounts)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    nextHeads: Array.from({ length: 10 }, (_, d) => ({
      digit: String(d),
      count: nextHeadCounts[String(d)] || 0,
    })).sort((a, b) => b.count - a.count),
    nextTailsDigit: Array.from({ length: 10 }, (_, d) => ({
      digit: String(d),
      count: nextTailDigitCounts[String(d)] || 0,
    })).sort((a, b) => b.count - a.count),
    history: nextHistory.reverse().slice(0, 25),
  };

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
    coOccurrences,
    mirrorPairs,
    recentDays,
    nextDaySpecial,
    cacheStatus: 'MISS',
  };

  await cacheService.set(cacheKey, result, 180);
  return result;
}
