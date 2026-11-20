export interface PhaVNTraditionalResponse {
  province?: string;
  title?: string;
  date?: string; // DD-MM-YYYY
  dayOfWeek?: string;
  prizes?: {
    db?: string[];
    g1?: string[];
    g2?: string[];
    g3?: string[];
    g4?: string[];
    g5?: string[];
    g6?: string[];
    g7?: string[];
    g8?: string[];
  };
  error?: string;
  message?: string;
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
  authHeader?: string; // 'x-api-key' | 'query-param' | 'authorization-bearer' | 'none'
}

export const PROVINCE_TO_PHAVN_SLUG: Record<string, string> = {
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

export function isoToPhaVNDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  if (!y || !m || !d) return dateISO;
  return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
}

export function phaVNDateToISO(dateVN: string): string {
  const sep = dateVN.includes('-') ? '-' : '/';
  const [d, m, y] = dateVN.split(sep);
  if (!d || !m || !y) return dateVN;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function hasAnyValidDigitEntry(prizes?: PhaVNTraditionalResponse['prizes']): boolean {
  if (!prizes) return false;
  const tiers = [
    prizes.db,
    prizes.g1,
    prizes.g2,
    prizes.g3,
    prizes.g4,
    prizes.g5,
    prizes.g6,
    prizes.g7,
    prizes.g8,
  ];
  return tiers.some(
    (arr) => Array.isArray(arr) && arr.some((v) => /^\d{2,6}$/.test(String(v ?? '').trim()))
  );
}

export async function fetchPhaVNJsonWithTimeout<T>(
  url: string,
  timeoutMs = 8000,
  auth?: ApiAuthOptions
): Promise<{ body: T | null; status: number; endpointUrl: string }> {
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
    } else if (auth.authHeader === 'query-param') {
      const sep = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${sep}api_key=${encodeURIComponent(key)}`;
    } else {
      // pha.vn accepts X-API-KEY header
      headers['X-API-KEY'] = key;
    }
  }

  try {
    const res = await fetch(finalUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    // HTTP 404 on pha.vn means no draw results available yet for that province/date
    if (res.status === 404) {
      return { body: null, status: 404, endpointUrl: url };
    }

    if (!res.ok) {
      let errMsg = `HTTP ${res.status} từ ${url}`;
      try {
        const errBody = (await res.json()) as { message?: string; error?: string };
        const detail = errBody?.message || errBody?.error;
        if (detail) errMsg = `HTTP ${res.status}: ${detail}`;
      } catch {
        // Ignore non-JSON error body
      }
      throw new ExternalApiError(errMsg, res.status, url);
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

export async function fetchPhaVNMienBac(
  baseUrl: string,
  dateISO: string,
  timeoutMs = 8000,
  auth?: ApiAuthOptions
): Promise<{ item: PhaVNTraditionalResponse | null; httpStatus: number; endpointUrl: string }> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const expectedDate = isoToPhaVNDate(dateISO);
  const params = new URLSearchParams({
    region: 'mien-bac',
    province: 'mien-bac',
    date: expectedDate,
  });
  const url = `${cleanBase}/traditional?${params.toString()}`;
  const { body, status, endpointUrl } = await fetchPhaVNJsonWithTimeout<PhaVNTraditionalResponse>(
    url,
    timeoutMs,
    auth
  );

  if (!body || body.date !== expectedDate || !hasAnyValidDigitEntry(body.prizes)) {
    return { item: null, httpStatus: status, endpointUrl };
  }
  return { item: body, httpStatus: status, endpointUrl };
}

export async function fetchPhaVNCity(
  baseUrl: string,
  provinceCode: string,
  dateISO: string,
  timeoutMs = 8000,
  auth?: ApiAuthOptions
): Promise<{ item: PhaVNTraditionalResponse | null; httpStatus: number; endpointUrl: string }> {
  const citySlug = PROVINCE_TO_PHAVN_SLUG[provinceCode];
  if (!citySlug) {
    return { item: null, httpStatus: 400, endpointUrl: baseUrl };
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const expectedDate = isoToPhaVNDate(dateISO);
  const params = new URLSearchParams({
    province: citySlug,
    date: expectedDate,
  });
  const url = `${cleanBase}/traditional?${params.toString()}`;
  const { body, status, endpointUrl } = await fetchPhaVNJsonWithTimeout<PhaVNTraditionalResponse>(
    url,
    timeoutMs,
    auth
  );

  if (!body || body.date !== expectedDate || !hasAnyValidDigitEntry(body.prizes)) {
    return { item: null, httpStatus: status, endpointUrl };
  }
  return { item: body, httpStatus: status, endpointUrl };
}
