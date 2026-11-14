export interface XosoVNMDayItem {
  date: string; // DD/MM/YYYY
  title: string;
  day: string;
  cityName: string;
  type?: string;
  data: {
    city?: string[];
    madb?: string;
    db?: string[];
    g1?: string[];
    g2?: string[];
    g3?: string[];
    g4?: string[];
    g5?: string[];
    g6?: string[];
    g7?: string[];
    g8?: string[];
    numbers?: string[];
    jackpot?: string;
    jackpot2?: string;
    prizes?: { prize: string; match: string; count: number; value: string }[];
  };
}

export class ExternalApiError extends Error {
  httpStatus: number | null;
  endpointUrl: string;

  constructor(message: string, httpStatus: number | null = null, endpointUrl = '') {
    super(message);
    this.name = 'ExternalApiError';
    this.httpStatus = httpStatus;
    this.endpointUrl = endpointUrl;
  }
}

export interface ApiAuthOptions {
  apiKey?: string;
  authHeader?: string; // 'none' | 'x-api-key' | 'authorization-bearer' | 'query-param'
}

export const PROVINCE_TO_XOSOVNM_SLUG: Record<string, string> = {
  // Miền Bắc
  XSHN: 'ha-noi',
  XSQN: 'quang-ninh',
  XSBN: 'bac-ninh',
  XSHP: 'hai-phong',
  XSND: 'nam-dinh',
  XSTB: 'thai-binh',
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

export function isoToVNDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  if (!y || !m || !d) return dateISO;
  return `${d}/${m}/${y}`;
}

export function vnDateToISO(dateVN: string): string {
  const [d, m, y] = dateVN.split('/');
  if (!d || !m || !y) return dateVN;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function hasAnyValidDigitEntry(data?: XosoVNMDayItem['data']): boolean {
  if (!data) return false;
  const tiers = [data.db, data.g1, data.g2, data.g3, data.g4, data.g5, data.g6, data.g7, data.g8];
  return tiers.some(
    (arr) => Array.isArray(arr) && arr.some((v) => /^\d{2,6}$/.test(String(v ?? '').trim()))
  );
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 8000,
  auth?: ApiAuthOptions
): Promise<{ body: T; status: number; endpointUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'xosothantai1.com/1.0',
  };

  let finalUrl = url;
  if (auth?.apiKey && auth.apiKey.trim()) {
    const key = auth.apiKey.trim();
    if (auth.authHeader === 'authorization-bearer') {
      headers['Authorization'] = `Bearer ${key}`;
    } else if (auth.authHeader === 'x-api-key') {
      headers['x-api-key'] = key;
    } else if (auth.authHeader === 'query-param') {
      const sep = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${sep}api_key=${encodeURIComponent(key)}`;
    }
  }

  try {
    const res = await fetch(finalUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ExternalApiError(`HTTP ${res.status} từ ${url}`, res.status, url);
    }
    const body = (await res.json()) as T;
    return { body, status: res.status, endpointUrl: url };
  } catch (err: unknown) {
    if (err instanceof ExternalApiError) throw err;
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? `Quá thời gian chờ (${timeoutMs}ms) khi gọi ${url}`
        : err instanceof Error
        ? err.message
        : `Lỗi mạng khi gọi ${url}`;
    throw new ExternalApiError(msg, null, url);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchXosoVNMMienBac(
  baseUrl: string,
  dateISO: string,
  timeoutMs = 8000,
  auth?: ApiAuthOptions
): Promise<{ item: XosoVNMDayItem | null; httpStatus: number; endpointUrl: string }> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({ date: isoToVNDate(dateISO) });
  const url = `${cleanBase}/lottery/region/mien-bac?${params.toString()}`;
  const { body, status, endpointUrl } = await fetchJsonWithTimeout<{
    data?: XosoVNMDayItem[] | null;
  }>(url, timeoutMs, auth);

  if (!Array.isArray(body.data) || body.data.length === 0) {
    return { item: null, httpStatus: status, endpointUrl };
  }
  const item = body.data[0];
  if (!hasAnyValidDigitEntry(item?.data)) {
    return { item: null, httpStatus: status, endpointUrl };
  }
  return { item, httpStatus: status, endpointUrl };
}

export async function fetchXosoVNMCity(
  baseUrl: string,
  provinceCode: string,
  dateISO: string,
  timeoutMs = 8000,
  auth?: ApiAuthOptions
): Promise<{ item: XosoVNMDayItem | null; httpStatus: number; endpointUrl: string }> {
  const citySlug = PROVINCE_TO_XOSOVNM_SLUG[provinceCode];
  if (!citySlug) {
    return { item: null, httpStatus: 400, endpointUrl: baseUrl };
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    date: isoToVNDate(dateISO),
    directCall: 'true',
  });
  const url = `${cleanBase}/lottery/city/${citySlug}?${params.toString()}`;
  const { body, status, endpointUrl } = await fetchJsonWithTimeout<{
    data?: XosoVNMDayItem[] | null;
  }>(url, timeoutMs, auth);

  if (!Array.isArray(body.data) || body.data.length === 0) {
    return { item: null, httpStatus: status, endpointUrl };
  }
  const item = body.data[0];
  if (!hasAnyValidDigitEntry(item?.data)) {
    return { item: null, httpStatus: status, endpointUrl };
  }
  return { item, httpStatus: status, endpointUrl };
}

export async function fetchXosoVNMVietlott(
  baseUrl: string,
  timeoutMs = 8000,
  auth?: ApiAuthOptions
): Promise<{
  mega: XosoVNMDayItem[];
  power: XosoVNMDayItem[];
  max3d: XosoVNMDayItem[];
}> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const [megaRes, powerRes, max3dRes] = await Promise.all([
    fetchJsonWithTimeout<{ data?: XosoVNMDayItem[] | null }>(
      `${cleanBase}/vietlott/mega?limit=5`,
      timeoutMs,
      auth
    )
      .then((r) => r.body)
      .catch(() => ({ data: [] })),
    fetchJsonWithTimeout<{ data?: XosoVNMDayItem[] | null }>(
      `${cleanBase}/vietlott/power?limit=5`,
      timeoutMs,
      auth
    )
      .then((r) => r.body)
      .catch(() => ({ data: [] })),
    fetchJsonWithTimeout<{ data?: XosoVNMDayItem[] | null }>(
      `${cleanBase}/vietlott/max3d?limit=5`,
      timeoutMs,
      auth
    )
      .then((r) => r.body)
      .catch(() => ({ data: [] })),
  ]);

  return {
    mega: Array.isArray(megaRes.data) ? megaRes.data : [],
    power: Array.isArray(powerRes.data) ? powerRes.data : [],
    max3d: Array.isArray(max3dRes.data) ? max3dRes.data : [],
  };
}
