const MISSING_INDEX_STORAGE_KEY = 'lasuedplug_missing_indexes_v1';

const missingIndexKeys = new Set<string>();
const inflightQueries = new Map<string, Promise<unknown>>();
let storageHydrated = false;

function hydrateMissingIndexCache(): void {
  if (storageHydrated) return;
  storageHydrated = true;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(MISSING_INDEX_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (typeof item === 'string' && item) {
              missingIndexKeys.add(item);
            }
          });
        }
      }
    }
  } catch {
    // Ignore restricted sessionStorage
  }
}

export function hasKnownMissingIndex(indexKey: string): boolean {
  hydrateMissingIndexCache();
  return missingIndexKeys.has(indexKey);
}

export function markMissingIndex(indexKey: string): void {
  hydrateMissingIndexCache();
  if (!indexKey || missingIndexKeys.has(indexKey)) return;
  missingIndexKeys.add(indexKey);
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(
        MISSING_INDEX_STORAGE_KEY,
        JSON.stringify(Array.from(missingIndexKeys))
      );
    }
  } catch {
    // Ignore restricted sessionStorage
  }
}

export function clearMissingIndexCache(): void {
  storageHydrated = true;
  missingIndexKeys.clear();
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(MISSING_INDEX_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

/**
 * Deduplicates concurrent in-flight async calls sharing the same cache key.
 */
export function runDeduplicatedQuery<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = inflightQueries.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const promise = fetcher().finally(() => {
    inflightQueries.delete(key);
  });

  inflightQueries.set(key, promise);
  return promise;
}

/**
 * Strips extra images (beyond cover image[0]) when storing listing arrays
 * in localStorage fastCache so 5MB storage limits aren't exceeded by Base64 arrays.
 */
export function compactListingsForCache<T extends { images?: string[] }>(
  items: ReadonlyArray<T>,
  maxItems = 24
): T[] {
  return items.slice(0, maxItems).map((item) => {
    if (!Array.isArray(item.images) || item.images.length <= 1) {
      return item;
    }
    return {
      ...item,
      images: [item.images[0]],
    };
  });
}

function compactNestedImages<T extends { images?: string[] }>(
  entity: T | undefined
): T | undefined {
  if (!entity || !Array.isArray(entity.images) || entity.images.length <= 1) {
    return entity;
  }
  return {
    ...entity,
    images: [entity.images[0]],
  };
}

export function compactMixedFeedForCache<
  T extends {
    product?: { images?: string[] };
    service?: { images?: string[] };
    store?: { images?: string[] };
    accommodation?: { images?: string[] };
  }
>(items: ReadonlyArray<T>, maxItems = 24): T[] {
  return items.slice(0, maxItems).map((item) => ({
    ...item,
    ...(item.product ? { product: compactNestedImages(item.product) } : {}),
    ...(item.service ? { service: compactNestedImages(item.service) } : {}),
    ...(item.store ? { store: compactNestedImages(item.store) } : {}),
    ...(item.accommodation
      ? { accommodation: compactNestedImages(item.accommodation) }
      : {}),
  }));
}
