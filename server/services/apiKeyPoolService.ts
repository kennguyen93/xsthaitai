import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { providerApiKeys } from '../../src/db/schema.ts';

export const TOTAL_KEY_SLOTS = 10;
export const DEFAULT_PROVIDER_KEY = 'phavn';
const INITIAL_FALLBACK_KEY = 'xs_6cfa5ee15f6b443a37bc7b42e47f5da0';

export type KeySlotStatus = 'ACTIVE' | 'STANDBY' | 'EXPIRED' | 'EMPTY';

export interface ProviderApiKeySlot {
  id: number;
  providerKey: string;
  slotIndex: number;
  label: string;
  apiKey: string;
  status: string;
  requestsCount: number;
  lastUsedAt: Date | null;
  expiredAt: Date | null;
  lastError: string;
  updatedAt: Date;
}

const rotationMutexes = new Map<string, Promise<unknown>>();

function withRotationMutex<T>(providerKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = rotationMutexes.get(providerKey) || Promise.resolve();
  const next = prev.then(fn, fn);
  const settled = next.then(
    () => undefined,
    () => undefined
  );
  rotationMutexes.set(providerKey, settled);
  return next;
}

export function isKeyExpiredHttpStatus(httpStatus: number | null): boolean {
  return httpStatus === 401 || httpStatus === 403;
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 10) return `${trimmed.slice(0, 3)}••••`;
  return `${trimmed.slice(0, 7)}••••••${trimmed.slice(-4)}`;
}

async function normalizeSingleActiveSlot(providerKey: string): Promise<ProviderApiKeySlot[]> {
  const slots = await db
    .select()
    .from(providerApiKeys)
    .where(eq(providerApiKeys.providerKey, providerKey))
    .orderBy(asc(providerApiKeys.slotIndex));

  const activeSlots = slots.filter(
    (s) => s.status === 'ACTIVE' && s.apiKey.trim().length > 0
  );

  if (activeSlots.length > 1) {
    // Enforce strictly 1 active key at any time
    const keepId = activeSlots[0].id;
    for (const extra of activeSlots.slice(1)) {
      await db
        .update(providerApiKeys)
        .set({ status: 'STANDBY', updatedAt: new Date() })
        .where(eq(providerApiKeys.id, extra.id));
      extra.status = 'STANDBY';
    }
    void keepId;
  } else if (activeSlots.length === 0) {
    // Demote any active empty slot
    for (const badActive of slots.filter((s) => s.status === 'ACTIVE' && !s.apiKey.trim())) {
      await db
        .update(providerApiKeys)
        .set({ status: 'EMPTY', updatedAt: new Date() })
        .where(eq(providerApiKeys.id, badActive.id));
      badActive.status = 'EMPTY';
    }
    // Promote the lowest-numbered STANDBY slot with a non-empty key
    const firstStandby = slots.find(
      (s) => s.status === 'STANDBY' && s.apiKey.trim().length > 0
    );
    if (firstStandby) {
      await db
        .update(providerApiKeys)
        .set({ status: 'ACTIVE', lastError: '', expiredAt: null, updatedAt: new Date() })
        .where(eq(providerApiKeys.id, firstStandby.id));
      firstStandby.status = 'ACTIVE';
      firstStandby.lastError = '';
      firstStandby.expiredAt = null;
    }
  }

  return slots;
}

export async function ensureKeySlotsSeeded(
  providerKey = DEFAULT_PROVIDER_KEY,
  migratedKey?: string
): Promise<ProviderApiKeySlot[]> {
  const existing = await db
    .select()
    .from(providerApiKeys)
    .where(eq(providerApiKeys.providerKey, providerKey))
    .orderBy(asc(providerApiKeys.slotIndex));

  const existingByIndex = new Map(existing.map((s) => [s.slotIndex, s]));
  const envOrFallbackKey =
    (migratedKey && migratedKey.trim()) ||
    process.env.PHA_API_KEY?.trim() ||
    process.env.LOTTERY_PRIMARY_API_KEY?.trim() ||
    INITIAL_FALLBACK_KEY;

  for (let idx = 1; idx <= TOTAL_KEY_SLOTS; idx++) {
    const found = existingByIndex.get(idx);
    if (!found) {
      const isSlotOne = idx === 1;
      const initialKey = isSlotOne ? envOrFallbackKey : '';
      await db
        .insert(providerApiKeys)
        .values({
          providerKey,
          slotIndex: idx,
          label: `Key #${idx}`,
          apiKey: initialKey,
          status: initialKey ? 'ACTIVE' : 'EMPTY',
        })
        .onConflictDoNothing();
    } else if (idx === 1 && !found.apiKey.trim() && found.status === 'EMPTY' && migratedKey?.trim()) {
      await db
        .update(providerApiKeys)
        .set({
          apiKey: migratedKey.trim(),
          status: 'STANDBY',
          updatedAt: new Date(),
        })
        .where(eq(providerApiKeys.id, found.id));
    }
  }

  return normalizeSingleActiveSlot(providerKey);
}

export async function getAdminKeySlots(
  providerKey = DEFAULT_PROVIDER_KEY
): Promise<ProviderApiKeySlot[]> {
  return ensureKeySlotsSeeded(providerKey);
}

export async function getActiveProviderKeySlot(
  providerKey = DEFAULT_PROVIDER_KEY
): Promise<ProviderApiKeySlot | null> {
  const slots = await ensureKeySlotsSeeded(providerKey);
  const active = slots.find(
    (s) => s.status === 'ACTIVE' && s.apiKey.trim().length > 0
  );
  return active || null;
}

export async function recordKeyUsage(slotId: number, requestsMade = 1): Promise<void> {
  if (requestsMade <= 0) return;
  const [current] = await db
    .select({ requestsCount: providerApiKeys.requestsCount })
    .from(providerApiKeys)
    .where(eq(providerApiKeys.id, slotId))
    .limit(1);
  if (!current) return;
  await db
    .update(providerApiKeys)
    .set({
      requestsCount: current.requestsCount + requestsMade,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(providerApiKeys.id, slotId));
}

export interface KeyRotationOutcome {
  rotated: boolean;
  alreadyRotatedBySibling: boolean;
  newSlot: ProviderApiKeySlot | null;
  exhausted: boolean;
}

export function rotateExpiredProviderKey(
  providerKey: string,
  failedSlotIndex: number,
  reason: string
): Promise<KeyRotationOutcome> {
  return withRotationMutex(providerKey, async () => {
    const slots = await normalizeSingleActiveSlot(providerKey);
    const currentActive = slots.find(
      (s) => s.status === 'ACTIVE' && s.apiKey.trim().length > 0
    );

    // If a concurrent call already rotated away from failedSlotIndex, reuse the new active slot
    if (currentActive && currentActive.slotIndex !== failedSlotIndex) {
      return {
        rotated: true,
        alreadyRotatedBySibling: true,
        newSlot: currentActive,
        exhausted: false,
      };
    }

    const failedSlot = slots.find((s) => s.slotIndex === failedSlotIndex);
    if (failedSlot) {
      await db
        .update(providerApiKeys)
        .set({
          status: 'EXPIRED',
          expiredAt: new Date(),
          lastError: reason.slice(0, 300),
          updatedAt: new Date(),
        })
        .where(eq(providerApiKeys.id, failedSlot.id));
      failedSlot.status = 'EXPIRED';
      failedSlot.lastError = reason.slice(0, 300);
    }

    // Pick the next STANDBY slot sequentially (lowest slotIndex > failedSlotIndex first, then wrap around)
    const standbyCandidates = slots.filter(
      (s) =>
        s.slotIndex !== failedSlotIndex &&
        s.status === 'STANDBY' &&
        s.apiKey.trim().length > 0
    );
    const nextSlot =
      standbyCandidates.find((s) => s.slotIndex > failedSlotIndex) ||
      standbyCandidates[0] ||
      null;

    if (!nextSlot) {
      return {
        rotated: false,
        alreadyRotatedBySibling: false,
        newSlot: null,
        exhausted: true,
      };
    }

    await db
      .update(providerApiKeys)
      .set({
        status: 'ACTIVE',
        lastError: '',
        expiredAt: null,
        updatedAt: new Date(),
      })
      .where(eq(providerApiKeys.id, nextSlot.id));
    nextSlot.status = 'ACTIVE';
    nextSlot.lastError = '';
    nextSlot.expiredAt = null;

    return {
      rotated: true,
      alreadyRotatedBySibling: false,
      newSlot: nextSlot,
      exhausted: false,
    };
  });
}

export async function saveAdminKeySlots(
  providerKey: string,
  updates: { slotIndex: number; apiKey: string; label?: string }[]
): Promise<ProviderApiKeySlot[]> {
  return withRotationMutex(providerKey, async () => {
    const existing = await ensureKeySlotsSeeded(providerKey);
    const existingByIndex = new Map(existing.map((s) => [s.slotIndex, s]));

    for (const item of updates) {
      if (item.slotIndex < 1 || item.slotIndex > TOTAL_KEY_SLOTS) continue;
      const current = existingByIndex.get(item.slotIndex);
      if (!current) continue;

      const trimmedKey = String(item.apiKey ?? '').trim();
      const nextLabel =
        item.label && item.label.trim() ? item.label.trim().slice(0, 60) : current.label;

      if (!trimmedKey) {
        await db
          .update(providerApiKeys)
          .set({
            label: nextLabel,
            apiKey: '',
            status: 'EMPTY',
            expiredAt: null,
            lastError: '',
            updatedAt: new Date(),
          })
          .where(eq(providerApiKeys.id, current.id));
        continue;
      }

      const keyChanged = trimmedKey !== current.apiKey;
      if (keyChanged) {
        // Fresh key pasted into this slot: reset EXPIRED state back to STANDBY (or keep ACTIVE if it was the active slot)
        const nextStatus = current.status === 'ACTIVE' ? 'ACTIVE' : 'STANDBY';
        await db
          .update(providerApiKeys)
          .set({
            label: nextLabel,
            apiKey: trimmedKey,
            status: nextStatus,
            requestsCount: 0,
            expiredAt: null,
            lastError: '',
            updatedAt: new Date(),
          })
          .where(eq(providerApiKeys.id, current.id));
      } else if (nextLabel !== current.label) {
        await db
          .update(providerApiKeys)
          .set({
            label: nextLabel,
            updatedAt: new Date(),
          })
          .where(eq(providerApiKeys.id, current.id));
      }
    }

    return normalizeSingleActiveSlot(providerKey);
  });
}

export async function activateAdminKeySlot(
  providerKey: string,
  slotIndex: number
): Promise<ProviderApiKeySlot[]> {
  return withRotationMutex(providerKey, async () => {
    const slots = await ensureKeySlotsSeeded(providerKey);
    const target = slots.find((s) => s.slotIndex === slotIndex);
    if (!target || !target.apiKey.trim()) {
      throw new Error(`Mục Key #${slotIndex} chưa có API Key hợp lệ.`);
    }

    await db
      .update(providerApiKeys)
      .set({ status: 'STANDBY', updatedAt: new Date() })
      .where(
        and(
          eq(providerApiKeys.providerKey, providerKey),
          eq(providerApiKeys.status, 'ACTIVE'),
          ne(providerApiKeys.slotIndex, slotIndex)
        )
      );

    await db
      .update(providerApiKeys)
      .set({
        status: 'ACTIVE',
        expiredAt: null,
        lastError: '',
        updatedAt: new Date(),
      })
      .where(eq(providerApiKeys.id, target.id));

    return normalizeSingleActiveSlot(providerKey);
  });
}

export async function resetExpiredKeySlot(
  providerKey: string,
  slotIndex: number
): Promise<ProviderApiKeySlot[]> {
  return withRotationMutex(providerKey, async () => {
    const slots = await ensureKeySlotsSeeded(providerKey);
    const target = slots.find((s) => s.slotIndex === slotIndex);
    if (!target) {
      throw new Error(`Không tìm thấy mục Key #${slotIndex}.`);
    }
    if (!target.apiKey.trim()) {
      await db
        .update(providerApiKeys)
        .set({ status: 'EMPTY', expiredAt: null, lastError: '', updatedAt: new Date() })
        .where(eq(providerApiKeys.id, target.id));
    } else if (target.status !== 'ACTIVE') {
      await db
        .update(providerApiKeys)
        .set({ status: 'STANDBY', expiredAt: null, lastError: '', updatedAt: new Date() })
        .where(eq(providerApiKeys.id, target.id));
    }
    return normalizeSingleActiveSlot(providerKey);
  });
}
