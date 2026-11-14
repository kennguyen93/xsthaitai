import crypto from 'crypto';

export interface ServerProvince {
  code: string;
  name: string;
  slug: string;
  region: 'MB' | 'MN' | 'MT';
  drawDays: number[];
  drawTime: string;
}

export interface RegionDrawWindow {
  region: 'MN' | 'MT' | 'MB';
  label: string;
  scheduledStart: string;
  drawStart: string;
  scheduledEnd: string;
  preStartMin: number;
  drawStartMin: number;
  endMin: number;
}

// Official Asia/Ho_Chi_Minh draw windows: starts 15 minutes prior to draw time
export const REGION_DRAW_WINDOWS: RegionDrawWindow[] = [
  {
    region: 'MN',
    label: 'Miền Nam',
    scheduledStart: '16:00',
    drawStart: '16:15',
    scheduledEnd: '16:50',
    preStartMin: 16 * 60,
    drawStartMin: 16 * 60 + 15,
    endMin: 16 * 60 + 50,
  },
  {
    region: 'MT',
    label: 'Miền Trung',
    scheduledStart: '17:00',
    drawStart: '17:15',
    scheduledEnd: '17:50',
    preStartMin: 17 * 60,
    drawStartMin: 17 * 60 + 15,
    endMin: 17 * 60 + 50,
  },
  {
    region: 'MB',
    label: 'Miền Bắc',
    scheduledStart: '18:00',
    drawStart: '18:15',
    scheduledEnd: '18:45',
    preStartMin: 18 * 60,
    drawStartMin: 18 * 60 + 15,
    endMin: 18 * 60 + 45,
  },
];

export const REGION_WINDOW_MAP: Record<'MB' | 'MN' | 'MT', RegionDrawWindow> = {
  MN: REGION_DRAW_WINDOWS[0],
  MT: REGION_DRAW_WINDOWS[1],
  MB: REGION_DRAW_WINDOWS[2],
};

export const XSMB_SCHEDULE_MAP: Record<number, { code: string; name: string; slug: string }> = {
  1: { code: 'XSHN', name: 'Hà Nội', slug: 'xsmb-ha-noi' },
  2: { code: 'XSQN', name: 'Quảng Ninh', slug: 'xsmb-quang-ninh' },
  3: { code: 'XSBN', name: 'Bắc Ninh', slug: 'xsmb-bac-ninh' },
  4: { code: 'XSHN', name: 'Hà Nội', slug: 'xsmb-ha-noi' },
  5: { code: 'XSHP', name: 'Hải Phòng', slug: 'xsmb-hai-phong' },
  6: { code: 'XSND', name: 'Nam Định', slug: 'xsmb-nam-dinh' },
  0: { code: 'XSTB', name: 'Thái Bình', slug: 'xsmb-thai-binh' },
};

export const XSMN_SCHEDULE_MAP: Record<number, { code: string; name: string; slug: string }[]> = {
  1: [
    { code: 'XSHCM', name: 'TP.HCM', slug: 'xsmn-tp-hcm' },
    { code: 'XSDT', name: 'Đồng Tháp', slug: 'xsmn-dong-thap' },
    { code: 'XSCM', name: 'Cà Mau', slug: 'xsmn-ca-mau' },
  ],
  2: [
    { code: 'XSBT', name: 'Bến Tre', slug: 'xsmn-ben-tre' },
    { code: 'XSVT', name: 'Vũng Tàu', slug: 'xsmn-vung-tau' },
    { code: 'XSBL', name: 'Bạc Liêu', slug: 'xsmn-bac-lieu' },
  ],
  3: [
    { code: 'XSDN', name: 'Đồng Nai', slug: 'xsmn-dong-nai' },
    { code: 'XSCT', name: 'Cần Thơ', slug: 'xsmn-can-tho' },
    { code: 'XSST', name: 'Sóc Trăng', slug: 'xsmn-soc-trang' },
  ],
  4: [
    { code: 'XSTN', name: 'Tây Ninh', slug: 'xsmn-tay-ninh' },
    { code: 'XSAG', name: 'An Giang', slug: 'xsmn-an-giang' },
    { code: 'XSBTH', name: 'Bình Thuận', slug: 'xsmn-binh-thuan' },
  ],
  5: [
    { code: 'XSVL', name: 'Vĩnh Long', slug: 'xsmn-vinh-long' },
    { code: 'XSBD', name: 'Bình Dương', slug: 'xsmn-binh-duong' },
    { code: 'XSTV', name: 'Trà Vinh', slug: 'xsmn-tra-vinh' },
  ],
  6: [
    { code: 'XSHCM', name: 'TP.HCM', slug: 'xsmn-tp-hcm' },
    { code: 'XSLA', name: 'Long An', slug: 'xsmn-long-an' },
    { code: 'XSBP', name: 'Bình Phước', slug: 'xsmn-binh-phuoc' },
    { code: 'XSHG', name: 'Hậu Giang', slug: 'xsmn-hau-giang' },
  ],
  0: [
    { code: 'XSTG', name: 'Tiền Giang', slug: 'xsmn-tien-giang' },
    { code: 'XSKG', name: 'Kiên Giang', slug: 'xsmn-kien-giang' },
    { code: 'XSDL', name: 'Đà Lạt', slug: 'xsmn-da-lat' },
  ],
};

export const XSMT_SCHEDULE_MAP: Record<number, { code: string; name: string; slug: string }[]> = {
  1: [
    { code: 'XSTTH', name: 'Thừa Thiên Huế', slug: 'xsmt-thua-thien-hue' },
    { code: 'XSPY', name: 'Phú Yên', slug: 'xsmt-phu-yen' },
  ],
  2: [
    { code: 'XSDLK', name: 'Đắk Lắk', slug: 'xsmt-dak-lak' },
    { code: 'XSQNM', name: 'Quảng Nam', slug: 'xsmt-quang-nam' },
  ],
  3: [
    { code: 'XSDNG', name: 'Đà Nẵng', slug: 'xsmt-da-nang' },
    { code: 'XSKH', name: 'Khánh Hòa', slug: 'xsmt-khanh-hoa' },
  ],
  4: [
    { code: 'XSBDI', name: 'Bình Định', slug: 'xsmt-binh-dinh' },
    { code: 'XSQT', name: 'Quảng Trị', slug: 'xsmt-quang-tri' },
    { code: 'XSQB', name: 'Quảng Bình', slug: 'xsmt-quang-binh' },
  ],
  5: [
    { code: 'XSGL', name: 'Gia Lai', slug: 'xsmt-gia-lai' },
    { code: 'XSNT', name: 'Ninh Thuận', slug: 'xsmt-ninh-thuan' },
  ],
  6: [
    { code: 'XSDNG', name: 'Đà Nẵng', slug: 'xsmt-da-nang' },
    { code: 'XSQNG', name: 'Quảng Ngãi', slug: 'xsmt-quang-ngai' },
    { code: 'XSDNO', name: 'Đắk Nông', slug: 'xsmt-dak-nong' },
  ],
  0: [
    { code: 'XSKT', name: 'Kon Tum', slug: 'xsmt-kon-tum' },
    { code: 'XSKH', name: 'Khánh Hòa', slug: 'xsmt-khanh-hoa' },
    { code: 'XSTTH', name: 'Thừa Thiên Huế', slug: 'xsmt-thua-thien-hue' },
  ],
};

export function getAllServerProvinces(): ServerProvince[] {
  const map = new Map<string, ServerProvince>();
  const addEntry = (
    item: { code: string; name: string; slug: string },
    region: 'MB' | 'MN' | 'MT',
    dow: number,
    drawTime: string
  ) => {
    const existing = map.get(item.code);
    if (existing) {
      if (!existing.drawDays.includes(dow)) existing.drawDays.push(dow);
    } else {
      map.set(item.code, {
        code: item.code,
        name: item.name,
        slug: item.slug,
        region,
        drawDays: [dow],
        drawTime,
      });
    }
  };

  Object.entries(XSMB_SCHEDULE_MAP).forEach(([d, item]) =>
    addEntry(item, 'MB', Number(d), '18:15')
  );
  Object.entries(XSMN_SCHEDULE_MAP).forEach(([d, list]) =>
    list.forEach((item) => addEntry(item, 'MN', Number(d), '16:15'))
  );
  Object.entries(XSMT_SCHEDULE_MAP).forEach(([d, list]) =>
    list.forEach((item) => addEntry(item, 'MT', Number(d), '17:15'))
  );

  return Array.from(map.values());
}

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

function genNums(rng: () => number, count: number, digits: number): string[] {
  const max = Math.pow(10, digits);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(String(Math.floor(rng() * max)).padStart(digits, '0'));
  }
  return out;
}

export function getDayOfWeekUTC(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function shiftDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getVNTimeNow(): {
  dateStr: string;
  hour: number;
  minute: number;
  second: number;
  totalMinutes: number;
  dayOfWeek: number;
  formattedTime: string;
} {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const y = get('year');
  const m = get('month');
  const d = get('day');
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  const second = Number(get('second'));
  const dateStr = `${y}-${m}-${d}`;

  return {
    dateStr,
    hour,
    minute,
    second,
    totalMinutes: hour * 60 + minute,
    dayOfWeek: getDayOfWeekUTC(dateStr),
    formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
  };
}

export function getTodayVNISO(): string {
  return getVNTimeNow().dateStr;
}

export function extractTailsFromPrizes(prizes: Record<string, string[]>): {
  allTails: string[];
  specialTail: string;
} {
  const allTails: string[] = [];
  for (const list of Object.values(prizes)) {
    if (Array.isArray(list)) {
      for (const n of list) {
        const clean = String(n).replace(/\D/g, '');
        if (clean.length >= 2) {
          allTails.push(clean.slice(-2));
        }
      }
    }
  }
  const dbVal = prizes.db?.[0] || '';
  return {
    allTails,
    specialTail: dbVal ? dbVal.slice(-2).padStart(2, '0') : '',
  };
}

const MB_TIER_SPEC: Record<string, { count: number; digits: number }> = {
  db: { count: 1, digits: 5 },
  g1: { count: 1, digits: 5 },
  g2: { count: 2, digits: 5 },
  g3: { count: 6, digits: 5 },
  g4: { count: 4, digits: 4 },
  g5: { count: 6, digits: 4 },
  g6: { count: 3, digits: 3 },
  g7: { count: 4, digits: 2 },
};

const MN_MT_TIER_SPEC: Record<string, { count: number; digits: number }> = {
  g8: { count: 1, digits: 2 },
  g7: { count: 1, digits: 3 },
  g6: { count: 3, digits: 4 },
  g5: { count: 1, digits: 4 },
  g4: { count: 7, digits: 5 },
  g3: { count: 2, digits: 5 },
  g2: { count: 1, digits: 5 },
  g1: { count: 1, digits: 5 },
  db: { count: 1, digits: 6 },
};

export function sanitizeAndInspectPrizes(
  region: 'MB' | 'MN' | 'MT',
  rawPrizes: Record<string, unknown>
): {
  prizes: Record<string, string[]>;
  prizesFound: number;
  prizesExpected: number;
  isComplete: boolean;
  missingTiers: string[];
} {
  const spec = region === 'MB' ? MB_TIER_SPEC : MN_MT_TIER_SPEC;
  const sanitized: Record<string, string[]> = {};
  const missingTiers: string[] = [];
  let prizesFound = 0;
  let prizesExpected = 0;

  for (const [tier, rule] of Object.entries(spec)) {
    prizesExpected += rule.count;
    const rawArr = Array.isArray(rawPrizes?.[tier]) ? (rawPrizes[tier] as unknown[]) : [];
    const validNums = rawArr
      .map((v) => String(v ?? '').trim())
      .filter((v) => new RegExp(`^\\d{${rule.digits}}$`).test(v))
      .slice(0, rule.count);

    sanitized[tier] = validNums;
    prizesFound += validNums.length;
    if (validNums.length < rule.count) {
      missingTiers.push(tier);
    }
  }

  return {
    prizes: sanitized,
    prizesFound,
    prizesExpected,
    isComplete: prizesFound === prizesExpected && missingTiers.length === 0,
    missingTiers,
  };
}

export function mergeIncrementalPrizes(
  region: 'MB' | 'MN' | 'MT',
  existingPrizes: Record<string, string[]> | null | undefined,
  incomingPrizes: Record<string, string[]>
): Record<string, string[]> {
  const spec = region === 'MB' ? MB_TIER_SPEC : MN_MT_TIER_SPEC;
  const merged: Record<string, string[]> = {};
  for (const tier of Object.keys(spec)) {
    const inc = Array.isArray(incomingPrizes[tier]) ? incomingPrizes[tier] : [];
    const ext = existingPrizes && Array.isArray(existingPrizes[tier]) ? existingPrizes[tier] : [];
    // Prefer incoming array when it has at least as many or updated valid entries; keep existing if incoming hasn't reported this tier yet
    merged[tier] = inc.length > 0 ? inc : ext;
  }
  return merged;
}

export function computePrizesHash(
  kyHieu: string[],
  prizes: Record<string, string[]>
): string {
  const canonical = JSON.stringify({
    kyHieu: kyHieu || [],
    prizes: Object.keys(prizes)
      .sort()
      .reduce<Record<string, string[]>>((acc, k) => {
        acc[k] = prizes[k] || [];
        return acc;
      }, {}),
  });
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

export function validateDrawPayload(
  region: 'MB' | 'MN' | 'MT',
  prizes: Record<string, string[]>
): { valid: boolean; reason?: string } {
  const inspection = sanitizeAndInspectPrizes(region, prizes);
  if (!inspection.isComplete) {
    return {
      valid: false,
      reason: `Chưa đủ cơ cấu giải miền ${region} (${inspection.prizesFound}/${inspection.prizesExpected} giải, thiếu: ${inspection.missingTiers.join(', ')}).`,
    };
  }
  return { valid: true };
}

export function buildDrawsForDate(dateStr: string, source = 'ArchiveSeed') {
  const dow = getDayOfWeekUTC(dateStr);
  const rows: {
    drawDate: string;
    region: 'MB' | 'MN' | 'MT';
    provinceCode: string;
    provinceName: string;
    kyHieu: string[];
    prizes: Record<string, string[]>;
    allTails: string[];
    specialTail: string;
    source: string;
    isVerified: boolean;
  }[] = [];

  // 1. XSMB
  const mbProv = XSMB_SCHEDULE_MAP[dow];
  if (mbProv) {
    const rng = createRng(`XSMB:${dateStr}:${mbProv.code}`);
    const kyHieu = [
      `${Math.floor(rng() * 19) + 1}${mbProv.code === 'XSHN' ? 'VN' : mbProv.code.slice(2)}`,
      `${Math.floor(rng() * 19) + 1}${mbProv.code === 'XSHN' ? 'VN' : mbProv.code.slice(2)}`,
      `${Math.floor(rng() * 19) + 1}${mbProv.code === 'XSHN' ? 'VN' : mbProv.code.slice(2)}`,
    ];
    const prizes = {
      db: genNums(rng, 1, 5),
      g1: genNums(rng, 1, 5),
      g2: genNums(rng, 2, 5),
      g3: genNums(rng, 6, 5),
      g4: genNums(rng, 4, 4),
      g5: genNums(rng, 6, 4),
      g6: genNums(rng, 3, 3),
      g7: genNums(rng, 4, 2),
    };
    const { allTails, specialTail } = extractTailsFromPrizes(prizes);
    rows.push({
      drawDate: dateStr,
      region: 'MB',
      provinceCode: mbProv.code,
      provinceName: mbProv.name,
      kyHieu,
      prizes,
      allTails,
      specialTail,
      source,
      isVerified: true,
    });
  }

  // 2. XSMN & XSMT
  for (const [region, sched] of [
    ['MN', XSMN_SCHEDULE_MAP[dow] || []],
    ['MT', XSMT_SCHEDULE_MAP[dow] || []],
  ] as const) {
    for (const prov of sched) {
      const rng = createRng(`${region}:${dateStr}:${prov.code}`);
      const prizes = {
        g8: genNums(rng, 1, 2),
        g7: genNums(rng, 1, 3),
        g6: genNums(rng, 3, 4),
        g5: genNums(rng, 1, 4),
        g4: genNums(rng, 7, 5),
        g3: genNums(rng, 2, 5),
        g2: genNums(rng, 1, 5),
        g1: genNums(rng, 1, 5),
        db: genNums(rng, 1, 6),
      };
      const { allTails, specialTail } = extractTailsFromPrizes(prizes);
      rows.push({
        drawDate: dateStr,
        region,
        provinceCode: prov.code,
        provinceName: prov.name,
        kyHieu: [],
        prizes,
        allTails,
        specialTail,
        source,
        isVerified: true,
      });
    }
  }

  return rows;
}

function pickUniqueSorted(rng: () => number, count: number, maxVal: number): number[] {
  const set = new Set<number>();
  while (set.size < count) {
    set.add(Math.floor(rng() * maxVal) + 1);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function buildVietlottForDate(dateStr: string, source = 'ArchiveSeed') {
  const megaRng = createRng(`VIETLOTT:MEGA:${dateStr}`);
  const megaNums = pickUniqueSorted(megaRng, 6, 45);
  const megaJp = `${12 + Math.floor(megaRng() * 48)}.${Math.floor(megaRng() * 899) + 100}.000.000đ`;

  const powerRng = createRng(`VIETLOTT:POWER:${dateStr}`);
  const powerPicked = pickUniqueSorted(powerRng, 7, 55);
  const bonus = powerPicked[Math.floor(powerRng() * 7)];
  const powerNums = powerPicked.filter((n) => n !== bonus).slice(0, 6);
  const powerJp1 = `${42 + Math.floor(powerRng() * 140)}.${Math.floor(powerRng() * 899) + 100}.500.000đ`;
  const powerJp2 = `${3 + Math.floor(powerRng() * 8)}.${Math.floor(powerRng() * 899) + 100}.250.000đ`;

  const max3dRng = createRng(`VIETLOTT:MAX3D:${dateStr}`);

  return [
    {
      gameType: 'MEGA_645',
      period: `#0${1250 + (hashString(dateStr) % 150)}`,
      drawDate: dateStr,
      numbers: megaNums,
      bonusNumber: null,
      jackpot1Value: megaJp,
      jackpot2Value: '',
      prizeBreakdown: {
        winnersJackpot: megaRng() > 0.92 ? 1 : 0,
        winnersFirst: 12 + Math.floor(megaRng() * 30),
        winnersSecond: 600 + Math.floor(megaRng() * 700),
        winnersThird: 11000 + Math.floor(megaRng() * 8500),
      },
      source,
    },
    {
      gameType: 'POWER_655',
      period: `#0${1100 + (hashString(dateStr) % 150)}`,
      drawDate: dateStr,
      numbers: powerNums,
      bonusNumber: bonus,
      jackpot1Value: powerJp1,
      jackpot2Value: powerJp2,
      prizeBreakdown: {
        winnersJp1: 0,
        winnersJp2: powerRng() > 0.7 ? 1 : 0,
      },
      source,
    },
    {
      gameType: 'MAX_3D',
      period: `#00${860 + (hashString(dateStr) % 120)}`,
      drawDate: dateStr,
      numbers: [],
      bonusNumber: null,
      jackpot1Value: '1.000.000.000đ',
      jackpot2Value: '',
      prizeBreakdown: {
        special: genNums(max3dRng, 2, 3),
        first: genNums(max3dRng, 4, 3),
        second: genNums(max3dRng, 6, 3),
        third: genNums(max3dRng, 8, 3),
      },
      source,
    },
  ];
}
