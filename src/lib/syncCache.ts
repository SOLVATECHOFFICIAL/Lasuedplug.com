import {
  getFastCacheEnvelope,
  invalidateFastCachePrefix,
  setFastCache,
} from './fastCache';
import { getTimestampMillis } from './homeHelpers';
import { MixedFeedItem } from './trendingHelpers';
import { Accommodation, Product, Store } from '../types';

export const FEED_FRESH_MS = 4 * 60_000; // 4 minutes: skip Firestore reads completely on repeat visits
export const FEED_FULL_RECONCILE_MS = 30 * 60_000; // 30 minutes: delta sync between 4m and 30m
export const DETAIL_FRESH_MS = 10 * 60_000; // 10 minutes: instant cached detail without network reads
export const REVIEWS_FRESH_MS = 10 * 60_000;
export const FAVORITES_FRESH_MS = 10 * 60_000;
export const USER_DP_TTL_MS = 24 * 60 * 60_000; // 24 hours persistent avatar cache

export type SyncStrategy = 'fresh-skip' | 'delta-sync' | 'full-sync';

export interface SyncStrategyInput {
  hasCached: boolean;
  lastSyncedAt?: number;
  lastFullSyncAt?: number;
  nowMs?: number;
  forceRefresh?: boolean;
  freshWindowMs?: number;
  fullReconcileMs?: number;
}

/**
 * Determines whether a screen should skip Firestore completely, run an incremental
 * createdAt-watermark delta query, or perform a full reconciliation sync.
 */
export function resolveSyncStrategy(input: SyncStrategyInput): SyncStrategy {
  const {
    hasCached,
    lastSyncedAt = 0,
    lastFullSyncAt = 0,
    nowMs = Date.now(),
    forceRefresh = false,
    freshWindowMs = FEED_FRESH_MS,
    fullReconcileMs = FEED_FULL_RECONCILE_MS,
  } = input;

  if (forceRefresh || !hasCached) {
    return 'full-sync';
  }

  if (lastSyncedAt > 0 && nowMs - lastSyncedAt < freshWindowMs) {
    return 'fresh-skip';
  }

  if (lastFullSyncAt > 0 && nowMs - lastFullSyncAt < fullReconcileMs) {
    return 'delta-sync';
  }

  return 'full-sync';
}

export function isSyntheticSeedId(id?: string | null): boolean {
  const clean = (id || '').trim();
  return clean.startsWith('seed-') || clean.startsWith('seed_') || clean.startsWith('test_');
}

/**
 * Computes the highest Firestore createdAt timestamp (ms) among cached non-seed records
 * so incremental delta queries only request records created strictly after it.
 */
export function getNewestCreatedAtMs<T extends { id?: string; createdAt?: unknown }>(
  items: ReadonlyArray<T>,
  getCreatedAtMs: (item: T) => number = (item) => getTimestampMillis(item.createdAt)
): number {
  let newest = 0;
  for (const item of items) {
    if (!item || isSyntheticSeedId(item.id)) continue;
    const ms = getCreatedAtMs(item);
    if (Number.isFinite(ms) && ms > newest) {
      newest = ms;
    }
  }
  return newest;
}

/**
 * Merges incoming delta items into an existing cached list without duplicating IDs,
 * sorting newest first and keeping existing items intact.
 */
export function mergeDeltaEntities<T>(
  existing: ReadonlyArray<T>,
  incoming: ReadonlyArray<T>,
  getId: (item: T) => string | undefined,
  getCreatedAtMs: (item: T) => number,
  maxItems = 60
): T[] {
  if (incoming.length === 0) {
    return existing.slice(0, maxItems);
  }

  const byId = new Map<string, T>();
  const anonymous: T[] = [];

  for (const item of existing) {
    const id = getId(item)?.trim();
    if (id) {
      byId.set(id, item);
    } else {
      anonymous.push(item);
    }
  }

  for (const item of incoming) {
    const id = getId(item)?.trim();
    if (id) {
      byId.set(id, item);
    } else {
      anonymous.unshift(item);
    }
  }

  const merged = [...Array.from(byId.values()), ...anonymous];
  merged.sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a));
  return merged.slice(0, maxItems);
}

/**
 * Merges delta MixedFeedItems keyed by `_type:id` and sorted newest first.
 */
export function mergeMixedFeedDelta(
  existing: ReadonlyArray<MixedFeedItem>,
  incoming: ReadonlyArray<MixedFeedItem>,
  maxItems = 80
): MixedFeedItem[] {
  return mergeDeltaEntities(
    existing,
    incoming,
    (item) => (item.id ? `${item._type}:${item.id}` : undefined),
    (item) => getTimestampMillis(item.createdAt),
    maxItems
  );
}

/**
 * Caches an individual entity in RAM + IndexedDB, preserving a multi-image gallery
 * if a full-fidelity version is already cached and the incoming copy was compacted.
 */
export function primeEntityRecord<T extends { images?: string[] }>(
  cacheKey: string,
  entity: T,
  options?: { isFull?: boolean; idbOnly?: boolean; nowMs?: number }
): void {
  if (!cacheKey || !entity) return;

  const existing = getFastCacheEnvelope<T>(cacheKey, 0);
  const incomingCount = Array.isArray(entity.images) ? entity.images.length : 0;
  const existingCount = Array.isArray(existing?.data?.images)
    ? existing!.data.images.length
    : 0;

  let mergedEntity = entity;
  const keptExistingFull =
    Boolean(existing && existing.isFull === true && options?.isFull !== true);
  if (existing && existingCount > incomingCount && options?.isFull !== true) {
    mergedEntity = {
      ...entity,
      images: existing.data.images,
    };
  }

  const resolvedFull = keptExistingFull
    ? true
    : options?.isFull !== undefined
      ? options.isFull
      : existing?.isFull === true || incomingCount > 1;

  const now = options?.nowMs ?? Date.now();
  setFastCache(cacheKey, mergedEntity, {
    idbOnly: options?.idbOnly ?? true,
    savedAt: now,
    syncedAt: options?.isFull || keptExistingFull ? now : existing?.syncedAt ?? now,
    fullSyncAt:
      options?.isFull || keptExistingFull ? now : existing?.fullSyncAt ?? now,
    isFull: resolvedFull,
  });
}

export function primeProductIntoCache(
  product: Product | null | undefined,
  options?: { isFull?: boolean; idbOnly?: boolean }
): void {
  if (!product?.id || isSyntheticSeedId(product.id)) return;
  primeEntityRecord(`product:${product.id}`, product, options);
}

export function primeStoreIntoCache(
  store: Store | null | undefined,
  options?: { isFull?: boolean; idbOnly?: boolean }
): void {
  if (!store?.id || isSyntheticSeedId(store.id)) return;
  primeEntityRecord(`store:${store.id}`, store, options);
}

export function primeAccommodationIntoCache(
  accommodation: Omit<Accommodation, 'exactAddress'> | null | undefined,
  options?: { isFull?: boolean; idbOnly?: boolean }
): void {
  if (!accommodation?.id || isSyntheticSeedId(accommodation.id)) return;
  primeEntityRecord(`accommodation:${accommodation.id}`, accommodation, options);
}

/**
 * Checks whether a cached entity already satisfies a full detail view without blocking
 * on a redundant Firestore getDoc read.
 */
export function shouldSkipDetailNetworkFetch<T extends { images?: string[] }>(
  cacheKey: string,
  options?: {
    force?: boolean;
    freshWindowMs?: number;
    nowMs?: number;
  }
): { skip: boolean; cached: T | null } {
  const freshWindowMs = options?.freshWindowMs ?? DETAIL_FRESH_MS;
  const nowMs = options?.nowMs ?? Date.now();
  const env = getFastCacheEnvelope<T>(cacheKey, 0);
  if (!env) {
    return { skip: false, cached: null };
  }
  if (options?.force) {
    return { skip: false, cached: env.data };
  }

  const refTime = env.syncedAt ?? env.savedAt;
  const isFresh = refTime > 0 && nowMs - refTime < freshWindowMs;
  const isFullFidelity = env.isFull !== false;

  return {
    skip: isFresh && isFullFidelity,
    cached: env.data,
  };
}

/**
 * Marks all public feed caches stale so newly created/edited/approved items appear
 * cleanly on the next navigation without wiping cached UI during transitions.
 */
export function invalidatePublicFeedCaches(entityKeys?: {
  productId?: string;
  storeId?: string;
  accommodationId?: string;
  sellerId?: string;
}): void {
  invalidateFastCachePrefix('home_');
  invalidateFastCachePrefix('mkt_');
  invalidateFastCachePrefix('services_');
  invalidateFastCachePrefix('accommodations_');
  invalidateFastCachePrefix('roommates_');
  invalidateFastCachePrefix('approved_stores');

  if (entityKeys?.productId) {
    invalidateFastCachePrefix(`product:${entityKeys.productId}`);
  }
  if (entityKeys?.storeId) {
    invalidateFastCachePrefix(`store:${entityKeys.storeId}`);
    invalidateFastCachePrefix(`store_profile:${entityKeys.storeId}`);
  }
  if (entityKeys?.accommodationId) {
    invalidateFastCachePrefix(`accommodation:${entityKeys.accommodationId}`);
  }
  if (entityKeys?.sellerId) {
    invalidateFastCachePrefix(`seller_profile:${entityKeys.sellerId}`);
  }
}

const SESSION_VIEWED_KEY = 'lasuedplug_session_viewed_v1';
const memoryViewedIds = new Set<string>();

export interface SimpleStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function getDefaultSessionStorage(): SimpleStorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Returns true once per browser session for a listing ID so navigating back & forth
 * from cached lists does not trigger repeated viewCount Firestore writes.
 */
export function claimSessionViewTrack(
  listingId: string,
  storage: SimpleStorageLike | null = getDefaultSessionStorage()
): boolean {
  const cleanId = listingId.trim();
  if (!cleanId || isSyntheticSeedId(cleanId)) return false;

  if (memoryViewedIds.has(cleanId)) {
    return false;
  }

  let storedList: string[] = [];
  if (storage) {
    try {
      const raw = storage.getItem(SESSION_VIEWED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          storedList = parsed.filter((x): x is string => typeof x === 'string');
        }
      }
    } catch {
      storedList = [];
    }
    if (storedList.includes(cleanId)) {
      memoryViewedIds.add(cleanId);
      return false;
    }
  }

  memoryViewedIds.add(cleanId);
  if (storage) {
    try {
      const next = [cleanId, ...storedList].slice(0, 100);
      storage.setItem(SESSION_VIEWED_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures
    }
  }
  return true;
}

export function resetSessionViewMemoryForTests(): void {
  memoryViewedIds.clear();
}
