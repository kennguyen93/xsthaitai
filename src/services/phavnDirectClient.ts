import {
  DAY_NAMES_VI,
  XSMB_SCHEDULE,
  XSMN_SCHEDULE,
  XSMT_SCHEDULE,
} from '../data/lotterySchedule';
import type { DbLotteryRow, DbProvinceRow } from './apiClient';

export const FIXED_PHAVN_TRADITIONAL_API = 'https://pha.vn/api/v1/traditional';

export const CLIENT_PROVINCE_TO_PHAVN_SLUG: Record<string, string> = {
  // Miền Bắc
  XSHN: 'mien-bac',
  XSQN: 'mien-bac',
  XSBN: 'mien-bac',
  XSHP: 'mien-bac',
  XSND: 'mien-bac',
  XSTB: 'mien-bac',
  // Miền Nam
  XSHCM: 'tp-hcm',
  XSDT: 'dong-thap',
  XSCM: 'ca-mau',
  XSBT: 'ben-tre',
  XSVT: 'vung-tau',
  XSBL: 'bac-lieu',
  XSDN: 'dong-nai',
  XSCT: 'can-tho',
  XSST: 'soc-trang',
  XSTN: 'tay-ninh',
  XSAG: 'an-giang',
  XSBTH: 'binh-thuan',
  XSVL: 'vinh-long',
  XSBD: 'binh-duong',
  XSTV: 'tra-vinh',
  XSLA: 'long-an',
  XSBP: 'binh-phuoc',
  XSHG: 'hau-giang',
  XSTG: 'tien-giang',
  XSKG: 'kien-giang',
  XSDL: 'da-lat',
  // Miền Trung
  XSTTH: 'thua-thien-hue',
  XSPY: 'phu-yen',
  XSDLK: 'dak-lak',
  XSQNM: 'quang-nam',
  XSDNG: 'da-nang',
  XSKH: 'khanh-hoa',
  XSBDI: 'binh-dinh',
  XSQT: 'quang-tri',
  XSQB: 'quang-binh',
  XSGL: 'gia-lai',
  XSNT: 'ninh-thuan',
  XSQNG: 'quang-ngai',
  XSDNO: 'dak-nong',
  XSKT: 'kon-tum',
};

const PROVINCE_SLUG_BY_CODE: Record<string, string> = {
  XSHN: 'xsmb-ha-noi',
  XSQN: 'xsmb-quang-ninh',
  XSBN: 'xsmb-bac-ninh',
  XSHP: 'xsmb-hai-phong',
  XSND: 'xsmb-nam-dinh',
  XSTB: 'xsmb-thai-binh',
  XSHCM: 'xsmn-tp-hcm',
  XSDT: 'xsmn-dong-thap',
  XSCM: 'xsmn-ca-mau',
  XSBT: 'xsmn-ben-tre',
  XSVT: 'xsmn-vung-tau',
  XSBL: 'xsmn-bac-lieu',
  XSDN: 'xsmn-dong-nai',
  XSCT: 'xsmn-can-tho',
  XSST: 'xsmn-soc-trang',
  XSTN: 'xsmn-tay-ninh',
  XSAG: 'xsmn-an-giang',
  XSBTH: 'xsmn-binh-thuan',
  XSVL: 'xsmn-vinh-long',
  XSBD: 'xsmn-binh-duong',
  XSTV: 'xsmn-tra-vinh',
  XSLA: 'xsmn-long-an',
  XSBP: 'xsmn-binh-phuoc',
  XSHG: 'xsmn-hau-giang',
  XSTG: 'xsmn-tien-giang',
  XSKG: 'xsmn-kien-giang',
  XSDL: 'xsmn-da-lat',
  XSTTH: 'xsmt-thua-thien-hue',
  XSPY: 'xsmt-phu-yen',
  XSDLK: 'xsmt-dak-lak',
  XSQNM: 'xsmt-quang-nam',
  XSDNG: 'xsmt-da-nang',
  XSKH: 'xsmt-khanh-hoa',
  XSBDI: 'xsmt-binh-dinh',
  XSQT: 'xsmt-quang-tri',
  XSQB: 'xsmt-quang-binh',
  XSGL: 'xsmt-gia-lai',
  XSNT: 'xsmt-ninh-thuan',
  XSQNG: 'xsmt-quang-ngai',
  XSDNO: 'xsmt-dak-nong',
  XSKT: 'xsmt-kon-tum',
};

interface PhaVNResponse {
  province?: string;
  title?: string;
  date?: string;
  dayOfWeek?: string;
  prizes?: Record<string, string[]>;
  error?: string;
  message?: string;
}

function isoToPhaVNDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  if (!y || !m || !d) return dateISO;
  return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
}

function getDayOfWeekUTC(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function hasAnyValidEntry(prizes?: Record<string, string[]>): boolean {
  if (!prizes) return false;
  return Object.values(prizes).some(
    (arr) => Array.isArray(arr) && arr.some((v) => /^\d{2,6}$/.test(String(v ?? '').trim()))
  );
}

function extractTails(prizes: Record<string, string[]>): { allTails: string[]; specialTail: string } {
  const allTails: string[] = [];
  for (const arr of Object.values(prizes)) {
    if (!Array.isArray(arr)) continue;
    for (const num of arr) {
      const clean = String(num ?? '').trim();
      if (clean.length >= 2) allTails.push(clean.slice(-2));
    }
  }
  const db = String(prizes.db?.[0] ?? '').trim();
  return {
    allTails,
    specialTail: db.length >= 2 ? db.slice(-2) : '',
  };
}

export function getStaticProvincesList(): DbProvinceRow[] {
  const map = new Map<string, DbProvinceRow>();
  let seq = 1;

  const add = (
    code: string,
    name: string,
    region: 'MB' | 'MN' | 'MT',
    dow: number,
    drawTime: string
  ) => {
    const existing = map.get(code);
    if (existing) {
      if (!existing.drawDays.includes(dow)) existing.drawDays.push(dow);
      return;
    }
    map.set(code, {
      id: seq++,
      code,
      name,
      slug: PROVINCE_SLUG_BY_CODE[code] || `xs-${code.toLowerCase()}`,
      region,
      drawDays: [dow],
      drawTime,
    });
  };

  for (let dow = 0; dow <= 6; dow++) {
    const mb = XSMB_SCHEDULE[dow];
    if (mb) add(mb.code, mb.name, 'MB', dow, '18:15');
    for (const p of XSMN_SCHEDULE[dow] || []) add(p.code, p.name, 'MN', dow, '16:15');
    for (const p of XSMT_SCHEDULE[dow] || []) add(p.code, p.name, 'MT', dow, '17:15');
  }

  return Array.from(map.values()).sort((a, b) =>
    a.region === b.region ? a.name.localeCompare(b.name, 'vi') : a.region.localeCompare(b.region)
  );
}

async function callFixedPhaVN(
  params: URLSearchParams,
  signal?: AbortSignal
): Promise<PhaVNResponse | null> {
  const url = `${FIXED_PHAVN_TRADITIONAL_API}?${params.toString()}`;
  const publicKey = (import.meta.env.VITE_PHA_PUBLIC_API_KEY || '').trim();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (publicKey) {
    headers['X-API-KEY'] = publicKey;
  }

  const res = await fetch(url, {
    method: 'GET',
    headers,
    signal,
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { message?: string; error?: string };
      if (errBody?.message || errBody?.error) {
        detail = `${errBody.message || errBody.error} (HTTP ${res.status})`;
      }
    } catch {
      // Ignore parse failure
    }
    throw new Error(`Không thể tải dữ liệu từ ${FIXED_PHAVN_TRADITIONAL_API}: ${detail}`);
  }

  return (await res.json()) as PhaVNResponse;
}

export async function fetchResultsFromPhaVNDirect(
  dateISO: string,
  signal?: AbortSignal
): Promise<{ date: string; count: number; results: DbLotteryRow[] }> {
  const dow = getDayOfWeekUTC(dateISO);
  const expectedVNDate = isoToPhaVNDate(dateISO);
  const rows: DbLotteryRow[] = [];
  let rowId = 1;

  const mbProv = XSMB_SCHEDULE[dow];
  const mnProvs = XSMN_SCHEDULE[dow] || [];
  const mtProvs = XSMT_SCHEDULE[dow] || [];

  const tasks: Promise<void>[] = [];

  if (mbProv) {
    tasks.push(
      (async () => {
        const params = new URLSearchParams({
          region: 'mien-bac',
          province: 'mien-bac',
          date: expectedVNDate,
        });
        const body = await callFixedPhaVN(params, signal);
        if (!body || body.date !== expectedVNDate || !hasAnyValidEntry(body.prizes)) return;
        const prizes = {
          db: body.prizes?.db || [],
          g1: body.prizes?.g1 || [],
          g2: body.prizes?.g2 || [],
          g3: body.prizes?.g3 || [],
          g4: body.prizes?.g4 || [],
          g5: body.prizes?.g5 || [],
          g6: body.prizes?.g6 || [],
          g7: body.prizes?.g7 || [],
        };
        const { allTails, specialTail } = extractTails(prizes);
        rows.push({
          id: rowId++,
          drawDate: dateISO,
          region: 'MB',
          provinceCode: mbProv.code,
          provinceName: mbProv.name,
          kyHieu: [],
          prizes,
          allTails,
          specialTail,
          source: 'pha.vn',
        });
      })()
    );
  }

  const regionalTasks: { region: 'MN' | 'MT'; prov: { code: string; name: string } }[] = [
    ...mnProvs.map((prov) => ({ region: 'MN' as const, prov })),
    ...mtProvs.map((prov) => ({ region: 'MT' as const, prov })),
  ];

  for (const { region, prov } of regionalTasks) {
    const slug = CLIENT_PROVINCE_TO_PHAVN_SLUG[prov.code];
    if (!slug) continue;
    tasks.push(
      (async () => {
        const params = new URLSearchParams({
          province: slug,
          date: expectedVNDate,
        });
        const body = await callFixedPhaVN(params, signal);
        if (!body || body.date !== expectedVNDate || !hasAnyValidEntry(body.prizes)) return;
        const prizes = {
          g8: body.prizes?.g8 || [],
          g7: body.prizes?.g7 || [],
          g6: body.prizes?.g6 || [],
          g5: body.prizes?.g5 || [],
          g4: body.prizes?.g4 || [],
          g3: body.prizes?.g3 || [],
          g2: body.prizes?.g2 || [],
          g1: body.prizes?.g1 || [],
          db: body.prizes?.db || [],
        };
        const { allTails, specialTail } = extractTails(prizes);
        rows.push({
          id: rowId++,
          drawDate: dateISO,
          region,
          provinceCode: prov.code,
          provinceName: prov.name,
          kyHieu: [],
          prizes,
          allTails,
          specialTail,
          source: 'pha.vn',
        });
      })()
    );
  }

  await Promise.all(tasks);

  const regionOrder: Record<string, number> = { MB: 0, MN: 1, MT: 2 };
  rows.sort((a, b) => (regionOrder[a.region] ?? 9) - (regionOrder[b.region] ?? 9));

  return {
    date: dateISO,
    count: rows.length,
    results: rows,
  };
}

export async function fetchProvinceHistoryFromPhaVNDirect(
  slug: string,
  limit = 8
): Promise<{ province: DbProvinceRow; draws: DbLotteryRow[] }> {
  const all = getStaticProvincesList();
  const province = all.find((p) => p.slug === slug);
  if (!province) {
    throw new Error('Không tìm thấy đài mở thưởng này.');
  }

  const phavnSlug = CLIENT_PROVINCE_TO_PHAVN_SLUG[province.code];
  if (!phavnSlug) {
    return { province, draws: [] };
  }

  // Collect up to `limit` scheduled draw dates looking backwards from today (Asia/Ho_Chi_Minh)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = fmt.format(new Date());
  const [ty, tm, td] = todayStr.split('-').map(Number);

  const targetDates: string[] = [];
  for (let offset = 0; offset < 60 && targetDates.length < limit; offset++) {
    const dt = new Date(Date.UTC(ty, tm - 1, td - offset));
    const dow = dt.getUTCDay();
    if (province.drawDays.includes(dow)) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      targetDates.push(`${y}-${m}-${d}`);
    }
  }

  const draws: DbLotteryRow[] = [];
  let rowId = 1;

  await Promise.all(
    targetDates.map(async (dateISO) => {
      const expectedVNDate = isoToPhaVNDate(dateISO);
      const params = new URLSearchParams(
        province.region === 'MB'
          ? { region: 'mien-bac', province: 'mien-bac', date: expectedVNDate }
          : { province: phavnSlug, date: expectedVNDate }
      );
      try {
        const body = await callFixedPhaVN(params);
        if (!body || body.date !== expectedVNDate || !hasAnyValidEntry(body.prizes)) return;
        const prizes = body.prizes || {};
        const { allTails, specialTail } = extractTails(prizes);
        draws.push({
          id: rowId++,
          drawDate: dateISO,
          region: province.region,
          provinceCode: province.code,
          provinceName: province.name,
          kyHieu: [],
          prizes,
          allTails,
          specialTail,
          source: 'pha.vn',
        });
      } catch {
        // Skip failed single date cleanly
      }
    })
  );

  draws.sort((a, b) => b.drawDate.localeCompare(a.drawDate));
  void DAY_NAMES_VI;
  return { province, draws };
}

function shiftDateISOClient(dateISO: string, deltaDays: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export async function fetchRegionHistoryFromPhaVNDirect(
  region: 'MB' | 'MN' | 'MT' | 'ALL',
  startDateISO: string,
  limit = 7,
  signal?: AbortSignal
): Promise<{
  region: 'MB' | 'MN' | 'MT' | 'ALL';
  startDate: string;
  limit: number;
  count: number;
  draws: DbLotteryRow[];
}> {
  const targetDates: string[] = [];
  for (let i = 0; i < limit; i++) {
    const d = shiftDateISOClient(startDateISO, -i);
    if (d < '2016-01-01') break;
    targetDates.push(d);
  }

  const draws: DbLotteryRow[] = [];
  let rowId = 1;
  const tasks: Promise<void>[] = [];

  for (const dateISO of targetDates) {
    const dow = getDayOfWeekUTC(dateISO);
    const expectedVNDate = isoToPhaVNDate(dateISO);

    if (region === 'MB' || region === 'ALL') {
      const mbProv = XSMB_SCHEDULE[dow];
      if (mbProv) {
        tasks.push(
          (async () => {
            const params = new URLSearchParams({
              region: 'mien-bac',
              province: 'mien-bac',
              date: expectedVNDate,
            });
            try {
              const body = await callFixedPhaVN(params, signal);
              if (!body || body.date !== expectedVNDate || !hasAnyValidEntry(body.prizes)) return;
              const prizes = {
                db: body.prizes?.db || [],
                g1: body.prizes?.g1 || [],
                g2: body.prizes?.g2 || [],
                g3: body.prizes?.g3 || [],
                g4: body.prizes?.g4 || [],
                g5: body.prizes?.g5 || [],
                g6: body.prizes?.g6 || [],
                g7: body.prizes?.g7 || [],
              };
              const { allTails, specialTail } = extractTails(prizes);
              draws.push({
                id: rowId++,
                drawDate: dateISO,
                region: 'MB',
                provinceCode: mbProv.code,
                provinceName: mbProv.name,
                kyHieu: [],
                prizes,
                allTails,
                specialTail,
                source: 'pha.vn',
              });
            } catch (err) {
              if (err instanceof DOMException && err.name === 'AbortError') throw err;
            }
          })()
        );
      }
    }

    const regionalProvs: { reg: 'MN' | 'MT'; prov: { code: string; name: string } }[] = [];
    if (region === 'MN' || region === 'ALL') {
      for (const prov of XSMN_SCHEDULE[dow] || []) regionalProvs.push({ reg: 'MN', prov });
    }
    if (region === 'MT' || region === 'ALL') {
      for (const prov of XSMT_SCHEDULE[dow] || []) regionalProvs.push({ reg: 'MT', prov });
    }

    for (const { reg, prov } of regionalProvs) {
      const slug = CLIENT_PROVINCE_TO_PHAVN_SLUG[prov.code];
      if (!slug) continue;
      tasks.push(
        (async () => {
          const params = new URLSearchParams({
            province: slug,
            date: expectedVNDate,
          });
          try {
            const body = await callFixedPhaVN(params, signal);
            if (!body || body.date !== expectedVNDate || !hasAnyValidEntry(body.prizes)) return;
            const prizes = {
              g8: body.prizes?.g8 || [],
              g7: body.prizes?.g7 || [],
              g6: body.prizes?.g6 || [],
              g5: body.prizes?.g5 || [],
              g4: body.prizes?.g4 || [],
              g3: body.prizes?.g3 || [],
              g2: body.prizes?.g2 || [],
              g1: body.prizes?.g1 || [],
              db: body.prizes?.db || [],
            };
            const { allTails, specialTail } = extractTails(prizes);
            draws.push({
              id: rowId++,
              drawDate: dateISO,
              region: reg,
              provinceCode: prov.code,
              provinceName: prov.name,
              kyHieu: [],
              prizes,
              allTails,
              specialTail,
              source: 'pha.vn',
            });
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') throw err;
          }
        })()
      );
    }
  }

  await Promise.all(tasks);

  const regionOrder: Record<string, number> = { MB: 0, MN: 1, MT: 2 };
  draws.sort((a, b) => {
    const cmp = b.drawDate.localeCompare(a.drawDate);
    if (cmp !== 0) return cmp;
    return (regionOrder[a.region] ?? 9) - (regionOrder[b.region] ?? 9);
  });

  return {
    region,
    startDate: startDateISO,
    limit,
    count: draws.length,
    draws,
  };
}

export async function fetchXsmbHistoryFromPhaVNDirect(
  startDateISO: string,
  limit = 7,
  signal?: AbortSignal
) {
  return fetchRegionHistoryFromPhaVNDirect('MB', startDateISO, limit, signal);
}
