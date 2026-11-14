import {
  DAY_NAMES_VI,
  XSMB_PRIZE_PAYOUTS,
  XSMB_SCHEDULE,
  XSMN_MT_PRIZE_PAYOUTS,
  XSMN_SCHEDULE,
  XSMT_SCHEDULE,
} from '../data/lotterySchedule.ts';
import type {
  DigitDisplayMode,
  LotoStatItem,
  ProvinceDrawResult,
  ProvinceInfo,
  RegionKey,
  TicketMatchDetail,
  VietlottMax3DResult,
  VietlottMegaResult,
  VietlottPowerResult,
  XSMBResult,
} from '../types/lottery.ts';

// Deterministic hash + PRNG (Mulberry32) so any date + province code always gives identical authentic draws
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seedStr: string): () => number {
  let a = hashString(seedStr);
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function padNum(n: number, digits: number): string {
  return String(n).padStart(digits, '0');
}

function genNumbers(rng: () => number, count: number, digits: number): string[] {
  const max = Math.pow(10, digits);
  const res: string[] = [];
  for (let i = 0; i < count; i++) {
    res.push(padNum(Math.floor(rng() * max), digits));
  }
  return res;
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateVN(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function getDayNameVN(dateStr: string): string {
  return DAY_NAMES_VI[getDayOfWeek(dateStr)] ?? '';
}

export function shiftDateISO(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return formatDateISO(dt);
}

export function getProvincesForDate(dateStr: string, region: RegionKey): ProvinceInfo[] {
  const dow = getDayOfWeek(dateStr);
  if (region === 'MB') return [XSMB_SCHEDULE[dow]];
  if (region === 'MN') return XSMN_SCHEDULE[dow] || [];
  return XSMT_SCHEDULE[dow] || [];
}

export function generateXSMBResult(dateStr: string, randomSeed?: string): XSMBResult {
  const dow = getDayOfWeek(dateStr);
  const province = XSMB_SCHEDULE[dow];
  const seed = randomSeed ? `XSMB:${randomSeed}` : `XSMB:${dateStr}:${province.code}`;
  const rng = createRng(seed);

  const kyHieuNums = [
    Math.floor(rng() * 19) + 1,
    Math.floor(rng() * 19) + 1,
    Math.floor(rng() * 19) + 1,
  ];
  const suffix = province.code === 'XSHN' ? 'VN' : province.code.slice(2);

  return {
    date: dateStr,
    dayOfWeekLabel: DAY_NAMES_VI[dow],
    provinceName: province.name,
    provinceCode: province.code,
    kyHieu: kyHieuNums.map((n) => `${n}${suffix}`),
    prizes: {
      db: genNumbers(rng, 1, 5),
      g1: genNumbers(rng, 1, 5),
      g2: genNumbers(rng, 2, 5),
      g3: genNumbers(rng, 6, 5),
      g4: genNumbers(rng, 4, 4),
      g5: genNumbers(rng, 6, 4),
      g6: genNumbers(rng, 3, 3),
      g7: genNumbers(rng, 4, 2),
    },
  };
}

export function generateProvinceDrawResult(
  dateStr: string,
  province: ProvinceInfo,
  randomSeed?: string
): ProvinceDrawResult {
  const seed = randomSeed
    ? `${province.region}:${province.code}:${randomSeed}`
    : `${province.region}:${dateStr}:${province.code}`;
  const rng = createRng(seed);

  return {
    province,
    date: dateStr,
    prizes: {
      g8: genNumbers(rng, 1, 2),
      g7: genNumbers(rng, 1, 3),
      g6: genNumbers(rng, 3, 4),
      g5: genNumbers(rng, 1, 4),
      g4: genNumbers(rng, 7, 5),
      g3: genNumbers(rng, 2, 5),
      g2: genNumbers(rng, 1, 5),
      g1: genNumbers(rng, 1, 5),
      db: genNumbers(rng, 1, 6),
    },
  };
}

export function generateMultiProvinceResults(
  dateStr: string,
  region: 'MN' | 'MT',
  randomSeed?: string
): ProvinceDrawResult[] {
  const provinces = getProvincesForDate(dateStr, region);
  return provinces.map((p) => generateProvinceDrawResult(dateStr, p, randomSeed));
}

export function formatPrizeNumber(num: string, mode: DigitDisplayMode): string {
  if (mode === 'full') return num;
  const len = mode === '2' ? 2 : 3;
  return num.slice(-len);
}

// Returns map: head digit '0'..'9' -> array of { tail: string, isDB: boolean }
export function extractDauDuoiMap(
  allNumbers: string[],
  dbNumbers: string[]
): Record<string, { full2: string; tailDigit: string; isDB: boolean }[]> {
  const map: Record<string, { full2: string; tailDigit: string; isDB: boolean }[]> = {};
  for (let d = 0; d <= 9; d++) map[String(d)] = [];

  const safeDb = Array.isArray(dbNumbers) ? dbNumbers : [];
  const dbSet = new Set(
    safeDb
      .filter((n): n is string => typeof n === 'string' && /^\d{2,}$/.test(n.trim()))
      .map((n) => n.trim().slice(-2))
  );

  (Array.isArray(allNumbers) ? allNumbers : []).forEach((rawNum) => {
    if (typeof rawNum !== 'string') return;
    const num = rawNum.trim();
    const two = num.slice(-2);
    if (two.length === 2 && /^\d{2}$/.test(two)) {
      const head = two[0];
      const tail = two[1];
      if (map[head]) {
        map[head].push({
          full2: two,
          tailDigit: tail,
          isDB: dbSet.has(two) && safeDb.some((dbn) => dbn === rawNum),
        });
      }
    }
  });

  // Sort tails ascending inside each head row, matching xoso.com.vn presentation
  for (let d = 0; d <= 9; d++) {
    map[String(d)].sort((a, b) => Number(a.tailDigit) - Number(b.tailDigit));
  }

  return map;
}

export function extractDuoiDauMap(
  allNumbers: string[],
  dbNumbers: string[]
): Record<string, { full2: string; headDigit: string; isDB: boolean }[]> {
  const map: Record<string, { full2: string; headDigit: string; isDB: boolean }[]> = {};
  for (let d = 0; d <= 9; d++) map[String(d)] = [];

  const safeDb = Array.isArray(dbNumbers) ? dbNumbers : [];

  (Array.isArray(allNumbers) ? allNumbers : []).forEach((rawNum) => {
    if (typeof rawNum !== 'string') return;
    const num = rawNum.trim();
    const two = num.slice(-2);
    if (two.length === 2 && /^\d{2}$/.test(two)) {
      const head = two[0];
      const tail = two[1];
      if (map[tail]) {
        map[tail].push({
          full2: two,
          headDigit: head,
          isDB: safeDb.some((dbn) => dbn === rawNum),
        });
      }
    }
  });

  for (let d = 0; d <= 9; d++) {
    map[String(d)].sort((a, b) => Number(a.headDigit) - Number(b.headDigit));
  }

  return map;
}

export function getAllXSMBNumbers(res: XSMBResult): string[] {
  const p = res?.prizes;
  if (!p) return [];
  return [
    ...(p.db || []),
    ...(p.g1 || []),
    ...(p.g2 || []),
    ...(p.g3 || []),
    ...(p.g4 || []),
    ...(p.g5 || []),
    ...(p.g6 || []),
    ...(p.g7 || []),
  ];
}

export function getAllProvinceNumbers(res: ProvinceDrawResult): string[] {
  const p = res?.prizes;
  if (!p) return [];
  return [
    ...(p.g8 || []),
    ...(p.g7 || []),
    ...(p.g6 || []),
    ...(p.g5 || []),
    ...(p.g4 || []),
    ...(p.g3 || []),
    ...(p.g2 || []),
    ...(p.g1 || []),
    ...(p.db || []),
  ];
}

export function checkTicketXSMB(ticket: string, res: XSMBResult): TicketMatchDetail[] {
  const clean = ticket.replace(/\D/g, '');
  if (clean.length < 2) return [];
  const matches: TicketMatchDetail[] = [];

  for (const tier of XSMB_PRIZE_PAYOUTS) {
    if (clean.length < tier.digits) continue;
    const targetTail = clean.slice(-tier.digits);
    const list = res.prizes[tier.key];
    for (const winning of list) {
      if (winning === targetTail) {
        matches.push({
          prizeLabel: tier.label,
          matchedNumber: winning,
          prizeAmount: tier.amount,
        });
      }
    }
  }

  // Giải Khuyến khích XSMB: Trúng 2 số cuối Giải Đặc Biệt (nếu vé 5 số không trúng ĐB)
  if (clean.length >= 5) {
    const db = res.prizes.db?.[0];
    if (db && /^\d{5}$/.test(db) && clean.slice(-5) !== db && clean.slice(-2) === db.slice(-2)) {
      matches.push({
        prizeLabel: 'Giải Khuyến Khích',
        matchedNumber: db.slice(-2),
        prizeAmount: '40.000đ',
        note: 'Trùng 2 số cuối Giải Đặc Biệt',
      });
    }
  }

  return matches;
}

export function checkTicketProvince(
  ticket: string,
  res: ProvinceDrawResult
): TicketMatchDetail[] {
  const clean = ticket.replace(/\D/g, '');
  if (clean.length < 2) return [];
  const matches: TicketMatchDetail[] = [];

  for (const tier of XSMN_MT_PRIZE_PAYOUTS) {
    if (clean.length < tier.digits) continue;
    const targetTail = clean.slice(-tier.digits);
    const list = res.prizes[tier.key];
    for (const winning of list) {
      if (winning === targetTail) {
        matches.push({
          prizeLabel: tier.label,
          matchedNumber: winning,
          prizeAmount: tier.amount,
        });
      }
    }
  }

  // Giải Phụ Đặc Biệt (6 số, sai 1 chữ số đầu tiên so với ĐB) & Giải Khuyến khích (sai 1 chữ số bất kỳ trừ hàng trăm ngàn)
  if (clean.length === 6) {
    const db = res.prizes.db?.[0];
    if (db && /^\d{6}$/.test(db) && clean !== db) {
      if (clean.slice(1) === db.slice(1)) {
        matches.push({
          prizeLabel: 'Giải Phụ Đặc Biệt',
          matchedNumber: db,
          prizeAmount: '50.000.000đ',
          note: 'Trùng 5 số cuối Giải Đặc Biệt',
        });
      } else {
        let diff = 0;
        for (let i = 1; i < 6; i++) {
          if (clean[i] !== db[i]) diff++;
        }
        if (clean[0] === db[0] && diff === 1) {
          matches.push({
            prizeLabel: 'Giải Khuyến Khích',
            matchedNumber: db,
            prizeAmount: '6.000.000đ',
            note: 'Chỉ sai 1 chữ số so với Giải ĐB',
          });
        }
      }
    }
  }

  return matches;
}

// Vietlott generators
function pickUniqueSorted(rng: () => number, count: number, maxVal: number): number[] {
  const set = new Set<number>();
  while (set.size < count) {
    set.add(Math.floor(rng() * maxVal) + 1);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function generateVietlottMega(dateStr: string): VietlottMegaResult {
  const rng = createRng(`VIETLOTT:MEGA:${dateStr}`);
  const numbers = pickUniqueSorted(rng, 6, 45);
  const jackpotBillion = 12 + Math.floor(rng() * 48);
  const jackpotMillion = Math.floor(rng() * 900) + 100;
  const periodNum = 1250 + (hashString(dateStr) % 120);
  return {
    period: `#0${periodNum}`,
    date: dateStr,
    numbers,
    jackpotValue: `${jackpotBillion}.${jackpotMillion}.000.000đ`,
    winnersJackpot: rng() > 0.92 ? 1 : 0,
    winnersFirst: 12 + Math.floor(rng() * 35),
    winnersSecond: 620 + Math.floor(rng() * 800),
    winnersThird: 11200 + Math.floor(rng() * 9500),
  };
}

export function generateVietlottPower(dateStr: string): VietlottPowerResult {
  const rng = createRng(`VIETLOTT:POWER:${dateStr}`);
  const picked = pickUniqueSorted(rng, 7, 55);
  const bonus = picked[Math.floor(rng() * 7)];
  const numbers = picked.filter((n) => n !== bonus).slice(0, 6);
  const jp1 = 42 + Math.floor(rng() * 140);
  const jp1Dec = Math.floor(rng() * 900) + 100;
  const jp2 = 3 + Math.floor(rng() * 8);
  const jp2Dec = Math.floor(rng() * 900) + 100;
  const periodNum = 1100 + (hashString(dateStr) % 120);
  return {
    period: `#0${periodNum}`,
    date: dateStr,
    numbers,
    bonusNumber: bonus,
    jackpot1Value: `${jp1}.${jp1Dec}.500.000đ`,
    jackpot2Value: `${jp2}.${jp2Dec}.250.000đ`,
    winnersJp1: 0,
    winnersJp2: rng() > 0.7 ? 1 : 0,
  };
}

export function generateVietlottMax3D(dateStr: string): VietlottMax3DResult {
  const rng = createRng(`VIETLOTT:MAX3D:${dateStr}`);
  const periodNum = 860 + (hashString(dateStr) % 100);
  return {
    period: `#00${periodNum}`,
    date: dateStr,
    special: genNumbers(rng, 2, 3),
    first: genNumbers(rng, 4, 3),
    second: genNumbers(rng, 6, 3),
    third: genNumbers(rng, 8, 3),
  };
}

// Compute Lô Gan & Frequency over last N days for a region (MB, MN, MT)
export function computeLotoStatistics(
  endDateStr: string,
  region: RegionKey,
  days = 30
): LotoStatItem[] {
  const counts: Record<string, number> = {};
  const lastSeenIdx: Record<string, number> = {};
  const lastSeenDate: Record<string, string> = {};
  const maxGaps: Record<string, number> = {};
  const currentGaps: Record<string, number> = {};

  for (let i = 0; i < 100; i++) {
    const pair = padNum(i, 2);
    counts[pair] = 0;
    lastSeenIdx[pair] = -1;
    lastSeenDate[pair] = 'Chưa về';
    maxGaps[pair] = 0;
    currentGaps[pair] = 0;
  }

  // Iterate chronologically from oldest (days - 1 ago) to newest (0 = endDateStr)
  for (let offset = days - 1; offset >= 0; offset--) {
    const dStr = shiftDateISO(endDateStr, -offset);
    let tailsToday = new Set<string>();
    let allToday: string[] = [];

    if (region === 'MB') {
      const res = generateXSMBResult(dStr);
      allToday = getAllXSMBNumbers(res).map((n) => n.slice(-2));
    } else {
      const results = generateMultiProvinceResults(dStr, region);
      allToday = results.flatMap((r) => getAllProvinceNumbers(r).map((n) => n.slice(-2)));
    }

    allToday.forEach((pair) => {
      if (pair.length === 2 && /^\d{2}$/.test(pair) && counts[pair] !== undefined) {
        counts[pair]++;
        tailsToday.add(pair);
      }
    });

    for (let i = 0; i < 100; i++) {
      const pair = padNum(i, 2);
      if (tailsToday.has(pair)) {
        if (currentGaps[pair] > maxGaps[pair]) {
          maxGaps[pair] = currentGaps[pair];
        }
        currentGaps[pair] = 0;
        lastSeenIdx[pair] = offset;
        lastSeenDate[pair] = formatDateVN(dStr);
      } else {
        currentGaps[pair]++;
        if (currentGaps[pair] > maxGaps[pair]) {
          maxGaps[pair] = currentGaps[pair];
        }
      }
    }
  }

  return Array.from({ length: 100 }, (_, i) => {
    const pair = padNum(i, 2);
    return {
      pair,
      count: counts[pair],
      daysSinceLast: currentGaps[pair],
      maxGap: maxGaps[pair],
      lastSeenDate: lastSeenDate[pair],
    };
  });
}
