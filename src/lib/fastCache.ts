const CACHE_KEY_PREFIX = 'lasuedplug_fc_v1:';
const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours stale-while-revalidate window

interface CacheEnvelope<T> {
  data: T;
  savedAt: number;
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>();

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

export function getFastCache<T>(
  key: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS
): T | null {
  const now = Date.now();
  const memHit = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  if (memHit) {
    if (maxAgeMs <= 0 || now - memHit.savedAt <= maxAgeMs) {
      return memHit.data;
    }
    memoryCache.delete(key);
  }

  const storage = getStorage();
  if (!storage) return null;

  const storageKey = buildStorageKey(key);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>;
    if (
      !parsed ||
      typeof parsed.savedAt !== 'number' ||
      !('data' in parsed) ||
      parsed.data === undefined
    ) {
      storage.removeItem(storageKey);
      return null;
    }
    if (maxAgeMs > 0 && now - parsed.savedAt > maxAgeMs) {
      storage.removeItem(storageKey);
      return null;
    }
    memoryCache.set(key, { data: parsed.data, savedAt: parsed.savedAt });
    return parsed.data;
  } catch {
    return null;
  }
}

export function setFastCache<T>(key: string, data: T): void {
  const envelope: CacheEnvelope<T> = {
    data,
    savedAt: Date.now(),
  };
  memoryCache.set(key, envelope);

  const storage = getStorage();
  if (!storage) return;

  const storageKey = buildStorageKey(key);
  let serialized: string;
  try {
    serialized = JSON.stringify(envelope);
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
      // Memory cache still holds the entry cleanly
    }
  }
}

export function invalidateFastCache(key: string): void {
  memoryCache.delete(key);
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
  invalidateFastCachePrefix('');
}
