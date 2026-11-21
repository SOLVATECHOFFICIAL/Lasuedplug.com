import {
  getFastCacheEnvelope,
  getFastCacheKeysWithPrefix,
  invalidateFastCache,
  invalidateFastCachePrefix,
  setFastCache,
} from './fastCache';
import {
  compactListingsForCache,
  compactMixedFeedForCache,
} from './firestoreQueryCache';
import { getTimestampMillis } from './homeHelpers';
import {
  clearRecentlyViewedByType,
  removeRecentlyViewedIds,
} from './recentlyViewed';
import { getListingAdType } from './marketplaceHelpers';
import { MixedFeedItem } from './trendingHelpers';
import {
  Accommodation,
  Product,
  RoommateRequest,
  Service,
  Store,
} from '../types';

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
  if (!product?.id) return;
  primeEntityRecord(`product:${product.id}`, product, options);
}

export function primeLegacyServiceIntoCache(
  service: Service | null | undefined,
  options?: { isFull?: boolean; idbOnly?: boolean }
): void {
  if (!service?.id) return;
  const normalizedProduct: Product = {
    id: service.id,
    sellerId: service.providerId,
    adType: 'service',
    title: service.title,
    description: service.description,
    categoryId: service.categoryId,
    subcategory: service.subcategory,
    priceType: service.priceType,
    price: service.price,
    priceUnit: service.priceUnit,
    images: service.images || [],
    whatsappNumber: service.whatsappNumber,
    landmark: service.landmark,
    latitude: service.latitude,
    longitude: service.longitude,
    locationName: service.locationName,
    shopName: service.shopName,
    hasDelivery: service.hasDelivery,
    viewCount: service.viewCount ?? 0,
    contactCount: service.contactCount ?? 0,
    status: service.status,
    isApproved: service.isApproved,
    isActive: service.isActive,
    createdAt: service.createdAt,
    sellerSnapshot: service.sellerSnapshot,
  };
  primeEntityRecord(`product:${service.id}`, normalizedProduct, options);
}

export function primeStoreIntoCache(
  store: Store | null | undefined,
  options?: { isFull?: boolean; idbOnly?: boolean }
): void {
  if (!store?.id) return;
  primeEntityRecord(`store:${store.id}`, store, options);
}

export function primeAccommodationIntoCache(
  accommodation: Omit<Accommodation, 'exactAddress'> | null | undefined,
  options?: { isFull?: boolean; idbOnly?: boolean }
): void {
  if (!accommodation?.id) return;
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

export type MixedFeedCollectionKind =
  | 'products'
  | 'legacyServices'
  | 'stores'
  | 'accommodations';

export function getMixedFeedCollectionKind(
  item: MixedFeedItem
): MixedFeedCollectionKind {
  if (item._type === 'store' || item.store) {
    return 'stores';
  }
  if (item._type === 'accommodation' || item.accommodation) {
    return 'accommodations';
  }
  if (item._type === 'service' && item.service && !item.product) {
    return 'legacyServices';
  }
  return 'products';
}

export function replaceMixedFeedCollectionSlice(
  existing: ReadonlyArray<MixedFeedItem>,
  kind: MixedFeedCollectionKind,
  incomingSlice: ReadonlyArray<MixedFeedItem>,
  maxItems = 80
): MixedFeedItem[] {
  const preserved = existing.filter(
    (item) => getMixedFeedCollectionKind(item) !== kind
  );
  const byKey = new Map<string, MixedFeedItem>();
  for (const item of preserved) {
    if (item.id) {
      byKey.set(`${item._type}:${item.id}`, item);
    }
  }
  for (const item of incomingSlice) {
    if (item.id) {
      byKey.set(`${item._type}:${item.id}`, item);
    }
  }
  const merged = Array.from(byKey.values());
  merged.sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
  );
  return merged.slice(0, maxItems);
}

export function getEntityContentSignature(entity: unknown): string {
  if (!entity || typeof entity !== 'object') return '';
  const rec = entity as Record<string, unknown>;
  const id = typeof rec.id === 'string' ? rec.id : '';
  const title =
    typeof rec.title === 'string'
      ? rec.title
      : typeof rec.name === 'string'
        ? rec.name
        : '';
  const price =
    typeof rec.price === 'number'
      ? rec.price
      : typeof rec.rentPrice === 'number'
        ? rec.rentPrice
        : typeof rec.budget === 'number'
          ? rec.budget
          : '';
  const status = typeof rec.status === 'string' ? rec.status : '';
  const approved = rec.isApproved === true ? '1' : '0';
  const active = rec.isActive === false ? '0' : '1';
  const quantity = typeof rec.quantity === 'number' ? rec.quantity : '';
  const updatedMs = getTimestampMillis(rec.updatedAt);
  const createdMs = getTimestampMillis(rec.createdAt);
  const images = Array.isArray(rec.images) ? rec.images : [];
  const firstImg = typeof images[0] === 'string' ? images[0].slice(0, 64) : '';
  const logoUrl =
    typeof rec.logoUrl === 'string' ? rec.logoUrl.slice(0, 64) : '';
  const descLen =
    typeof rec.description === 'string' ? rec.description.length : 0;
  const verified =
    rec.isVerified === true ||
    (rec.sellerSnapshot as Record<string, unknown> | undefined)?.isVerified ===
      true ||
    (rec.ownerSnapshot as Record<string, unknown> | undefined)?.isVerified ===
      true ||
    (rec.userSnapshot as Record<string, unknown> | undefined)?.isVerified ===
      true
      ? '1'
      : '0';

  return [
    id,
    title,
    price,
    status,
    approved,
    active,
    quantity,
    updatedMs,
    createdMs,
    images.length,
    firstImg || logoUrl,
    descLen,
    verified,
  ].join('|');
}

export function haveListsDiverged<T>(
  existing: ReadonlyArray<T>,
  incoming: ReadonlyArray<T>,
  getSig: (item: T) => string = getEntityContentSignature
): boolean {
  if (existing.length !== incoming.length) {
    return true;
  }
  for (let i = 0; i < existing.length; i += 1) {
    if (getSig(existing[i]) !== getSig(incoming[i])) {
      return true;
    }
  }
  return false;
}

export function getMixedFeedItemSignature(item: MixedFeedItem): string {
  const embedded = item.product || item.service || item.store || item.accommodation;
  return [
    item._type,
    item.id,
    item.title,
    item.sellerId,
    item.isVerified ? '1' : '0',
    item.trustScore,
    getTimestampMillis(item.createdAt),
    embedded ? getEntityContentSignature(embedded) : '',
  ].join('|');
}

function updateCachedListRemovingIds<T extends { id?: string }>(
  cacheKey: string,
  removeSet: ReadonlySet<string>,
  compactLimit = 24
): void {
  const env = getFastCacheEnvelope<T[]>(cacheKey, 0);
  if (!env || !Array.isArray(env.data) || env.data.length === 0) {
    return;
  }
  const filtered = env.data.filter(
    (entry) => !entry.id || !removeSet.has(entry.id)
  );
  if (filtered.length === env.data.length) {
    return;
  }
  setFastCache(cacheKey, filtered, {
    localData: compactListingsForCache(filtered as Array<T & { images?: string[] }>, compactLimit) as unknown as T[],
    isFull: env.isFull,
    syncedAt: env.syncedAt,
    fullSyncAt: env.fullSyncAt,
  });
}

export function pruneDeletedIdsFromAllCaches(
  entityKind: 'product' | 'legacyService' | 'store' | 'accommodation' | 'roommate',
  removedIds: ReadonlyArray<string>
): void {
  const cleanIds = removedIds.map((id) => id.trim()).filter(Boolean);
  if (cleanIds.length === 0) return;

  const removeSet = new Set(cleanIds);

  if (entityKind === 'product' || entityKind === 'legacyService') {
    for (const id of cleanIds) {
      invalidateFastCache(`product:${id}`);
    }

    // Prune home_mixed_feed & home_trending_feed
    for (const feedKey of ['home_mixed_feed', 'home_trending_feed'] as const) {
      const env = getFastCacheEnvelope<MixedFeedItem[]>(feedKey, 0);
      if (env && Array.isArray(env.data) && env.data.length > 0) {
        const filtered = env.data.filter((item) => {
          if (!removeSet.has(item.id)) return true;
          if (entityKind === 'product') {
            return item._type !== 'item' && !(item._type === 'service' && item.product);
          }
          return !(item._type === 'service' && item.service && !item.product);
        });
        if (filtered.length !== env.data.length) {
          setFastCache(feedKey, filtered, {
            localData: compactMixedFeedForCache(filtered, 24),
            isFull: env.isFull,
            syncedAt: env.syncedAt,
            fullSyncAt: env.fullSyncAt,
          });
        }
      }
    }

    if (entityKind === 'product') {
      updateCachedListRemovingIds<Product>('mkt_trending', removeSet, 8);
      updateCachedListRemovingIds<Product>('mkt_browse_default', removeSet, 24);
      for (const catKey of getFastCacheKeysWithPrefix('mkt_browse_cat:')) {
        updateCachedListRemovingIds<Product>(catKey, removeSet, 24);
      }
      const allItemsEnv = getFastCacheEnvelope<Product[]>('mkt_all_items', 0);
      if (allItemsEnv && Array.isArray(allItemsEnv.data)) {
        const filteredAll = allItemsEnv.data.filter(
          (item) => !item.id || !removeSet.has(item.id)
        );
        if (filteredAll.length !== allItemsEnv.data.length) {
          setFastCache('mkt_all_items', filteredAll, {
            idbOnly: true,
            syncedAt: allItemsEnv.syncedAt,
            fullSyncAt: allItemsEnv.fullSyncAt,
          });
        }
      }
    }

    const svcEnv = getFastCacheEnvelope<{
      productServices: Product[];
      legacyServices: Service[];
    }>('services_feed', 0);
    if (svcEnv?.data) {
      const nextProducts =
        entityKind === 'product'
          ? svcEnv.data.productServices.filter(
              (p) => !p.id || !removeSet.has(p.id)
            )
          : svcEnv.data.productServices;
      const nextLegacy =
        entityKind === 'legacyService'
          ? svcEnv.data.legacyServices.filter(
              (s) => !s.id || !removeSet.has(s.id)
            )
          : svcEnv.data.legacyServices;
      if (
        nextProducts.length !== svcEnv.data.productServices.length ||
        nextLegacy.length !== svcEnv.data.legacyServices.length
      ) {
        setFastCache(
          'services_feed',
          { productServices: nextProducts, legacyServices: nextLegacy },
          {
            localData: {
              productServices: compactListingsForCache(nextProducts, 24),
              legacyServices: compactListingsForCache(nextLegacy, 24),
            },
            isFull: svcEnv.isFull,
            syncedAt: svcEnv.syncedAt,
            fullSyncAt: svcEnv.fullSyncAt,
          }
        );
      }
    }

    removeRecentlyViewedIds(cleanIds, 'item');
    removeRecentlyViewedIds(cleanIds, 'service');
    return;
  }

  if (entityKind === 'store') {
    for (const id of cleanIds) {
      invalidateFastCache(`store:${id}`);
      invalidateFastCache(`store_profile:${id}`);
    }
    updateCachedListRemovingIds<Store>('approved_stores', removeSet, 24);
    const homeEnv = getFastCacheEnvelope<MixedFeedItem[]>('home_mixed_feed', 0);
    if (homeEnv && Array.isArray(homeEnv.data)) {
      const filtered = homeEnv.data.filter(
        (item) => !(item._type === 'store' && removeSet.has(item.id))
      );
      if (filtered.length !== homeEnv.data.length) {
        setFastCache('home_mixed_feed', filtered, {
          localData: compactMixedFeedForCache(filtered, 24),
          isFull: homeEnv.isFull,
          syncedAt: homeEnv.syncedAt,
          fullSyncAt: homeEnv.fullSyncAt,
        });
      }
    }
    removeRecentlyViewedIds(cleanIds, 'store');
    return;
  }

  if (entityKind === 'accommodation') {
    for (const id of cleanIds) {
      invalidateFastCache(`accommodation:${id}`);
    }
    updateCachedListRemovingIds<Accommodation>(
      'accommodations_feed',
      removeSet,
      24
    );
    const homeEnv = getFastCacheEnvelope<MixedFeedItem[]>('home_mixed_feed', 0);
    if (homeEnv && Array.isArray(homeEnv.data)) {
      const filtered = homeEnv.data.filter(
        (item) => !(item._type === 'accommodation' && removeSet.has(item.id))
      );
      if (filtered.length !== homeEnv.data.length) {
        setFastCache('home_mixed_feed', filtered, {
          localData: compactMixedFeedForCache(filtered, 24),
          isFull: homeEnv.isFull,
          syncedAt: homeEnv.syncedAt,
          fullSyncAt: homeEnv.fullSyncAt,
        });
      }
    }
    removeRecentlyViewedIds(cleanIds, 'accommodation');
    return;
  }

  if (entityKind === 'roommate') {
    updateCachedListRemovingIds<RoommateRequest>(
      'roommates_feed',
      removeSet,
      24
    );
  }
}

export function clearCollectionFromAllCaches(
  scope:
    | 'products_all'
    | 'products_item'
    | 'products_service'
    | 'legacyServices'
    | 'stores'
    | 'accommodations'
    | 'roommates'
): void {
  if (scope === 'products_all' || scope === 'products_item') {
    setFastCache('mkt_trending', [], { localData: [], isFull: true });
    setFastCache('mkt_browse_default', [], { localData: [], isFull: true });
    for (const catKey of getFastCacheKeysWithPrefix('mkt_browse_cat:')) {
      setFastCache(catKey, [], { localData: [], isFull: true });
    }
    setFastCache('mkt_all_items', [], { idbOnly: true, isFull: true });
    clearRecentlyViewedByType('item');
  }

  if (scope === 'products_all' || scope === 'products_service') {
    const svcEnv = getFastCacheEnvelope<{
      productServices: Product[];
      legacyServices: Service[];
    }>('services_feed', 0);
    if (svcEnv?.data) {
      setFastCache(
        'services_feed',
        {
          productServices: [],
          legacyServices: svcEnv.data.legacyServices,
        },
        {
          localData: {
            productServices: [],
            legacyServices: compactListingsForCache(
              svcEnv.data.legacyServices,
              24
            ),
          },
          isFull: true,
        }
      );
    }
  }

  if (scope === 'legacyServices') {
    const svcEnv = getFastCacheEnvelope<{
      productServices: Product[];
      legacyServices: Service[];
    }>('services_feed', 0);
    if (svcEnv?.data) {
      setFastCache(
        'services_feed',
        {
          productServices: svcEnv.data.productServices,
          legacyServices: [],
        },
        {
          localData: {
            productServices: compactListingsForCache(
              svcEnv.data.productServices,
              24
            ),
            legacyServices: [],
          },
          isFull: true,
        }
      );
    }
  }

  if (
    scope === 'products_all' ||
    scope === 'products_item' ||
    scope === 'products_service' ||
    scope === 'legacyServices'
  ) {
    if (scope === 'products_all') {
      invalidateFastCachePrefix('product:');
      clearRecentlyViewedByType('service');
    } else if (scope === 'products_item' || scope === 'products_service') {
      const targetAd = scope === 'products_item' ? 'item' : 'service';
      for (const pKey of getFastCacheKeysWithPrefix('product:')) {
        const env = getFastCacheEnvelope<Product>(pKey, 0);
        if (env?.data && getListingAdType(env.data) === targetAd) {
          invalidateFastCache(pKey);
        }
      }
      if (scope === 'products_service') {
        clearRecentlyViewedByType('service');
      }
    }

    for (const feedKey of ['home_mixed_feed', 'home_trending_feed'] as const) {
      const env = getFastCacheEnvelope<MixedFeedItem[]>(feedKey, 0);
      if (env && Array.isArray(env.data)) {
        const filtered = env.data.filter((item) => {
          if (scope === 'products_all') {
            return getMixedFeedCollectionKind(item) !== 'products';
          }
          if (scope === 'products_item') {
            return !(
              getMixedFeedCollectionKind(item) === 'products' &&
              item._type === 'item'
            );
          }
          if (scope === 'products_service') {
            return !(
              getMixedFeedCollectionKind(item) === 'products' &&
              item._type === 'service'
            );
          }
          return getMixedFeedCollectionKind(item) !== 'legacyServices';
        });
        setFastCache(feedKey, filtered, {
          localData: compactMixedFeedForCache(filtered, 24),
          isFull: true,
        });
      }
    }
    return;
  }

  if (scope === 'stores') {
    invalidateFastCachePrefix('store:');
    invalidateFastCachePrefix('store_profile:');
    setFastCache('approved_stores', [], { localData: [], isFull: true });
    const homeEnv = getFastCacheEnvelope<MixedFeedItem[]>('home_mixed_feed', 0);
    if (homeEnv && Array.isArray(homeEnv.data)) {
      const next = replaceMixedFeedCollectionSlice(homeEnv.data, 'stores', []);
      setFastCache('home_mixed_feed', next, {
        localData: compactMixedFeedForCache(next, 24),
        isFull: true,
      });
    }
    clearRecentlyViewedByType('store');
    return;
  }

  if (scope === 'accommodations') {
    invalidateFastCachePrefix('accommodation:');
    setFastCache('accommodations_feed', [], { localData: [], isFull: true });
    const homeEnv = getFastCacheEnvelope<MixedFeedItem[]>('home_mixed_feed', 0);
    if (homeEnv && Array.isArray(homeEnv.data)) {
      const next = replaceMixedFeedCollectionSlice(
        homeEnv.data,
        'accommodations',
        []
      );
      setFastCache('home_mixed_feed', next, {
        localData: compactMixedFeedForCache(next, 24),
        isFull: true,
      });
    }
    clearRecentlyViewedByType('accommodation');
    return;
  }

  if (scope === 'roommates') {
    setFastCache('roommates_feed', [], { localData: [], isFull: true });
  }
}

