import {
  collection,
  doc,
  FirestoreError,
  getCountFromServer,
  getDocFromServer,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  Query,
  QueryConstraint,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getUserAvatarUrl } from './authHelpers';
import { sanitizePublicAccommodation } from './accommodationHelpers';
import { getFastCache, invalidateFastCache, setFastCache } from './fastCache';
import {
  hasKnownMissingIndex,
  markMissingIndex,
  runDeduplicatedQuery,
} from './firestoreQueryCache';
import { filterAndSortListings, getTimestampMillis } from './homeHelpers';
import { fetchPublicUserTrustMap, primeMixedFeedEntities } from './homeService';
import { warmImages } from './imageCache';
import { getListingAdType } from './marketplaceHelpers';
import { primeProductsListIntoCache } from './marketplaceService';
import { primeAccommodationsIntoCache } from './accommodationService';
import { fetchReviewsForTarget } from './reviewService';
import { primeStoresIntoCache } from './storeService';
import {
  clearCollectionFromAllCaches,
  getEntityContentSignature,
  isSyntheticSeedId,
  primeAccommodationIntoCache,
  primeLegacyServiceIntoCache,
  primeProductIntoCache,
  primeStoreIntoCache,
  pruneDeletedIdsFromAllCaches,
} from './syncCache';
import {
  accommodationToMixedFeedItem,
  compareByEngagement,
  MixedFeedItem,
  productToMixedFeedItem,
  serviceToMixedFeedItem,
  storeToMixedFeedItem,
} from './trendingHelpers';
import { primeUserProfilePic } from './userAvatarCache';
import {
  Accommodation,
  AdType,
  Product,
  Review,
  RoommateRequest,
  Service,
  Store,
  UserProfile,
} from '../types';

const SERVER_COUNT_PREFIX = 'srv_cnt:';
const SERVER_HEAD_PREFIX = 'srv_head:';

function getSavedServerCount(sliceKey: string): number | null {
  const cached = getFastCache<{ count: number }>(
    `${SERVER_COUNT_PREFIX}${sliceKey}`,
    1000 * 60 * 60 * 24
  );
  return typeof cached?.count === 'number' ? cached.count : null;
}

function saveServerCount(sliceKey: string, count: number): void {
  setFastCache(`${SERVER_COUNT_PREFIX}${sliceKey}`, { count });
}

function getSavedServerHeadSig(sliceKey: string): string | null {
  const cached = getFastCache<{ sig: string }>(
    `${SERVER_HEAD_PREFIX}${sliceKey}`,
    1000 * 60 * 60 * 24
  );
  return typeof cached?.sig === 'string' ? cached.sig : null;
}

function saveServerHeadSig(sliceKey: string, sig: string): void {
  setFastCache(`${SERVER_HEAD_PREFIX}${sliceKey}`, { sig });
}

function isNetworkUnavailableError(err: unknown): boolean {
  const code = (err as FirestoreError | undefined)?.code;
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted'
  );
}

function isPermissionDeniedError(err: unknown): boolean {
  return (err as FirestoreError | undefined)?.code === 'permission-denied';
}

function isMissingIndexError(err: unknown): boolean {
  return (err as FirestoreError | undefined)?.code === 'failed-precondition';
}

async function fetchCountWithFallback(
  collectionName: string,
  primaryConstraints: QueryConstraint[],
  fallbackConstraints: QueryConstraint[],
  indexKey: string
): Promise<{ count: number; exact: boolean } | null> {
  if (!db) return null;
  const colRef = collection(db, collectionName);

  const runFallback = async () => {
    try {
      const snap = await getCountFromServer(query(colRef, ...fallbackConstraints));
      return { count: snap.data().count, exact: false };
    } catch {
      return null;
    }
  };

  if (hasKnownMissingIndex(indexKey)) {
    return runFallback();
  }

  try {
    const snap = await getCountFromServer(query(colRef, ...primaryConstraints));
    return { count: snap.data().count, exact: true };
  } catch (err) {
    if (isMissingIndexError(err)) {
      markMissingIndex(indexKey);
      return runFallback();
    }
    if (isNetworkUnavailableError(err)) {
      return null;
    }
    return null;
  }
}

async function fetchHeadSignatureFromServer(
  collectionName: string,
  constraints: QueryConstraint[],
  indexKey: string
): Promise<string | null> {
  if (!db || hasKnownMissingIndex(indexKey)) return null;
  try {
    const q = query(
      collection(db, collectionName),
      ...constraints,
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocsFromServer(q);
    if (snap.empty) return 'empty';
    const d = snap.docs[0];
    return getEntityContentSignature({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    });
  } catch (err) {
    if (isMissingIndexError(err)) {
      markMissingIndex(indexKey);
    }
    return null;
  }
}

function computeRemovedIdsForSlice<T extends { id?: string; createdAt?: unknown }>(
  cachedItems: ReadonlyArray<T>,
  serverItems: ReadonlyArray<T>,
  limitCount: number
): string[] {
  const serverIds = new Set(
    serverItems.map((item) => item.id).filter(Boolean) as string[]
  );
  const reachedEnd = serverItems.length < limitCount;
  let oldestServerMs = Infinity;
  if (!reachedEnd) {
    for (const item of serverItems) {
      const ms = getTimestampMillis(item.createdAt);
      if (ms > 0 && ms < oldestServerMs) {
        oldestServerMs = ms;
      }
    }
  }

  const removed: string[] = [];
  for (const item of cachedItems) {
    const id = item.id?.trim();
    if (!id || isSyntheticSeedId(id)) continue;
    if (serverIds.has(id)) continue;
    if (reachedEnd) {
      removed.push(id);
    } else {
      const itemMs = getTimestampMillis(item.createdAt);
      if (itemMs === 0 || itemMs >= oldestServerMs) {
        removed.push(id);
      }
    }
  }
  return removed;
}

interface SliceSyncDecision {
  shouldPurgeZero: boolean;
  shouldFetchServer: boolean;
  serverCount: number | null;
  headSig: string | null;
}

async function evaluateSliceNeedsSync(options: {
  sliceKey: string;
  collectionName: string;
  countConstraints: QueryConstraint[];
  fallbackCountConstraints: QueryConstraint[];
  countIndexKey: string;
  headIndexKey: string;
  cachedCount: number;
  cachedHeadSig: string;
  tickIndex: number;
  checkHeadOnThisTick: boolean;
  deepVerifyEveryTicks?: number;
}): Promise<SliceSyncDecision> {
  const countRes = await fetchCountWithFallback(
    options.collectionName,
    options.countConstraints,
    options.fallbackCountConstraints,
    options.countIndexKey
  );

  if (!countRes) {
    return {
      shouldPurgeZero: false,
      shouldFetchServer: false,
      serverCount: null,
      headSig: null,
    };
  }

  const serverCount = countRes.count;
  const prevCount = getSavedServerCount(options.sliceKey);

  if (serverCount === 0) {
    saveServerCount(options.sliceKey, 0);
    saveServerHeadSig(options.sliceKey, 'empty');
    return {
      shouldPurgeZero: options.cachedCount > 0 || prevCount !== 0,
      shouldFetchServer: false,
      serverCount: 0,
      headSig: 'empty',
    };
  }

  const countChanged =
    (prevCount !== null && serverCount !== prevCount) ||
    (countRes.exact && serverCount < options.cachedCount) ||
    (options.cachedCount === 0 && serverCount > 0);

  if (countChanged) {
    return {
      shouldPurgeZero: false,
      shouldFetchServer: true,
      serverCount,
      headSig: null,
    };
  }

  const deepInterval = options.deepVerifyEveryTicks ?? 24;
  if (deepInterval > 0 && options.tickIndex > 0 && options.tickIndex % deepInterval === 0) {
    return {
      shouldPurgeZero: false,
      shouldFetchServer: true,
      serverCount,
      headSig: null,
    };
  }

  if (options.checkHeadOnThisTick || prevCount === null) {
    const headSig = await fetchHeadSignatureFromServer(
      options.collectionName,
      options.countConstraints,
      options.headIndexKey
    );
    if (headSig !== null) {
      const prevHead = getSavedServerHeadSig(options.sliceKey);
      const headDiffers =
        (prevHead !== null && headSig !== prevHead) ||
        (Boolean(options.cachedHeadSig) && headSig !== options.cachedHeadSig);
      saveServerCount(options.sliceKey, serverCount);
      if (headDiffers) {
        return {
          shouldPurgeZero: false,
          shouldFetchServer: true,
          serverCount,
          headSig,
        };
      }
      saveServerHeadSig(options.sliceKey, headSig);
    }
  } else {
    saveServerCount(options.sliceKey, serverCount);
  }

  return {
    shouldPurgeZero: false,
    shouldFetchServer: false,
    serverCount,
    headSig: null,
  };
}

async function getDocsServerWithFallback<T extends { id?: string }>(
  collectionName: string,
  primaryQ: Query,
  fallbackQ: Query,
  indexKey: string,
  mapDoc: (id: string, data: Record<string, unknown>) => T,
  fallbackFilterSort: (rows: T[]) => T[]
): Promise<T[] | null> {
  if (!db) return null;

  const runFallback = async (): Promise<T[] | null> => {
    try {
      const snap = await getDocsFromServer(fallbackQ);
      const rows = snap.docs.map((d) =>
        mapDoc(d.id, d.data() as Record<string, unknown>)
      );
      return fallbackFilterSort(rows);
    } catch (err) {
      if (isNetworkUnavailableError(err)) return null;
      return null;
    }
  };

  if (hasKnownMissingIndex(indexKey)) {
    return runFallback();
  }

  try {
    const snap = await getDocsFromServer(primaryQ);
    return snap.docs.map((d) =>
      mapDoc(d.id, d.data() as Record<string, unknown>)
    );
  } catch (err) {
    if (isMissingIndexError(err)) {
      markMissingIndex(indexKey);
      return runFallback();
    }
    if (isNetworkUnavailableError(err)) {
      return null;
    }
    return null;
  }
}

export interface ReconcileSliceOutcome<T> {
  changed: boolean;
  cleared: boolean;
  items: T[];
  removedIds: string[];
}

/**
 * Reconciles a Marketplace browse feed (or category slice) against Firebase server truth.
 */
export async function reconcileMarketplaceBrowseSlice(options: {
  cachedProducts: ReadonlyArray<Product>;
  categoryId?: string;
  limitCount?: number;
  tickIndex: number;
  forceHeadCheck?: boolean;
}): Promise<ReconcileSliceOutcome<Product>> {
  if (!db) {
    return {
      changed: false,
      cleared: false,
      items: [...options.cachedProducts],
      removedIds: [],
    };
  }

  const limitCount = options.limitCount ?? 12;
  const trimmedCat = options.categoryId?.trim() || '';
  const sliceKey = trimmedCat ? `mkt_item:${trimmedCat}` : 'mkt_item:all';
  const countConstraints: QueryConstraint[] = [
    where('isApproved', '==', true),
    where('isActive', '==', true),
    where('adType', '==', 'item'),
  ];
  if (trimmedCat) {
    countConstraints.push(where('categoryId', '==', trimmedCat));
  }

  const cachedNonSeed = options.cachedProducts.filter(
    (p) => p.id && !isSyntheticSeedId(p.id)
  );
  const cachedHeadSig = cachedNonSeed[0]
    ? getEntityContentSignature(cachedNonSeed[0])
    : '';

  const decision = await evaluateSliceNeedsSync({
    sliceKey,
    collectionName: 'products',
    countConstraints,
    fallbackCountConstraints: [where('isApproved', '==', true)],
    countIndexKey: `${sliceKey}:count`,
    headIndexKey: `${sliceKey}:head`,
    cachedCount: cachedNonSeed.length,
    cachedHeadSig,
    tickIndex: options.tickIndex,
    checkHeadOnThisTick:
      Boolean(options.forceHeadCheck) ||
      options.tickIndex === 0 ||
      options.tickIndex % 4 === 0,
  });

  if (decision.shouldPurgeZero) {
    const removedIds = cachedNonSeed
      .map((p) => p.id)
      .filter(Boolean) as string[];
    if (trimmedCat) {
      setFastCache(`mkt_browse_cat:${trimmedCat}`, [], {
        localData: [],
        isFull: true,
      });
      if (removedIds.length > 0) {
        pruneDeletedIdsFromAllCaches('product', removedIds);
      }
    } else {
      clearCollectionFromAllCaches('products_item');
    }
    return { changed: true, cleared: true, items: [], removedIds };
  }

  if (!decision.shouldFetchServer) {
    return {
      changed: false,
      cleared: false,
      items: [...options.cachedProducts],
      removedIds: [],
    };
  }

  const colRef = collection(db, 'products');
  const primaryQ = query(
    colRef,
    ...countConstraints,
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const fallbackQ = query(
    colRef,
    where('isApproved', '==', true),
    limit(Math.max(limitCount * 4, 48))
  );

  const serverRows = await getDocsServerWithFallback<Product>(
    'products',
    primaryQ,
    fallbackQ,
    `products:list:item:${trimmedCat}::newest`,
    (id, data) => ({ id, ...(data as Omit<Product, 'id'>) }),
    (rows) =>
      filterAndSortListings(
        rows.filter(
          (item) =>
            item.isApproved === true &&
            item.isActive === true &&
            item.categoryId !== 'accommodation' &&
            getListingAdType(item) === 'item' &&
            (!trimmedCat || item.categoryId === trimmedCat)
        ),
        limitCount
      )
  );

  if (serverRows === null) {
    return {
      changed: false,
      cleared: false,
      items: [...options.cachedProducts],
      removedIds: [],
    };
  }

  const cleanRows = serverRows.filter(
    (item) =>
      item.categoryId !== 'accommodation' && getListingAdType(item) === 'item'
  );

  if (decision.serverCount !== null) {
    saveServerCount(sliceKey, decision.serverCount);
  }
  saveServerHeadSig(
    sliceKey,
    cleanRows[0] ? getEntityContentSignature(cleanRows[0]) : 'empty'
  );

  const removedIds = computeRemovedIdsForSlice(
    cachedNonSeed,
    cleanRows,
    limitCount
  );
  if (removedIds.length > 0) {
    pruneDeletedIdsFromAllCaches('product', removedIds);
  }
  primeProductsListIntoCache(cleanRows, true);

  return {
    changed: true,
    cleared: cleanRows.length === 0,
    items: cleanRows,
    removedIds,
  };
}

/**
 * Fetches trending products directly from Firestore server when the items slice changed.
 */
export async function fetchTrendingProductsFromServer(
  limitCount = 8
): Promise<Product[] | null> {
  if (!db) return null;
  const colRef = collection(db, 'products');
  const primaryQ = query(
    colRef,
    where('isApproved', '==', true),
    where('isActive', '==', true),
    where('adType', '==', 'item'),
    orderBy('viewCount', 'desc'),
    limit(limitCount)
  );
  const fallbackQ = query(
    colRef,
    where('isApproved', '==', true),
    limit(Math.max(limitCount * 5, 40))
  );

  const rows = await getDocsServerWithFallback<Product>(
    'products',
    primaryQ,
    fallbackQ,
    'products:approved_active_item_viewCount',
    (id, data) => ({ id, ...(data as Omit<Product, 'id'>) }),
    (docs) =>
      docs
        .filter(
          (item) =>
            item.isApproved === true &&
            item.isActive === true &&
            item.categoryId !== 'accommodation' &&
            getListingAdType(item) === 'item'
        )
        .sort((a, b) => {
          const viewDiff = (b.viewCount || 0) - (a.viewCount || 0);
          if (viewDiff !== 0) return viewDiff;
          const contactDiff = (b.contactCount || 0) - (a.contactCount || 0);
          if (contactDiff !== 0) return contactDiff;
          return (
            getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
          );
        })
        .slice(0, limitCount)
  );

  if (!rows) return null;
  const clean = rows.filter(
    (item) =>
      item.categoryId !== 'accommodation' && getListingAdType(item) === 'item'
  );
  primeProductsListIntoCache(clean, true);
  return clean;
}

export async function fetchAllApprovedActiveItemsFromServer(): Promise<
  Product[] | null
> {
  if (!db) return null;
  const colRef = collection(db, 'products');
  const primaryQ = query(
    colRef,
    where('isApproved', '==', true),
    where('isActive', '==', true),
    limit(120)
  );
  const fallbackQ = query(
    colRef,
    where('isApproved', '==', true),
    limit(120)
  );

  const rows = await getDocsServerWithFallback<Product>(
    'products',
    primaryQ,
    fallbackQ,
    'products:approved_active_item_all',
    (id, data) => ({ id, ...(data as Omit<Product, 'id'>) }),
    (docs) =>
      docs.filter(
        (item) =>
          item.isApproved === true &&
          item.isActive === true &&
          item.categoryId !== 'accommodation' &&
          getListingAdType(item) === 'item'
      )
  );

  if (!rows) return null;
  const clean = rows.filter(
    (item) =>
      item.categoryId !== 'accommodation' && getListingAdType(item) === 'item'
  );
  primeProductsListIntoCache(clean, true);
  return clean;
}

/**
 * Reconciles Services (adType=='service'), Legacy Services, and Stores against server truth.
 */
export async function reconcileServicesAndStoresSlices(options: {
  cachedProductServices: ReadonlyArray<Product>;
  cachedLegacyServices: ReadonlyArray<Service>;
  cachedStores: ReadonlyArray<Store>;
  tickIndex: number;
  forceHeadCheck?: boolean;
}): Promise<{
  servicesChanged: boolean;
  storesChanged: boolean;
  productServices: Product[];
  legacyServices: Service[];
  stores: Store[];
}> {
  const checkHead =
    Boolean(options.forceHeadCheck) ||
    options.tickIndex === 0 ||
    options.tickIndex % 4 === 0;

  const cachedProdNonSeed = options.cachedProductServices.filter(
    (p) => p.id && !isSyntheticSeedId(p.id)
  );
  const cachedLegacyNonSeed = options.cachedLegacyServices.filter(
    (s) => s.id && !isSyntheticSeedId(s.id)
  );
  const cachedStoresNonSeed = options.cachedStores.filter(
    (s) => s.id && !isSyntheticSeedId(s.id)
  );

  const checkLegacy =
    cachedLegacyNonSeed.length > 0 ||
    options.tickIndex === 0 ||
    options.tickIndex % 3 === 0;

  const [prodDecision, legacyDecision, storesDecision] = await Promise.all([
    evaluateSliceNeedsSync({
      sliceKey: 'svc_products',
      collectionName: 'products',
      countConstraints: [
        where('isApproved', '==', true),
        where('isActive', '==', true),
        where('adType', '==', 'service'),
      ],
      fallbackCountConstraints: [where('isApproved', '==', true)],
      countIndexKey: 'svc_products:count',
      headIndexKey: 'svc_products:head',
      cachedCount: cachedProdNonSeed.length,
      cachedHeadSig: cachedProdNonSeed[0]
        ? getEntityContentSignature(cachedProdNonSeed[0])
        : '',
      tickIndex: options.tickIndex,
      checkHeadOnThisTick: checkHead,
    }),
    checkLegacy
      ? evaluateSliceNeedsSync({
          sliceKey: 'legacy_services',
          collectionName: 'services',
          countConstraints: [
            where('isApproved', '==', true),
            where('isActive', '==', true),
          ],
          fallbackCountConstraints: [where('isApproved', '==', true)],
          countIndexKey: 'legacy_services:count',
          headIndexKey: 'legacy_services:head',
          cachedCount: cachedLegacyNonSeed.length,
          cachedHeadSig: cachedLegacyNonSeed[0]
            ? getEntityContentSignature(cachedLegacyNonSeed[0])
            : '',
          tickIndex: options.tickIndex,
          checkHeadOnThisTick: checkHead,
        })
      : Promise.resolve<SliceSyncDecision>({
          shouldPurgeZero: false,
          shouldFetchServer: false,
          serverCount: null,
          headSig: null,
        }),
    evaluateSliceNeedsSync({
      sliceKey: 'stores',
      collectionName: 'stores',
      countConstraints: [
        where('isApproved', '==', true),
        where('isActive', '==', true),
      ],
      fallbackCountConstraints: [where('isApproved', '==', true)],
      countIndexKey: 'stores:count',
      headIndexKey: 'stores:head',
      cachedCount: cachedStoresNonSeed.length,
      cachedHeadSig: cachedStoresNonSeed[0]
        ? getEntityContentSignature(cachedStoresNonSeed[0])
        : '',
      tickIndex: options.tickIndex,
      checkHeadOnThisTick: checkHead,
    }),
  ]);

  let nextProductServices = [...options.cachedProductServices];
  let nextLegacyServices = [...options.cachedLegacyServices];
  let nextStores = [...options.cachedStores];
  let servicesChanged = false;
  let storesChanged = false;

  if (prodDecision.shouldPurgeZero) {
    nextProductServices = [];
    clearCollectionFromAllCaches('products_service');
    servicesChanged = true;
  } else if (prodDecision.shouldFetchServer && db) {
    const colRef = collection(db, 'products');
    const serverProdSvc = await getDocsServerWithFallback<Product>(
      'products',
      query(
        colRef,
        where('isApproved', '==', true),
        where('isActive', '==', true),
        where('adType', '==', 'service'),
        limit(120)
      ),
      query(colRef, where('isApproved', '==', true), limit(120)),
      'products:approved_active_service_all',
      (id, data) => ({ id, ...(data as Omit<Product, 'id'>) }),
      (docs) =>
        docs.filter(
          (item) =>
            item.isApproved === true &&
            item.isActive === true &&
            item.categoryId !== 'accommodation' &&
            getListingAdType(item) === 'service'
        )
    );

    if (serverProdSvc !== null) {
      const clean = serverProdSvc
        .filter(
          (item) =>
            item.categoryId !== 'accommodation' &&
            getListingAdType(item) === 'service'
        )
        .sort(
          (a, b) =>
            getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
      if (prodDecision.serverCount !== null) {
        saveServerCount('svc_products', prodDecision.serverCount);
      }
      saveServerHeadSig(
        'svc_products',
        clean[0] ? getEntityContentSignature(clean[0]) : 'empty'
      );
      const removed = computeRemovedIdsForSlice(cachedProdNonSeed, clean, 120);
      if (removed.length > 0) {
        pruneDeletedIdsFromAllCaches('product', removed);
      }
      primeProductsListIntoCache(clean, true);
      nextProductServices = clean;
      servicesChanged = true;
    }
  }

  if (legacyDecision.shouldPurgeZero) {
    nextLegacyServices = [];
    clearCollectionFromAllCaches('legacyServices');
    servicesChanged = true;
  } else if (legacyDecision.shouldFetchServer && db) {
    const colRef = collection(db, 'services');
    const serverLegacy = await getDocsServerWithFallback<Service>(
      'services',
      query(
        colRef,
        where('isApproved', '==', true),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(40)
      ),
      query(colRef, where('isApproved', '==', true), limit(80)),
      'services:approved_active_createdAt',
      (id, data) => ({ id, ...(data as Omit<Service, 'id'>) }),
      (docs) => filterAndSortListings(docs, 40)
    );

    if (serverLegacy !== null) {
      if (legacyDecision.serverCount !== null) {
        saveServerCount('legacy_services', legacyDecision.serverCount);
      }
      saveServerHeadSig(
        'legacy_services',
        serverLegacy[0] ? getEntityContentSignature(serverLegacy[0]) : 'empty'
      );
      const removed = computeRemovedIdsForSlice(
        cachedLegacyNonSeed,
        serverLegacy,
        40
      );
      if (removed.length > 0) {
        pruneDeletedIdsFromAllCaches('legacyService', removed);
      }
      const seenProdIds = new Set(
        nextProductServices.map((p) => p.id).filter(Boolean)
      );
      nextLegacyServices = serverLegacy.filter(
        (s) => !s.id || !seenProdIds.has(s.id)
      );
      nextLegacyServices.forEach((s) =>
        primeLegacyServiceIntoCache(s, { isFull: true, idbOnly: true })
      );
      servicesChanged = true;
    }
  }

  if (storesDecision.shouldPurgeZero) {
    nextStores = [];
    clearCollectionFromAllCaches('stores');
    storesChanged = true;
  } else if (storesDecision.shouldFetchServer && db) {
    const colRef = collection(db, 'stores');
    const serverStores = await getDocsServerWithFallback<Store>(
      'stores',
      query(
        colRef,
        where('isApproved', '==', true),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(60)
      ),
      query(colRef, where('isApproved', '==', true), limit(60)),
      'stores:approved_active_createdAt',
      (id, data) => ({ id, ...(data as Omit<Store, 'id'>) }),
      (docs) =>
        docs
          .filter((s) => s.isApproved === true && s.isActive !== false)
          .sort(
            (a, b) =>
              getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
          )
    );

    if (serverStores !== null) {
      if (storesDecision.serverCount !== null) {
        saveServerCount('stores', storesDecision.serverCount);
      }
      saveServerHeadSig(
        'stores',
        serverStores[0] ? getEntityContentSignature(serverStores[0]) : 'empty'
      );
      const removed = computeRemovedIdsForSlice(
        cachedStoresNonSeed,
        serverStores,
        60
      );
      if (removed.length > 0) {
        pruneDeletedIdsFromAllCaches('store', removed);
      }
      primeStoresIntoCache(serverStores, true);
      nextStores = serverStores;
      storesChanged = true;
    }
  }

  return {
    servicesChanged,
    storesChanged,
    productServices: nextProductServices,
    legacyServices: nextLegacyServices,
    stores: nextStores,
  };
}

/**
 * Reconciles Accommodations against Firebase server truth.
 */
export async function reconcileAccommodationsSlice(options: {
  cachedItems: ReadonlyArray<Omit<Accommodation, 'exactAddress'>>;
  tickIndex: number;
  forceHeadCheck?: boolean;
}): Promise<ReconcileSliceOutcome<Omit<Accommodation, 'exactAddress'>>> {
  if (!db) {
    return {
      changed: false,
      cleared: false,
      items: [...options.cachedItems],
      removedIds: [],
    };
  }

  const cachedNonSeed = options.cachedItems.filter(
    (a) => a.id && !isSyntheticSeedId(a.id)
  );
  const decision = await evaluateSliceNeedsSync({
    sliceKey: 'accommodations',
    collectionName: 'accommodations',
    countConstraints: [
      where('isApproved', '==', true),
      where('isActive', '==', true),
    ],
    fallbackCountConstraints: [where('isApproved', '==', true)],
    countIndexKey: 'accommodations:count',
    headIndexKey: 'accommodations:head',
    cachedCount: cachedNonSeed.length,
    cachedHeadSig: cachedNonSeed[0]
      ? getEntityContentSignature(cachedNonSeed[0])
      : '',
    tickIndex: options.tickIndex,
    checkHeadOnThisTick:
      Boolean(options.forceHeadCheck) ||
      options.tickIndex === 0 ||
      options.tickIndex % 4 === 0,
  });

  if (decision.shouldPurgeZero) {
    const removedIds = cachedNonSeed
      .map((a) => a.id)
      .filter(Boolean) as string[];
    clearCollectionFromAllCaches('accommodations');
    return { changed: true, cleared: true, items: [], removedIds };
  }

  if (!decision.shouldFetchServer) {
    return {
      changed: false,
      cleared: false,
      items: [...options.cachedItems],
      removedIds: [],
    };
  }

  const colRef = collection(db, 'accommodations');
  const serverRows = await getDocsServerWithFallback<
    Omit<Accommodation, 'exactAddress'>
  >(
    'accommodations',
    query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(60)
    ),
    query(colRef, where('isApproved', '==', true), limit(60)),
    'accommodations:approved_active_createdAt',
    (id, data) =>
      sanitizePublicAccommodation({
        id,
        ...(data as Omit<Accommodation, 'id'>),
      }),
    (docs) =>
      docs
        .filter((item) => item.isApproved === true && item.isActive === true)
        .sort(
          (a, b) =>
            getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        )
  );

  if (serverRows === null) {
    return {
      changed: false,
      cleared: false,
      items: [...options.cachedItems],
      removedIds: [],
    };
  }

  if (decision.serverCount !== null) {
    saveServerCount('accommodations', decision.serverCount);
  }
  saveServerHeadSig(
    'accommodations',
    serverRows[0] ? getEntityContentSignature(serverRows[0]) : 'empty'
  );

  const removedIds = computeRemovedIdsForSlice(cachedNonSeed, serverRows, 60);
  if (removedIds.length > 0) {
    pruneDeletedIdsFromAllCaches('accommodation', removedIds);
  }
  primeAccommodationsIntoCache(serverRows, true);

  return {
    changed: true,
    cleared: serverRows.length === 0,
    items: serverRows,
    removedIds,
  };
}

/**
 * Reconciles Roommate Requests against Firebase server truth.
 */
export async function reconcileRoommatesSlice(options: {
  cachedItems: ReadonlyArray<RoommateRequest>;
  tickIndex: number;
  forceHeadCheck?: boolean;
}): Promise<ReconcileSliceOutcome<RoommateRequest>> {
  if (!db) {
    return {
      changed: false,
      cleared: false,
      items: [...options.cachedItems],
      removedIds: [],
    };
  }

  const cachedNonSeed = options.cachedItems.filter(
    (r) => r.id && !isSyntheticSeedId(r.id)
  );
  const decision = await evaluateSliceNeedsSync({
    sliceKey: 'roommates',
    collectionName: 'roommate_requests',
    countConstraints: [
      where('isApproved', '==', true),
      where('isActive', '==', true),
    ],
    fallbackCountConstraints: [where('isApproved', '==', true)],
    countIndexKey: 'roommates:count',
    headIndexKey: 'roommates:head',
    cachedCount: cachedNonSeed.length,
    cachedHeadSig: cachedNonSeed[0]
      ? getEntityContentSignature(cachedNonSeed[0])
      : '',
    tickIndex: options.tickIndex,
    checkHeadOnThisTick:
      Boolean(options.forceHeadCheck) ||
      options.tickIndex === 0 ||
      options.tickIndex % 4 === 0,
  });

  if (decision.shouldPurgeZero) {
    const removedIds = cachedNonSeed
      .map((r) => r.id)
      .filter(Boolean) as string[];
    clearCollectionFromAllCaches('roommates');
    return { changed: true, cleared: true, items: [], removedIds };
  }

  if (!decision.shouldFetchServer) {
    return {
      changed: false,
      cleared: false,
      items: [...options.cachedItems],
      removedIds: [],
    };
  }

  const colRef = collection(db, 'roommate_requests');
  const serverRows = await getDocsServerWithFallback<RoommateRequest>(
    'roommate_requests',
    query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(60)
    ),
    query(colRef, where('isApproved', '==', true), limit(60)),
    'roommate_requests:approved_active_createdAt',
    (id, data) => ({
      id,
      ...(data as Omit<RoommateRequest, 'id'>),
      images: Array.isArray(data.images) ? (data.images as string[]) : [],
    }),
    (docs) =>
      docs
        .filter((item) => item.isApproved === true && item.isActive === true)
        .sort(
          (a, b) =>
            getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        )
  );

  if (serverRows === null) {
    return {
      changed: false,
      cleared: false,
      items: [...options.cachedItems],
      removedIds: [],
    };
  }

  if (decision.serverCount !== null) {
    saveServerCount('roommates', decision.serverCount);
  }
  saveServerHeadSig(
    'roommates',
    serverRows[0] ? getEntityContentSignature(serverRows[0]) : 'empty'
  );

  const removedIds = computeRemovedIdsForSlice(cachedNonSeed, serverRows, 60);
  if (removedIds.length > 0) {
    pruneDeletedIdsFromAllCaches('roommate', removedIds);
  }
  warmImages(
    serverRows.map((r) => r.images?.[0]),
    12
  );

  return {
    changed: true,
    cleared: serverRows.length === 0,
    items: serverRows,
    removedIds,
  };
}

/**
 * Reconciles the Home mixed feed collection-by-collection using 1-read count checks.
 * Only collections whose server count/head actually changed are re-fetched from server!
 */
export async function reconcileHomeMixedFeed(options: {
  cachedMixed: ReadonlyArray<MixedFeedItem>;
  tickIndex: number;
  forceHeadCheck?: boolean;
  limitPerCollection?: number;
}): Promise<{
  changed: boolean;
  items: MixedFeedItem[];
  removedProductIds: string[];
  removedStoreIds: string[];
  removedAccommodationIds: string[];
}> {
  if (!db) {
    return {
      changed: false,
      items: [...options.cachedMixed],
      removedProductIds: [],
      removedStoreIds: [],
      removedAccommodationIds: [],
    };
  }

  const limitPerCollection = options.limitPerCollection ?? 20;
  const checkHead =
    Boolean(options.forceHeadCheck) ||
    options.tickIndex === 0 ||
    options.tickIndex % 4 === 0;

  const cachedProducts: Product[] = [];
  const cachedLegacyServices: Service[] = [];
  const cachedStores: Store[] = [];
  const cachedAccommodations: Accommodation[] = [];

  for (const item of options.cachedMixed) {
    if (item.id && isSyntheticSeedId(item.id)) continue;
    if (item._type === 'store' && item.store) {
      cachedStores.push(item.store);
    } else if (item._type === 'accommodation' && item.accommodation) {
      cachedAccommodations.push(item.accommodation);
    } else if (item._type === 'service' && item.service && !item.product) {
      cachedLegacyServices.push(item.service);
    } else if (item.product) {
      cachedProducts.push(item.product);
    }
  }

  const checkLegacy =
    cachedLegacyServices.length > 0 ||
    options.tickIndex === 0 ||
    options.tickIndex % 3 === 0;

  const [prodDecision, legacyDecision, storesDecision, accDecision] =
    await Promise.all([
      evaluateSliceNeedsSync({
        sliceKey: 'home_products',
        collectionName: 'products',
        countConstraints: [
          where('isApproved', '==', true),
          where('isActive', '==', true),
        ],
        fallbackCountConstraints: [where('isApproved', '==', true)],
        countIndexKey: 'home_products:count',
        headIndexKey: 'home_products:head',
        cachedCount: cachedProducts.length,
        cachedHeadSig: cachedProducts[0]
          ? getEntityContentSignature(cachedProducts[0])
          : '',
        tickIndex: options.tickIndex,
        checkHeadOnThisTick: checkHead,
      }),
      checkLegacy
        ? evaluateSliceNeedsSync({
            sliceKey: 'legacy_services',
            collectionName: 'services',
            countConstraints: [
              where('isApproved', '==', true),
              where('isActive', '==', true),
            ],
            fallbackCountConstraints: [where('isApproved', '==', true)],
            countIndexKey: 'legacy_services:count',
            headIndexKey: 'legacy_services:head',
            cachedCount: cachedLegacyServices.length,
            cachedHeadSig: cachedLegacyServices[0]
              ? getEntityContentSignature(cachedLegacyServices[0])
              : '',
            tickIndex: options.tickIndex,
            checkHeadOnThisTick: checkHead,
          })
        : Promise.resolve<SliceSyncDecision>({
            shouldPurgeZero: false,
            shouldFetchServer: false,
            serverCount: null,
            headSig: null,
          }),
      evaluateSliceNeedsSync({
        sliceKey: 'stores',
        collectionName: 'stores',
        countConstraints: [
          where('isApproved', '==', true),
          where('isActive', '==', true),
        ],
        fallbackCountConstraints: [where('isApproved', '==', true)],
        countIndexKey: 'stores:count',
        headIndexKey: 'stores:head',
        cachedCount: cachedStores.length,
        cachedHeadSig: cachedStores[0]
          ? getEntityContentSignature(cachedStores[0])
          : '',
        tickIndex: options.tickIndex,
        checkHeadOnThisTick: checkHead,
      }),
      evaluateSliceNeedsSync({
        sliceKey: 'accommodations',
        collectionName: 'accommodations',
        countConstraints: [
          where('isApproved', '==', true),
          where('isActive', '==', true),
        ],
        fallbackCountConstraints: [where('isApproved', '==', true)],
        countIndexKey: 'accommodations:count',
        headIndexKey: 'accommodations:head',
        cachedCount: cachedAccommodations.length,
        cachedHeadSig: cachedAccommodations[0]
          ? getEntityContentSignature(cachedAccommodations[0])
          : '',
        tickIndex: options.tickIndex,
        checkHeadOnThisTick: checkHead,
      }),
    ]);

  let nextProducts = cachedProducts;
  let nextLegacy = cachedLegacyServices;
  let nextStores = cachedStores;
  let nextAcc = cachedAccommodations;
  let anyChanged = false;
  let removedProductIds: string[] = [];
  let removedStoreIds: string[] = [];
  let removedAccommodationIds: string[] = [];

  const fetches: Promise<void>[] = [];

  if (prodDecision.shouldPurgeZero) {
    removedProductIds = cachedProducts
      .map((p) => p.id)
      .filter(Boolean) as string[];
    nextProducts = [];
    clearCollectionFromAllCaches('products_all');
    anyChanged = true;
  } else if (prodDecision.shouldFetchServer && db) {
    const colRef = collection(db, 'products');
    const prodLimit = limitPerCollection * 2;
    fetches.push(
      getDocsServerWithFallback<Product>(
        'products',
        query(
          colRef,
          where('isApproved', '==', true),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(prodLimit)
        ),
        query(
          colRef,
          where('isApproved', '==', true),
          limit(Math.max(prodLimit * 2, 48))
        ),
        'products:approved_active_createdAt',
        (id, data) => ({ id, ...(data as Omit<Product, 'id'>) }),
        (docs) => filterAndSortListings(docs, prodLimit)
      ).then((rows) => {
        if (rows === null) return;
        const clean = rows.filter((p) => p.categoryId !== 'accommodation');
        if (prodDecision.serverCount !== null) {
          saveServerCount('home_products', prodDecision.serverCount);
        }
        saveServerHeadSig(
          'home_products',
          clean[0] ? getEntityContentSignature(clean[0]) : 'empty'
        );
        removedProductIds = computeRemovedIdsForSlice(
          cachedProducts,
          clean,
          prodLimit
        );
        if (removedProductIds.length > 0) {
          pruneDeletedIdsFromAllCaches('product', removedProductIds);
        }
        nextProducts = clean;
        anyChanged = true;
      })
    );
  }

  if (legacyDecision.shouldPurgeZero) {
    const remLegacy = cachedLegacyServices
      .map((s) => s.id)
      .filter(Boolean) as string[];
    if (remLegacy.length > 0) {
      pruneDeletedIdsFromAllCaches('legacyService', remLegacy);
    }
    nextLegacy = [];
    clearCollectionFromAllCaches('legacyServices');
    anyChanged = true;
  } else if (legacyDecision.shouldFetchServer && db) {
    const colRef = collection(db, 'services');
    fetches.push(
      getDocsServerWithFallback<Service>(
        'services',
        query(
          colRef,
          where('isApproved', '==', true),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(limitPerCollection)
        ),
        query(
          colRef,
          where('isApproved', '==', true),
          limit(Math.max(limitPerCollection * 2, 36))
        ),
        'services:approved_active_createdAt',
        (id, data) => ({ id, ...(data as Omit<Service, 'id'>) }),
        (docs) => filterAndSortListings(docs, limitPerCollection)
      ).then((rows) => {
        if (rows === null) return;
        if (legacyDecision.serverCount !== null) {
          saveServerCount('legacy_services', legacyDecision.serverCount);
        }
        saveServerHeadSig(
          'legacy_services',
          rows[0] ? getEntityContentSignature(rows[0]) : 'empty'
        );
        const remLegacy = computeRemovedIdsForSlice(
          cachedLegacyServices,
          rows,
          limitPerCollection
        );
        if (remLegacy.length > 0) {
          pruneDeletedIdsFromAllCaches('legacyService', remLegacy);
        }
        nextLegacy = rows;
        anyChanged = true;
      })
    );
  }

  if (storesDecision.shouldPurgeZero) {
    removedStoreIds = cachedStores
      .map((s) => s.id)
      .filter(Boolean) as string[];
    nextStores = [];
    clearCollectionFromAllCaches('stores');
    anyChanged = true;
  } else if (storesDecision.shouldFetchServer && db) {
    const colRef = collection(db, 'stores');
    fetches.push(
      getDocsServerWithFallback<Store>(
        'stores',
        query(
          colRef,
          where('isApproved', '==', true),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(60)
        ),
        query(colRef, where('isApproved', '==', true), limit(60)),
        'stores:approved_active_createdAt',
        (id, data) => ({ id, ...(data as Omit<Store, 'id'>) }),
        (docs) =>
          docs
            .filter((s) => s.isApproved === true && s.isActive !== false)
            .sort(
              (a, b) =>
                getTimestampMillis(b.createdAt) -
                getTimestampMillis(a.createdAt)
            )
      ).then((rows) => {
        if (rows === null) return;
        if (storesDecision.serverCount !== null) {
          saveServerCount('stores', storesDecision.serverCount);
        }
        saveServerHeadSig(
          'stores',
          rows[0] ? getEntityContentSignature(rows[0]) : 'empty'
        );
        removedStoreIds = computeRemovedIdsForSlice(cachedStores, rows, 60);
        if (removedStoreIds.length > 0) {
          pruneDeletedIdsFromAllCaches('store', removedStoreIds);
        }
        nextStores = rows;
        anyChanged = true;
      })
    );
  }

  if (accDecision.shouldPurgeZero) {
    removedAccommodationIds = cachedAccommodations
      .map((a) => a.id)
      .filter(Boolean) as string[];
    nextAcc = [];
    clearCollectionFromAllCaches('accommodations');
    anyChanged = true;
  } else if (accDecision.shouldFetchServer && db) {
    const colRef = collection(db, 'accommodations');
    fetches.push(
      getDocsServerWithFallback<Accommodation>(
        'accommodations',
        query(
          colRef,
          where('isApproved', '==', true),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(limitPerCollection)
        ),
        query(
          colRef,
          where('isApproved', '==', true),
          limit(Math.max(limitPerCollection * 2, 36))
        ),
        'accommodations:approved_active_createdAt',
        (id, data) =>
          sanitizePublicAccommodation({
            id,
            ...(data as Omit<Accommodation, 'id'>),
          }),
        (docs) => filterAndSortListings(docs, limitPerCollection)
      ).then((rows) => {
        if (rows === null) return;
        if (accDecision.serverCount !== null) {
          saveServerCount('accommodations', accDecision.serverCount);
        }
        saveServerHeadSig(
          'accommodations',
          rows[0] ? getEntityContentSignature(rows[0]) : 'empty'
        );
        removedAccommodationIds = computeRemovedIdsForSlice(
          cachedAccommodations,
          rows,
          limitPerCollection
        );
        if (removedAccommodationIds.length > 0) {
          pruneDeletedIdsFromAllCaches('accommodation', removedAccommodationIds);
        }
        nextAcc = rows;
        anyChanged = true;
      })
    );
  }

  if (fetches.length > 0) {
    await Promise.all(fetches);
  }

  if (!anyChanged) {
    return {
      changed: false,
      items: [...options.cachedMixed],
      removedProductIds: [],
      removedStoreIds: [],
      removedAccommodationIds: [],
    };
  }

  const seenProductIds = new Set(
    nextProducts.map((p) => p.id).filter(Boolean) as string[]
  );
  const uniqueLegacy = nextLegacy.filter(
    (s) => !s.id || !seenProductIds.has(s.id)
  );

  const sellerIds: string[] = [
    ...nextProducts.map((p) => p.sellerId),
    ...uniqueLegacy.map((s) => s.providerId),
    ...nextStores.map((st) => st.ownerId),
    ...nextAcc.map((a) => a.ownerId),
  ];

  const userTrustMap = await fetchPublicUserTrustMap(sellerIds);
  const mixed: MixedFeedItem[] = [
    ...nextProducts.map((p) =>
      productToMixedFeedItem(p, userTrustMap[p.sellerId])
    ),
    ...uniqueLegacy.map((s) =>
      serviceToMixedFeedItem(s, userTrustMap[s.providerId])
    ),
    ...nextStores.map((st) => storeToMixedFeedItem(st, userTrustMap[st.ownerId])),
    ...nextAcc.map((acc) =>
      accommodationToMixedFeedItem(acc, userTrustMap[acc.ownerId])
    ),
  ];

  mixed.sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
  );

  primeMixedFeedEntities(mixed, true);

  return {
    changed: true,
    items: mixed,
    removedProductIds,
    removedStoreIds,
    removedAccommodationIds,
  };
}

/**
 * Fetches trending products for Home tab from server when products changed.
 */
export async function fetchHomeTrendingProductsFromServer(): Promise<
  MixedFeedItem[] | null
> {
  if (!db) return null;
  const colRef = collection(db, 'products');
  const rows = await getDocsServerWithFallback<Product>(
    'products',
    query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      orderBy('contactCount', 'desc'),
      orderBy('viewCount', 'desc'),
      limit(30)
    ),
    query(colRef, where('isApproved', '==', true), limit(60)),
    'products:approved_active_contact_view',
    (id, data) => ({ id, ...(data as Omit<Product, 'id'>) }),
    (docs) =>
      docs
        .filter((p) => p.isActive !== false && p.categoryId !== 'accommodation')
        .sort(compareByEngagement)
        .slice(0, 30)
  );
  if (!rows) return null;
  const clean = rows.filter((p) => p.categoryId !== 'accommodation');
  const sellerIds = clean.map((p) => p.sellerId);
  const userTrustMap = await fetchPublicUserTrustMap(sellerIds);
  return clean.map((p) => {
    primeProductIntoCache(p, { isFull: true, idbOnly: true });
    return productToMixedFeedItem(p, userTrustMap[p.sellerId]);
  });
}

// =========================================================================
// Single-Entity Detail Page Server-Truth Verification (1 read per check)
// =========================================================================

export type DetailVerifyResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'deleted' }
  | { status: 'offline-keep-cache' };

export async function verifyProductOnServer(
  id: string,
  options?: { viewerUid?: string; isAdmin?: boolean }
): Promise<DetailVerifyResult<Product>> {
  const cleanId = id.trim();
  if (!cleanId || !db) {
    return { status: 'offline-keep-cache' };
  }

  return runDeduplicatedQuery(`verify:product:${cleanId}`, async () => {
    try {
      const snap = await getDocFromServer(doc(db!, 'products', cleanId));
      if (snap.exists()) {
        const product: Product = {
          id: snap.id,
          ...(snap.data() as Omit<Product, 'id'>),
        };
        const canViewPrivate = Boolean(
          options?.isAdmin ||
            (options?.viewerUid && options.viewerUid === product.sellerId)
        );
        if ((!product.isApproved || product.isActive === false) && !canViewPrivate) {
          pruneDeletedIdsFromAllCaches('product', [cleanId]);
          return { status: 'deleted' };
        }
        primeProductIntoCache(product, { isFull: true, idbOnly: false });
        return { status: 'ok', data: product };
      }

      // Check legacy services collection only if not in products
      const legacySnap = await getDocFromServer(doc(db!, 'services', cleanId));
      if (legacySnap.exists()) {
        const data = legacySnap.data() as Record<string, unknown>;
        const legacyProduct: Product = {
          ...(data as Omit<Product, 'id'>),
          id: legacySnap.id,
          sellerId:
            typeof data.providerId === 'string'
              ? data.providerId
              : typeof data.sellerId === 'string'
                ? data.sellerId
                : '',
          adType: 'service' as AdType,
        };
        const canViewPrivate = Boolean(
          options?.isAdmin ||
            (options?.viewerUid && options.viewerUid === legacyProduct.sellerId)
        );
        if (
          (!legacyProduct.isApproved || legacyProduct.isActive === false) &&
          !canViewPrivate
        ) {
          pruneDeletedIdsFromAllCaches('legacyService', [cleanId]);
          return { status: 'deleted' };
        }
        primeProductIntoCache(legacyProduct, { isFull: true, idbOnly: false });
        return { status: 'ok', data: legacyProduct };
      }

      pruneDeletedIdsFromAllCaches('product', [cleanId]);
      pruneDeletedIdsFromAllCaches('legacyService', [cleanId]);
      return { status: 'deleted' };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        pruneDeletedIdsFromAllCaches('product', [cleanId]);
        pruneDeletedIdsFromAllCaches('legacyService', [cleanId]);
        return { status: 'deleted' };
      }
      if (isNetworkUnavailableError(err)) {
        return { status: 'offline-keep-cache' };
      }
      return { status: 'offline-keep-cache' };
    }
  });
}

export async function verifyAccommodationOnServer(
  id: string,
  options?: { viewerUid?: string; isAdmin?: boolean }
): Promise<DetailVerifyResult<Omit<Accommodation, 'exactAddress'>>> {
  const cleanId = id.trim();
  if (!cleanId || !db) {
    return { status: 'offline-keep-cache' };
  }

  return runDeduplicatedQuery(`verify:accommodation:${cleanId}`, async () => {
    try {
      const snap = await getDocFromServer(doc(db!, 'accommodations', cleanId));
      if (!snap.exists()) {
        pruneDeletedIdsFromAllCaches('accommodation', [cleanId]);
        return { status: 'deleted' };
      }
      const record = sanitizePublicAccommodation({
        id: snap.id,
        ...(snap.data() as Omit<Accommodation, 'id'>),
      });
      const canViewPrivate = Boolean(
        options?.isAdmin ||
          (options?.viewerUid && options.viewerUid === record.ownerId)
      );
      if ((!record.isApproved || record.isActive === false) && !canViewPrivate) {
        pruneDeletedIdsFromAllCaches('accommodation', [cleanId]);
        return { status: 'deleted' };
      }
      primeAccommodationIntoCache(record, { isFull: true, idbOnly: false });
      return { status: 'ok', data: record };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        pruneDeletedIdsFromAllCaches('accommodation', [cleanId]);
        return { status: 'deleted' };
      }
      return { status: 'offline-keep-cache' };
    }
  });
}

export interface StoreProfileVerifyPayload {
  store: Store;
  ownerProfile: UserProfile | null;
  products: Product[];
  reviews: Review[];
}

export async function verifyStoreProfileOnServer(
  id: string,
  options: {
    viewerUid?: string;
    isAdmin?: boolean;
    currentProductCount: number;
    currentReviewCount: number;
    tickIndex: number;
    currentOwnerProfile: UserProfile | null;
    currentProducts: Product[];
    currentReviews: Review[];
  }
): Promise<DetailVerifyResult<StoreProfileVerifyPayload>> {
  const cleanId = id.trim();
  if (!cleanId || !db) {
    return { status: 'offline-keep-cache' };
  }

  try {
    const storeSnap = await getDocFromServer(doc(db, 'stores', cleanId));
    if (!storeSnap.exists()) {
      pruneDeletedIdsFromAllCaches('store', [cleanId]);
      return { status: 'deleted' };
    }

    const storeRecord: Store = {
      id: storeSnap.id,
      ...(storeSnap.data() as Omit<Store, 'id'>),
    };
    const canViewUnapproved = Boolean(
      options.viewerUid &&
        (options.viewerUid === storeRecord.ownerId || options.isAdmin)
    );
    if (
      (!storeRecord.isApproved || storeRecord.isActive === false) &&
      !canViewUnapproved
    ) {
      pruneDeletedIdsFromAllCaches('store', [cleanId]);
      return { status: 'deleted' };
    }

    if (storeRecord.isApproved && storeRecord.isActive !== false) {
      primeStoreIntoCache(storeRecord, { isFull: true, idbOnly: false });
    }

    // Check counts of store's products & reviews (1 read each) without re-downloading docs unnecessarily
    const [prodCountSnap, revCountSnap] = await Promise.all([
      getCountFromServer(
        query(
          collection(db, 'products'),
          where('storeId', '==', cleanId),
          where('isApproved', '==', true)
        )
      ).catch(() => null),
      getCountFromServer(
        query(
          collection(db, 'reviews'),
          where('targetId', '==', cleanId),
          where('targetType', '==', 'store')
        )
      ).catch(() => null),
    ]);

    const prodSliceKey = `store_prods:${cleanId}`;
    const revSliceKey = `store_revs:${cleanId}`;
    const prevProdCnt =
      getSavedServerCount(prodSliceKey) ?? options.currentProductCount;
    const prevRevCnt =
      getSavedServerCount(revSliceKey) ?? options.currentReviewCount;

    const serverProdCount = prodCountSnap?.data().count ?? null;
    const serverRevCount = revCountSnap?.data().count ?? null;

    if (serverProdCount !== null) saveServerCount(prodSliceKey, serverProdCount);
    if (serverRevCount !== null) saveServerCount(revSliceKey, serverRevCount);

    const shouldReloadProducts =
      serverProdCount !== null && serverProdCount !== prevProdCnt;
    const shouldReloadReviews =
      serverRevCount !== null && serverRevCount !== prevRevCnt;
    const shouldReloadOwner =
      !options.currentOwnerProfile ||
      options.tickIndex === 0 ||
      options.tickIndex % 6 === 0;

    const [ownerProfile, products, reviews] = await Promise.all([
      shouldReloadOwner
        ? getDocFromServer(doc(db, 'users', storeRecord.ownerId))
            .then((uSnap) =>
              uSnap.exists()
                ? ({
                    uid: uSnap.id,
                    ...(uSnap.data() as Omit<UserProfile, 'uid'>),
                  } as UserProfile)
                : null
            )
            .catch(() => options.currentOwnerProfile)
        : Promise.resolve(options.currentOwnerProfile),
      shouldReloadProducts
        ? getDocsFromServer(
            query(
              collection(db, 'products'),
              where('storeId', '==', cleanId),
              where('isApproved', '==', true)
            )
          )
            .then((snap) =>
              snap.docs
                .map((d) => ({
                  id: d.id,
                  ...(d.data() as Omit<Product, 'id'>),
                }))
                .filter((p) => p.isActive !== false)
                .sort(
                  (a, b) =>
                    getTimestampMillis(b.createdAt) -
                    getTimestampMillis(a.createdAt)
                )
            )
            .catch(() => options.currentProducts)
        : Promise.resolve(options.currentProducts),
      shouldReloadReviews
        ? fetchReviewsForTarget(cleanId, 'store').catch(
            () => options.currentReviews
          )
        : Promise.resolve(options.currentReviews),
    ]);

    return {
      status: 'ok',
      data: {
        store: storeRecord,
        ownerProfile,
        products,
        reviews,
      },
    };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      pruneDeletedIdsFromAllCaches('store', [cleanId]);
      return { status: 'deleted' };
    }
    return { status: 'offline-keep-cache' };
  }
}

export interface SellerProfileVerifyPayload {
  seller: UserProfile;
  stores: Store[];
  products: Product[];
  reviews: Review[];
}

export async function verifySellerProfileOnServer(
  uid: string,
  options: {
    currentStoreCount: number;
    currentProductCount: number;
    currentReviewCount: number;
    currentStores: Store[];
    currentProducts: Product[];
    currentReviews: Review[];
  }
): Promise<DetailVerifyResult<SellerProfileVerifyPayload>> {
  const cleanUid = uid.trim();
  if (!cleanUid || !db) {
    return { status: 'offline-keep-cache' };
  }

  try {
    const userSnap = await getDocFromServer(doc(db, 'users', cleanUid));
    if (!userSnap.exists()) {
      invalidateFastCache(`seller_public_user:${cleanUid}`);
      invalidateFastCache(`seller_profile:${cleanUid}`);
      invalidateFastCache(`user_trust:${cleanUid}`);
      return { status: 'deleted' };
    }

    const seller: UserProfile = {
      uid: userSnap.id,
      ...(userSnap.data() as Omit<UserProfile, 'uid'>),
    };
    setFastCache(`seller_public_user:${cleanUid}`, seller, { idbOnly: true });
    primeUserProfilePic(cleanUid, getUserAvatarUrl(seller));

    const [storesCnt, prodsCnt, revsCnt] = await Promise.all([
      getCountFromServer(
        query(
          collection(db, 'stores'),
          where('ownerId', '==', cleanUid),
          where('isApproved', '==', true)
        )
      ).catch(() => null),
      getCountFromServer(
        query(
          collection(db, 'products'),
          where('sellerId', '==', cleanUid),
          where('isApproved', '==', true)
        )
      ).catch(() => null),
      getCountFromServer(
        query(
          collection(db, 'reviews'),
          where('targetId', '==', cleanUid),
          where('targetType', '==', 'user')
        )
      ).catch(() => null),
    ]);

    const storesSliceKey = `seller_stores:${cleanUid}`;
    const prodsSliceKey = `seller_prods:${cleanUid}`;
    const revsSliceKey = `seller_revs:${cleanUid}`;
    const prevStoresCnt =
      getSavedServerCount(storesSliceKey) ?? options.currentStoreCount;
    const prevProdsCnt =
      getSavedServerCount(prodsSliceKey) ?? options.currentProductCount;
    const prevRevsCnt =
      getSavedServerCount(revsSliceKey) ?? options.currentReviewCount;

    const nextStoresCnt = storesCnt?.data().count ?? null;
    const nextProdsCnt = prodsCnt?.data().count ?? null;
    const nextRevsCnt = revsCnt?.data().count ?? null;

    if (nextStoresCnt !== null) saveServerCount(storesSliceKey, nextStoresCnt);
    if (nextProdsCnt !== null) saveServerCount(prodsSliceKey, nextProdsCnt);
    if (nextRevsCnt !== null) saveServerCount(revsSliceKey, nextRevsCnt);

    const needStores = nextStoresCnt !== null && nextStoresCnt !== prevStoresCnt;
    const needProds = nextProdsCnt !== null && nextProdsCnt !== prevProdsCnt;
    const needRevs = nextRevsCnt !== null && nextRevsCnt !== prevRevsCnt;

    const [stores, products, reviews] = await Promise.all([
      needStores
        ? getDocsFromServer(
            query(
              collection(db, 'stores'),
              where('ownerId', '==', cleanUid),
              where('isApproved', '==', true)
            )
          )
            .then((snap) =>
              snap.docs
                .map((d) => ({
                  id: d.id,
                  ...(d.data() as Omit<Store, 'id'>),
                }))
                .filter((s) => s.isActive !== false)
                .sort(
                  (a, b) =>
                    getTimestampMillis(b.createdAt) -
                    getTimestampMillis(a.createdAt)
                )
            )
            .catch(() => options.currentStores)
        : Promise.resolve(options.currentStores),
      needProds
        ? getDocsFromServer(
            query(
              collection(db, 'products'),
              where('sellerId', '==', cleanUid),
              where('isApproved', '==', true)
            )
          )
            .then((snap) =>
              snap.docs
                .map((d) => ({
                  id: d.id,
                  ...(d.data() as Omit<Product, 'id'>),
                }))
                .filter((p) => p.isActive !== false)
                .sort(
                  (a, b) =>
                    getTimestampMillis(b.createdAt) -
                    getTimestampMillis(a.createdAt)
                )
            )
            .catch(() => options.currentProducts)
        : Promise.resolve(options.currentProducts),
      needRevs
        ? fetchReviewsForTarget(cleanUid, 'user').catch(
            () => options.currentReviews
          )
        : Promise.resolve(options.currentReviews),
    ]);

    return {
      status: 'ok',
      data: { seller, stores, products, reviews },
    };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      return { status: 'deleted' };
    }
    return { status: 'offline-keep-cache' };
  }
}
