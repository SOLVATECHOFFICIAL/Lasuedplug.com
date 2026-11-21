import {
  idbClear,
  idbDelete,
  idbDeletePrefix,
  idbGetAllEntries,
  idbSet,
} from './idbCache';

const CACHE_KEY_PREFIX = 'lasuedplug_fc_v1:';
const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours stale-while-revalidate window

export const CACHE_HYDRATED_EVENT = 'lasuedplug:cache-hydrated';

export interface CacheEnvelope<T> {
  data: T;
  savedAt: number;
  syncedAt?: number;
  fullSyncAt?: number;
  isFull?: boolean;
}

export interface SetFastCacheOptions<T> {
  localData?: T;
  idbOnly?: boolean;
  savedAt?: number;
  syncedAt?: number;
  fullSyncAt?: number;
  isFull?: boolean;
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>();
let idbHydrationPromise: Promise<boolean> | null = null;
let idbHydratedDone = false;

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore restricted storage environments (private browsing / Node tests)
  }
  return null;
}

function buildStorageKey(key: string): string {
  return `${CACHE_KEY_PREFIX}${key}`;
}

function evictOldestCacheEntries(storage: Storage, targetCount = 4): void {
  const entries: Array<{ key: string; savedAt: number }> = [];
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i);
    if (!k || !k.startsWith(CACHE_KEY_PREFIX)) continue;
    let savedAt = 0;
    try {
      const raw = storage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CacheEnvelope<unknown>>;
        if (typeof parsed.savedAt === 'number') {
          savedAt = parsed.savedAt;
        }
      }
    } catch {
      savedAt = 0;
    }
    entries.push({ key: k, savedAt });
  }

  entries.sort((a, b) => a.savedAt - b.savedAt);
  for (let i = 0; i < Math.min(targetCount, entries.length); i += 1) {
    try {
      storage.removeItem(entries[i].key);
    } catch {
      // Ignore
    }
  }
}

function normalizeEnvelope<T>(
  raw: Partial<CacheEnvelope<T>> | undefined | null
): CacheEnvelope<T> | null {
  if (
    !raw ||
    typeof raw.savedAt !== 'number' ||
    !('data' in raw) ||
    raw.data === undefined
  ) {
    return null;
  }
  return {
    data: raw.data as T,
    savedAt: raw.savedAt,
    syncedAt: typeof raw.syncedAt === 'number' ? raw.syncedAt : raw.savedAt,
    fullSyncAt:
      typeof raw.fullSyncAt === 'number' ? raw.fullSyncAt : raw.savedAt,
    isFull: raw.isFull,
  };
}

export function getFastCacheEnvelope<T>(
  key: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS
): CacheEnvelope<T> | null {
  const now = Date.now();
  const memHit = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  if (memHit) {
    if (maxAgeMs <= 0 || now - memHit.savedAt <= maxAgeMs) {
      return memHit;
    }
    memoryCache.delete(key);
  }

  const storage = getStorage();
  if (!storage) return null;

  const storageKey = buildStorageKey(key);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed = normalizeEnvelope<T>(
      JSON.parse(raw) as Partial<CacheEnvelope<T>>
    );
    if (!parsed) {
      storage.removeItem(storageKey);
      return null;
    }
    if (maxAgeMs > 0 && now - parsed.savedAt > maxAgeMs) {
      storage.removeItem(storageKey);
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function getFastCache<T>(
  key: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS
): T | null {
  const env = getFastCacheEnvelope<T>(key, maxAgeMs);
  return env ? env.data : null;
}

export function getFastCacheAgeMs(key: string): number {
  const env = getFastCacheEnvelope<unknown>(key, 0);
  if (!env) return Infinity;
  const ref = env.syncedAt ?? env.savedAt;
  return Math.max(0, Date.now() - ref);
}

export function isFastCacheFresh(key: string, freshWindowMs: number): boolean {
  if (freshWindowMs <= 0) return false;
  return getFastCacheAgeMs(key) <= freshWindowMs;
}

export function touchFastCache(
  key: string,
  meta?: {
    syncedAt?: number;
    fullSyncAt?: number;
    isFull?: boolean;
  }
): void {
  const existing = getFastCacheEnvelope<unknown>(key, 0);
  if (!existing) return;

  const now = Date.now();
  const updated: CacheEnvelope<unknown> = {
    ...existing,
    savedAt: now,
    syncedAt: meta?.syncedAt ?? now,
    fullSyncAt: meta?.fullSyncAt ?? existing.fullSyncAt ?? existing.savedAt,
    isFull: meta?.isFull !== undefined ? meta.isFull : existing.isFull,
  };
  memoryCache.set(key, updated);
  void idbSet(key, updated);
}

export function setFastCache<T>(
  key: string,
  data: T,
  options?: SetFastCacheOptions<T>
): void {
  const now = options?.savedAt ?? Date.now();
  const envelope: CacheEnvelope<T> = {
    data,
    savedAt: now,
    syncedAt: options?.syncedAt ?? now,
    fullSyncAt: options?.fullSyncAt ?? now,
    isFull: options?.isFull,
  };
  memoryCache.set(key, envelope);

  // Persist full uncompacted envelope to IndexedDB asynchronously when available
  void idbSet(key, envelope);

  if (options?.idbOnly) {
    return;
  }

  const storage = getStorage();
  if (!storage) return;

  const storageEnvelope: CacheEnvelope<T> = options?.localData
    ? {
        data: options.localData,
        savedAt: envelope.savedAt,
        syncedAt: envelope.syncedAt,
        fullSyncAt: envelope.fullSyncAt,
        isFull: options?.isFull ?? false,
      }
    : envelope;

  const storageKey = buildStorageKey(key);
  let serialized: string;
  try {
    serialized = JSON.stringify(storageEnvelope);
  } catch {
    return;
  }

  try {
    storage.setItem(storageKey, serialized);
  } catch {
    // Storage quota hit (e.g., Base64 images); evict oldest cache items and retry once
    evictOldestCacheEntries(storage, 6);
    try {
      storage.setItem(storageKey, serialized);
    } catch {
      // Memory + IndexedDB caches still hold the full entry cleanly
    }
  }
}

export function invalidateFastCache(key: string): void {
  memoryCache.delete(key);
  void idbDelete(key);

  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(buildStorageKey(key));
  } catch {
    // Ignore
  }
}

export function invalidateFastCachePrefix(prefix: string): void {
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
  void idbDeletePrefix(prefix);

  const storage = getStorage();
  if (!storage) return;

  const fullPrefix = buildStorageKey(prefix);
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i);
    if (k && k.startsWith(fullPrefix)) {
      toRemove.push(k);
    }
  }
  for (const k of toRemove) {
    try {
      storage.removeItem(k);
    } catch {
      // Ignore
    }
  }
}

export function clearAllFastCache(): void {
  memoryCache.clear();
  void idbClear();
  invalidateFastCachePrefix('');
}

export function hasHydratedIdbCache(): boolean {
  return idbHydratedDone;
}

/**
 * Hydrates memoryCache from persistent IndexedDB once on app startup so full
 * multi-image galleries, feeds, and avatars restore cleanly across reloads.
 */
export async function hydrateFastCacheFromIDB(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    idbHydratedDone = true;
    return false;
  }
  if (idbHydrationPromise) {
    return idbHydrationPromise;
  }

  idbHydrationPromise = (async () => {
    let updatedAny = false;
    try {
      const entries = await idbGetAllEntries();
      const now = Date.now();
      for (const entry of entries) {
        if (!entry?.key) continue;
        const parsed = normalizeEnvelope<unknown>(
          entry.value as Partial<CacheEnvelope<unknown>>
        );
        if (!parsed) continue;
        if (now - parsed.savedAt > DEFAULT_MAX_AGE_MS * 2) {
          void idbDelete(entry.key);
          continue;
        }

        const currentMem = memoryCache.get(entry.key);
        const currentIsFull = currentMem?.isFull !== false;
        const incomingIsFull = parsed.isFull !== false;
        const shouldAdopt =
          !currentMem ||
          (incomingIsFull && !currentIsFull) ||
          parsed.savedAt > currentMem.savedAt;

        if (shouldAdopt) {
          memoryCache.set(entry.key, parsed);
          updatedAny = true;
        }
      }
    } catch {
      // Non-blocking fallback
    } finally {
      idbHydratedDone = true;
      if (updatedAny && typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent(CACHE_HYDRATED_EVENT));
        } catch {
          // Ignore environments without CustomEvent
        }
      }
    }
    return updatedAny;
  })();

  return idbHydrationPromise;
}
