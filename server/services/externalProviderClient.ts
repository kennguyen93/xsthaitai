import {
  getDayOfWeekUTC,
  XSMB_SCHEDULE_MAP,
  XSMN_SCHEDULE_MAP,
  XSMT_SCHEDULE_MAP,
} from './lotteryDataHelper.ts';
import {
  ExternalApiError,
  fetchPhaVNCity,
  fetchPhaVNMienBac,
  type ApiAuthOptions,
} from './phavnClient.ts';
import {
  getActiveProviderKeySlot,
  isKeyExpiredHttpStatus,
  recordKeyUsage,
  rotateExpiredProviderKey,
  TOTAL_KEY_SLOTS,
  type ProviderApiKeySlot,
} from './apiKeyPoolService.ts';

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
  keySlotUsed?: number;
}

export const PHAVN_API_BASE = 'https://pha.vn/api/v1';

// In-memory sliding window rate limiter per providerKey
const providerRequestTimestamps = new Map<string, number[]>();

export function checkAndConsumeRateLimit(
  providerKey: string,
  rateLimitPerMin: number
): { allowed: boolean; currentCount: number; limit: number; retryAfterSec: number } {
  const limit = Math.max(1, rateLimitPerMin || 100);
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

export async function hasActiveProviderKey(providerKey = 'phavn'): Promise<boolean> {
  const slot = await getActiveProviderKeySlot(providerKey);
  return Boolean(slot && slot.apiKey.trim().length > 0);
}

async function executeRegionFetchWithSingleSlot(
  provider: ProviderConfigInput,
  region: 'MB' | 'MN' | 'MT',
  targetDate: string,
  slot: ProviderApiKeySlot,
  provinceCodesFilter?: string[]
): Promise<ProviderFetchResult> {
  const auth: ApiAuthOptions = {
    apiKey: slot.apiKey.trim(),
    authHeader: provider.authHeader === 'none' ? 'x-api-key' : provider.authHeader || 'x-api-key',
  };
  const dow = getDayOfWeekUTC(targetDate);
  const baseUrl = PHAVN_API_BASE;

  if (region === 'MB') {
    const rate = checkAndConsumeRateLimit(provider.providerKey, provider.rateLimitPerMin);
    if (!rate.allowed) {
      throw new ExternalApiError(
        `Vượt giới hạn tốc độ API (${rate.limit} req/phút) cho ${provider.name}, thử lại sau ${rate.retryAfterSec}s.`,
        429,
        baseUrl
      );
    }
    const { item, httpStatus, endpointUrl } = await fetchPhaVNMienBac(
      baseUrl,
      targetDate,
      provider.timeoutMs,
      auth
    );
    await recordKeyUsage(slot.id, 1).catch(() => {});

    if (!item || !item.prizes) {
      return {
        draws: [],
        httpStatus,
        endpointUrl,
        requestsMade: 1,
        keySlotUsed: slot.slotIndex,
      };
    }
    const schedProv = XSMB_SCHEDULE_MAP[dow];
    return {
      draws: [
        {
          provinceCode: schedProv?.code || 'XSHN',
          provinceName: schedProv?.name || 'Hà Nội',
          region: 'MB',
          kyHieu: [],
          prizes: {
            db: item.prizes.db || [],
            g1: item.prizes.g1 || [],
            g2: item.prizes.g2 || [],
            g3: item.prizes.g3 || [],
            g4: item.prizes.g4 || [],
            g5: item.prizes.g5 || [],
            g6: item.prizes.g6 || [],
            g7: item.prizes.g7 || [],
          },
        },
      ],
      httpStatus,
      endpointUrl,
      requestsMade: 1,
      keySlotUsed: slot.slotIndex,
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
      endpointUrl: `${baseUrl}/traditional`,
      requestsMade: 0,
      keySlotUsed: slot.slotIndex,
    };
  }

  const cityResults = await Promise.all(
    targetProvs.map(async (prov) => {
      const rate = checkAndConsumeRateLimit(provider.providerKey, provider.rateLimitPerMin);
      if (!rate.allowed) {
        throw new ExternalApiError(
          `Vượt giới hạn tốc độ API (${rate.limit} req/phút) cho ${provider.name}, thử lại sau ${rate.retryAfterSec}s.`,
          429,
          baseUrl
        );
      }
      const res = await fetchPhaVNCity(
        baseUrl,
        prov.code,
        targetDate,
        provider.timeoutMs,
        auth
      );
      if (!res.item || !res.item.prizes) {
        return { draw: null, httpStatus: res.httpStatus, endpointUrl: res.endpointUrl };
      }
      return {
        draw: {
          provinceCode: prov.code,
          provinceName: prov.name,
          region,
          kyHieu: [],
          prizes: {
            g8: res.item.prizes.g8 || [],
            g7: res.item.prizes.g7 || [],
            g6: res.item.prizes.g6 || [],
            g5: res.item.prizes.g5 || [],
            g4: res.item.prizes.g4 || [],
            g3: res.item.prizes.g3 || [],
            g2: res.item.prizes.g2 || [],
            g1: res.item.prizes.g1 || [],
            db: res.item.prizes.db || [],
          },
        } as ExternalApiDraw,
        httpStatus: res.httpStatus,
        endpointUrl: res.endpointUrl,
      };
    })
  );

  await recordKeyUsage(slot.id, targetProvs.length).catch(() => {});

  const lastStatus = cityResults[cityResults.length - 1]?.httpStatus ?? 200;
  const sampleUrl = cityResults[0]?.endpointUrl ?? `${baseUrl}/traditional`;
  const draws = cityResults
    .map((r) => r.draw)
    .filter((d): d is ExternalApiDraw => d !== null);

  return {
    draws,
    httpStatus: lastStatus,
    endpointUrl: sampleUrl,
    requestsMade: targetProvs.length,
    keySlotUsed: slot.slotIndex,
  };
}

export async function fetchRegionDrawsFromProvider(
  provider: ProviderConfigInput,
  region: 'MB' | 'MN' | 'MT',
  targetDate: string,
  provinceCodesFilter?: string[]
): Promise<ProviderFetchResult> {
  const baseUrl = PHAVN_API_BASE;
  let activeSlot = await getActiveProviderKeySlot(provider.providerKey);

  if (!activeSlot) {
    throw new ExternalApiError(
      'Không có API Key khả dụng (tất cả 10 mục Key đang trống hoặc đã hết hạn). Vui lòng nhập Key mới trong trang Quản trị.',
      401,
      baseUrl
    );
  }

  // Strictly sequential: always use ONLY the single ACTIVE key; switch to next STANDBY key only if current key expires (401/403)
  for (let hop = 0; hop < TOTAL_KEY_SLOTS; hop++) {
    try {
      return await executeRegionFetchWithSingleSlot(
        provider,
        region,
        targetDate,
        activeSlot,
        provinceCodesFilter
      );
    } catch (err: unknown) {
      if (err instanceof ExternalApiError && isKeyExpiredHttpStatus(err.httpStatus)) {
        const rotation = await rotateExpiredProviderKey(
          provider.providerKey,
          activeSlot.slotIndex,
          err.message
        );
        if (rotation.newSlot) {
          if (!rotation.alreadyRotatedBySibling) {
            console.warn(
              `[KeyPool] Key #${activeSlot.slotIndex} hết hạn (${err.httpStatus}), tự động chuyển sang Key #${rotation.newSlot.slotIndex}.`
            );
          }
          activeSlot = rotation.newSlot;
          continue;
        }
        throw new ExternalApiError(
          `Key #${activeSlot.slotIndex} đã hết hạn (${err.message}) và không còn Key dự phòng nào trong 10 mục Key.`,
          err.httpStatus,
          baseUrl
        );
      }
      throw err;
    }
  }

  throw new ExternalApiError(
    'Đã thử toàn bộ các mục API Key dự phòng nhưng đều đã hết hạn.',
    401,
    baseUrl
  );
}
