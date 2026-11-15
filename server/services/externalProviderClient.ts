import {
  getDayOfWeekUTC,
  XSMB_SCHEDULE_MAP,
  XSMN_SCHEDULE_MAP,
  XSMT_SCHEDULE_MAP,
} from './lotteryDataHelper.ts';
import {
  ExternalApiError,
  fetchJsonWithTimeout,
  fetchXosoVNMCity,
  fetchXosoVNMMienBac,
  type ApiAuthOptions,
} from './xosovnmClient.ts';

export interface ExternalApiDraw {
  provinceCode: string;
  provinceName: string;
  region: 'MB' | 'MN' | 'MT';
  kyHieu?: string[];
  prizes: Record<string, string[]>;
}

export interface ProviderConfigInput {
  providerKey: string;
  name: string;
  adapterType: string;
  baseUrl: string;
  envSecretName: string;
  authHeader: string;
  customEndpointPath: string | null;
  rateLimitPerMin: number;
  timeoutMs: number;
}

export interface ProviderFetchResult {
  draws: ExternalApiDraw[];
  httpStatus: number | null;
  endpointUrl: string;
  requestsMade: number;
}

// In-memory sliding window rate limiter per providerKey
const providerRequestTimestamps = new Map<string, number[]>();

export function checkAndConsumeRateLimit(
  providerKey: string,
  rateLimitPerMin: number
): { allowed: boolean; currentCount: number; limit: number; retryAfterSec: number } {
  const limit = Math.max(1, rateLimitPerMin || 30);
  const now = Date.now();
  const windowStart = now - 60_000;
  const list = (providerRequestTimestamps.get(providerKey) || []).filter(
    (ts) => ts > windowStart
  );

  if (list.length >= limit) {
    const oldest = list[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000));
    providerRequestTimestamps.set(providerKey, list);
    return { allowed: false, currentCount: list.length, limit, retryAfterSec };
  }

  list.push(now);
  providerRequestTimestamps.set(providerKey, list);
  return { allowed: true, currentCount: list.length, limit, retryAfterSec: 0 };
}

export function getRateLimiterSnapshot(): Record<
  string,
  { requestsInLastMinute: number }
> {
  const now = Date.now();
  const windowStart = now - 60_000;
  const out: Record<string, { requestsInLastMinute: number }> = {};
  for (const [k, timestamps] of providerRequestTimestamps.entries()) {
    const active = timestamps.filter((ts) => ts > windowStart);
    providerRequestTimestamps.set(k, active);
    out[k] = { requestsInLastMinute: active.length };
  }
  return out;
}

export function resolveBackendApiAuth(provider: ProviderConfigInput): ApiAuthOptions {
  if (!provider.envSecretName || provider.envSecretName === 'PUBLIC_NO_KEY_REQUIRED') {
    return { authHeader: 'none' };
  }
  const secretValue = process.env[provider.envSecretName];
  if (!secretValue || !secretValue.trim()) {
    return { authHeader: 'none' };
  }
  return {
    apiKey: secretValue.trim(),
    authHeader: provider.authHeader || 'x-api-key',
  };
}

export const XOSOVNM_API_BASE = 'https://api.xosovnm.net/api';

export async function fetchRegionDrawsFromProvider(
  provider: ProviderConfigInput,
  region: 'MB' | 'MN' | 'MT',
  targetDate: string,
  provinceCodesFilter?: string[]
): Promise<ProviderFetchResult> {
  const auth = resolveBackendApiAuth(provider);
  const dow = getDayOfWeekUTC(targetDate);
  const baseUrl = XOSOVNM_API_BASE;

  // Strictly use https://api.xosovnm.net/api
  if (region === 'MB') {
    const rate = checkAndConsumeRateLimit(provider.providerKey, provider.rateLimitPerMin);
    if (!rate.allowed) {
      throw new ExternalApiError(
        `Vượt giới hạn tốc độ API (${rate.limit} req/phút) cho ${provider.name}, thử lại sau ${rate.retryAfterSec}s.`,
        429,
        baseUrl
      );
    }
    const { item, httpStatus, endpointUrl } = await fetchXosoVNMMienBac(
      baseUrl,
      targetDate,
      provider.timeoutMs,
      auth
    );
    if (!item) {
      return { draws: [], httpStatus, endpointUrl, requestsMade: 1 };
    }
    const schedProv = XSMB_SCHEDULE_MAP[dow];
    const kyHieu =
      item.data.madb && item.data.madb !== 'N/A'
        ? item.data.madb.split('-').filter(Boolean)
        : [];
    return {
      draws: [
        {
          provinceCode: schedProv?.code || 'XSHN',
          provinceName: item.data.city?.[0] || schedProv?.name || 'Hà Nội',
          region: 'MB',
          kyHieu,
          prizes: {
            db: item.data.db || [],
            g1: item.data.g1 || [],
            g2: item.data.g2 || [],
            g3: item.data.g3 || [],
            g4: item.data.g4 || [],
            g5: item.data.g5 || [],
            g6: item.data.g6 || [],
            g7: item.data.g7 || [],
          },
        },
      ],
      httpStatus,
      endpointUrl,
      requestsMade: 1,
    };
  }

  const schedProvs =
    region === 'MN' ? XSMN_SCHEDULE_MAP[dow] || [] : XSMT_SCHEDULE_MAP[dow] || [];
  const targetProvs =
    provinceCodesFilter && provinceCodesFilter.length > 0
      ? schedProvs.filter((p) => provinceCodesFilter.includes(p.code))
      : schedProvs;

  if (targetProvs.length === 0) {
    return {
      draws: [],
      httpStatus: 200,
      endpointUrl: `${provider.baseUrl}/lottery/city`,
      requestsMade: 0,
    };
  }

  const cityResults = await Promise.all(
    targetProvs.map(async (prov) => {
      const rate = checkAndConsumeRateLimit(provider.providerKey, provider.rateLimitPerMin);
      if (!rate.allowed) {
        throw new ExternalApiError(
          `Vượt giới hạn tốc độ API (${rate.limit} req/phút) cho ${provider.name}, thử lại sau ${rate.retryAfterSec}s.`,
          429,
          provider.baseUrl
        );
      }
      const res = await fetchXosoVNMCity(
        provider.baseUrl,
        prov.code,
        targetDate,
        provider.timeoutMs,
        auth
      );
      if (!res.item) {
        return { draw: null, httpStatus: res.httpStatus, endpointUrl: res.endpointUrl };
      }
      return {
        draw: {
          provinceCode: prov.code,
          provinceName: prov.name,
          region,
          kyHieu: [],
          prizes: {
            g8: res.item.data.g8 || [],
            g7: res.item.data.g7 || [],
            g6: res.item.data.g6 || [],
            g5: res.item.data.g5 || [],
            g4: res.item.data.g4 || [],
            g3: res.item.data.g3 || [],
            g2: res.item.data.g2 || [],
            g1: res.item.data.g1 || [],
            db: res.item.data.db || [],
          },
        } as ExternalApiDraw,
        httpStatus: res.httpStatus,
        endpointUrl: res.endpointUrl,
      };
    })
  );

  const lastStatus = cityResults[cityResults.length - 1]?.httpStatus ?? 200;
  const sampleUrl = cityResults[0]?.endpointUrl ?? provider.baseUrl;
  const draws = cityResults
    .map((r) => r.draw)
    .filter((d): d is ExternalApiDraw => d !== null);

  return {
    draws,
    httpStatus: lastStatus,
    endpointUrl: sampleUrl,
    requestsMade: targetProvs.length,
  };
}
