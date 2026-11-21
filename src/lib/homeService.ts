import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  Timestamp,
  where,
  FirestoreError,
} from 'firebase/firestore';
import { db } from './firebase';
import { getUserAvatarUrl } from './authHelpers';
import {
  getFastCacheEnvelope,
  setFastCache,
} from './fastCache';
import {
  hasKnownMissingIndex,
  markMissingIndex,
  runDeduplicatedQuery,
} from './firestoreQueryCache';
import { filterAndSortListings, getTimestampMillis } from './homeHelpers';
import { warmImages } from './imageCache';
import { getListingAdType } from './marketplaceHelpers';
import { getApprovedStores, getApprovedStoresDelta } from './storeService';
import {
  FEED_FRESH_MS,
  getNewestCreatedAtMs,
  mergeMixedFeedDelta,
  primeAccommodationIntoCache,
  primeLegacyServiceIntoCache,
  primeProductIntoCache,
  primeStoreIntoCache,
} from './syncCache';
import {
  accommodationToMixedFeedItem,
  MixedFeedItem,
  productToMixedFeedItem,
  serviceToMixedFeedItem,
  storeToMixedFeedItem,
} from './trendingHelpers';
import { primeUserProfilePic } from './userAvatarCache';
import { Accommodation, Product, Service, UserProfile } from '../types';

export interface PublicSellerStats {
  trustScore: number;
  reviewCount: number;
  isVerified: boolean;
}

const TRUST_CACHE_TTL_MS = 15 * 60_000;

async function fetchLatestFromCollection<
  T extends { id?: string; isApproved: boolean; isActive: boolean; createdAt: unknown }
>(
  collectionName: string,
  limitCount: number,
  afterCreatedAtMs = 0
): Promise<T[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, collectionName);
  const indexKey = `${collectionName}:approved_active_createdAt`;
  const fallbackLimit = Math.max(limitCount * 2, 36);

  const runFallback = async () => {
    const fallbackQ = query(
      colRef,
      where('isApproved', '==', true),
      limit(fallbackLimit)
    );
    const snapshot = await getDocs(fallbackQ);
    const docs = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<T, 'id'>),
    })) as T[];
    const sorted = filterAndSortListings(docs, limitCount);
    if (afterCreatedAtMs > 0) {
      return sorted.filter(
        (doc) => getTimestampMillis(doc.createdAt) > afterCreatedAtMs
      );
    }
    return sorted;
  };

  if (hasKnownMissingIndex(indexKey)) {
    return runFallback();
  }

  try {
    const constraints: QueryConstraint[] = [
      where('isApproved', '==', true),
      where('isActive', '==', true),
    ];
    if (afterCreatedAtMs > 0) {
      constraints.push(
        where('createdAt', '>', Timestamp.fromMillis(afterCreatedAtMs + 1))
      );
    }
    constraints.push(orderBy('createdAt', 'desc'), limit(limitCount));

    const q = query(colRef, ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<T, 'id'>),
    })) as T[];
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      markMissingIndex(indexKey);
      return runFallback();
    }
    if (firestoreErr?.code === 'unavailable') {
      throw new Error(
        'Could not reach the marketplace database. Check your internet connection and try again.'
      );
    }
    throw err;
  }
}

async function fetchLatestProductsByAdType(
  adType: 'item' | 'service',
  limitCount: number
): Promise<Product[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, 'products');
  const indexKey = `products:approved_active_${adType}_createdAt`;
  const fallbackLimit = Math.max(limitCount * 3, 40);

  const runFallback = async () => {
    const fallbackQ = query(
      colRef,
      where('isApproved', '==', true),
      limit(fallbackLimit)
    );
    const snapshot = await getDocs(fallbackQ);
    const docs = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Product, 'id'>),
      }))
      .filter(
        (item) =>
          item.isApproved === true &&
          item.isActive === true &&
          item.categoryId !== 'accommodation' &&
          getListingAdType(item) === adType
      );
    return filterAndSortListings(docs, limitCount);
  };

  if (hasKnownMissingIndex(indexKey)) {
    return runFallback();
  }

  try {
    const q = query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      where('adType', '==', adType),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Product, 'id'>),
      }))
      .filter(
        (item) =>
          item.categoryId !== 'accommodation' && getListingAdType(item) === adType
      );
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      markMissingIndex(indexKey);
      return runFallback();
    }
    if (firestoreErr?.code === 'unavailable') {
      throw new Error(
        'Could not reach the marketplace database. Check your internet connection and try again.'
      );
    }
    throw err;
  }
}

export async function fetchPublicUserTrustMap(
  uids: ReadonlyArray<string>,
  force = false
): Promise<Record<string, PublicSellerStats>> {
  const result: Record<string, PublicSellerStats> = {};
  if (uids.length === 0) {
    return result;
  }

  const uniqueUids = Array.from(
    new Set(
      uids
        .map((id) => id.trim())
        .filter((id) => id && !id.startsWith('test_') && !id.startsWith('seed_'))
    )
  );
  if (uniqueUids.length === 0) {
    return result;
  }

  const uncachedUids: string[] = [];
  for (const uid of uniqueUids) {
    if (!force) {
      const cached = getFastCacheEnvelope<PublicSellerStats>(
        `user_trust:${uid}`,
        TRUST_CACHE_TTL_MS
      );
      if (cached) {
        result[uid] = cached.data;
        continue;
      }
    }
    uncachedUids.push(uid);
  }

  if (!db || uncachedUids.length === 0) {
    return result;
  }

  const usersCol = collection(db, 'users');

  // Firestore 'in' queries allow up to 30 document IDs per batch
  const chunks: string[][] = [];
  for (let i = 0; i < uncachedUids.length; i += 30) {
    chunks.push(uncachedUids.slice(i, i + 30));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const q = query(usersCol, where(documentId(), 'in', chunk));
        const snapshot = await getDocs(q);
        const foundIds = new Set<string>();
        snapshot.docs.forEach((docSnap) => {
          foundIds.add(docSnap.id);
          const data = docSnap.data() as Partial<UserProfile>;
          primeUserProfilePic(docSnap.id, getUserAvatarUrl(data));
          const stats: PublicSellerStats = {
            trustScore:
              typeof data.trustScore === 'number' &&
              Number.isFinite(data.trustScore)
                ? data.trustScore
                : 0,
            reviewCount:
              typeof data.reviewCount === 'number' &&
              Number.isFinite(data.reviewCount)
                ? data.reviewCount
                : 0,
            isVerified: Boolean(data.isVerified),
          };
          result[docSnap.id] = stats;
          setFastCache(`user_trust:${docSnap.id}`, stats, { idbOnly: true });
        });
        chunk.forEach((uid) => {
          if (!foundIds.has(uid)) {
            primeUserProfilePic(uid, '');
          }
        });
      } catch {
        // Non-blocking fallback when offline or restricted
      }
    })
  );

  return result;
}

export function primeMixedFeedEntities(
  items: ReadonlyArray<MixedFeedItem>,
  isFull: boolean
): void {
  const coverUrls: Array<string | undefined> = [];

  for (const item of items) {
    if (item.product) {
      primeProductIntoCache(item.product, { isFull, idbOnly: true });
      coverUrls.push(item.product.images?.[0]);
    } else if (item.store) {
      primeStoreIntoCache(item.store, { isFull, idbOnly: true });
      coverUrls.push(item.store.images?.[0] || item.store.logoUrl);
    } else if (item.accommodation) {
      primeAccommodationIntoCache(item.accommodation, { isFull, idbOnly: true });
      coverUrls.push(item.accommodation.images?.[0]);
    } else if (item.service) {
      primeLegacyServiceIntoCache(item.service, { isFull, idbOnly: true });
      coverUrls.push(item.service.images?.[0]);
    }
  }

  warmImages(coverUrls, 16);
}

export async function getLatestProducts(limitCount = 4): Promise<Product[]> {
  return runDeduplicatedQuery(`home:latest_products:${limitCount}`, async () => {
    const rows = await fetchLatestProductsByAdType(
      'item',
      Math.max(limitCount * 2, limitCount)
    );
    const sliced = rows.slice(0, limitCount);
    sliced.forEach((item) =>
      primeProductIntoCache(item, { isFull: true, idbOnly: true })
    );
    return sliced;
  });
}

export async function getLatestLegacyServices(
  limitCount = 40,
  afterCreatedAtMs = 0
): Promise<Service[]> {
  return runDeduplicatedQuery(
    `home:legacy_services:${limitCount}:${afterCreatedAtMs}`,
    () => fetchLatestFromCollection<Service>('services', limitCount, afterCreatedAtMs)
  );
}

export async function getLatestServices(limitCount = 4): Promise<Service[]> {
  return runDeduplicatedQuery(`home:latest_services:${limitCount}`, async () => {
    const [productServices, legacyServices] = await Promise.all([
      fetchLatestProductsByAdType('service', limitCount),
      fetchLatestFromCollection<Service>('services', limitCount),
    ]);

    productServices.forEach((p) =>
      primeProductIntoCache(p, { isFull: true, idbOnly: true })
    );

    const seenIds = new Set<string>();
    const normalizedProductServices: Service[] = productServices.map((p) => ({
      id: p.id,
      providerId: p.sellerId,
      title: p.title,
      description: p.description,
      categoryId: p.categoryId,
      subcategory: p.subcategory,
      images: p.images || [],
      priceType: p.priceType,
      price: p.price,
      priceUnit: p.priceUnit,
      whatsappNumber: p.whatsappNumber,
      landmark: p.landmark,
      latitude: p.latitude,
      longitude: p.longitude,
      locationName: p.locationName,
      shopName: p.storeName || p.shopName,
      hasDelivery: Boolean(p.hasDelivery),
      viewCount: p.viewCount || 0,
      contactCount: p.contactCount || 0,
      status: p.status,
      isApproved: p.isApproved,
      isActive: p.isActive,
      createdAt: p.createdAt,
      sellerSnapshot: p.sellerSnapshot,
    }));

    const merged = [...normalizedProductServices, ...legacyServices].filter((item) => {
      if (!item.id) return true;
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

    merged.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
    return merged.slice(0, limitCount);
  });
}

export async function getLatestAccommodations(
  limitCount = 4
): Promise<Accommodation[]> {
  return runDeduplicatedQuery(`home:latest_accommodations:${limitCount}`, () =>
    fetchLatestFromCollection<Accommodation>('accommodations', limitCount)
  );
}

export async function getHomeMixedFeed(
  limitPerCollection = 20
): Promise<MixedFeedItem[]> {
  if (!db) {
    return [];
  }

  return runDeduplicatedQuery(`home:mixed:${limitPerCollection}`, async () => {
    const [allProducts, legacyServices, stores, accommodations] =
      await Promise.all([
        fetchLatestFromCollection<Product>('products', limitPerCollection * 2),
        fetchLatestFromCollection<Service>('services', limitPerCollection),
        getApprovedStores(),
        fetchLatestFromCollection<Accommodation>(
          'accommodations',
          limitPerCollection
        ),
      ]);

    const marketplaceProducts = allProducts.filter(
      (p) => p.categoryId !== 'accommodation'
    );
    const seenProductIds = new Set(
      marketplaceProducts.map((p) => p.id).filter(Boolean) as string[]
    );
    const uniqueLegacyServices = legacyServices.filter(
      (s) => !s.id || !seenProductIds.has(s.id)
    );

    const sellerIds: string[] = [
      ...marketplaceProducts.map((p) => p.sellerId),
      ...uniqueLegacyServices.map((s) => s.providerId),
      ...stores.map((st) => st.ownerId),
      ...accommodations.map((a) => a.ownerId),
    ];

    const userTrustMap = await fetchPublicUserTrustMap(sellerIds);

    const mixed: MixedFeedItem[] = [
      ...marketplaceProducts.map((p) =>
        productToMixedFeedItem(p, userTrustMap[p.sellerId])
      ),
      ...uniqueLegacyServices.map((s) =>
        serviceToMixedFeedItem(s, userTrustMap[s.providerId])
      ),
      ...stores.map((st) => storeToMixedFeedItem(st, userTrustMap[st.ownerId])),
      ...accommodations.map((acc) =>
        accommodationToMixedFeedItem(acc, userTrustMap[acc.ownerId])
      ),
    ];

    mixed.sort(
      (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
    );

    primeMixedFeedEntities(mixed, true);
    return mixed;
  });
}

/**
 * Incremental delta sync for the Home feed: queries ONLY records newer than
 * the newest cached item per collection (`0` reads if nothing new was posted).
 */
export async function getHomeMixedFeedDelta(
  cachedItems: ReadonlyArray<MixedFeedItem>,
  limitPerCollection = 20
): Promise<{ items: MixedFeedItem[]; addedCount: number }> {
  if (!db || cachedItems.length === 0) {
    const full = await getHomeMixedFeed(limitPerCollection);
    return { items: full, addedCount: full.length };
  }

  return runDeduplicatedQuery(
    `home:mixed:delta:${cachedItems.length}`,
    async () => {
      const productItems = cachedItems.filter(
        (i) => (i._type === 'item' || i._type === 'service') && i.product
      );
      const serviceItems = cachedItems.filter(
        (i) => i._type === 'service' && i.service
      );
      const storeItems = cachedItems.filter((i) => i._type === 'store' && i.store);
      const accItems = cachedItems.filter(
        (i) => i._type === 'accommodation' && i.accommodation
      );

      const newestProductMs = getNewestCreatedAtMs(productItems);
      const newestServiceMs = getNewestCreatedAtMs(serviceItems);
      const newestStoreMs = getNewestCreatedAtMs(storeItems);
      const newestAccMs = getNewestCreatedAtMs(accItems);

      const [newProducts, newLegacyServices, newStores, newAccommodations] =
        await Promise.all([
          fetchLatestFromCollection<Product>(
            'products',
            limitPerCollection,
            newestProductMs
          ),
          fetchLatestFromCollection<Service>(
            'services',
            limitPerCollection,
            newestServiceMs
          ),
          newestStoreMs > 0
            ? getApprovedStoresDelta(newestStoreMs)
            : getApprovedStores(),
          fetchLatestFromCollection<Accommodation>(
            'accommodations',
            limitPerCollection,
            newestAccMs
          ),
        ]);

      const marketplaceProducts = newProducts.filter(
        (p) => p.categoryId !== 'accommodation'
      );
      const seenProductIds = new Set(
        marketplaceProducts.map((p) => p.id).filter(Boolean) as string[]
      );
      const uniqueLegacyServices = newLegacyServices.filter(
        (s) => !s.id || !seenProductIds.has(s.id)
      );

      const totalIncoming =
        marketplaceProducts.length +
        uniqueLegacyServices.length +
        newStores.length +
        newAccommodations.length;

      if (totalIncoming === 0) {
        return { items: [...cachedItems], addedCount: 0 };
      }

      const newSellerIds: string[] = [
        ...marketplaceProducts.map((p) => p.sellerId),
        ...uniqueLegacyServices.map((s) => s.providerId),
        ...newStores.map((st) => st.ownerId),
        ...newAccommodations.map((a) => a.ownerId),
      ];

      const userTrustMap = await fetchPublicUserTrustMap(newSellerIds);

      const incomingMixed: MixedFeedItem[] = [
        ...marketplaceProducts.map((p) =>
          productToMixedFeedItem(p, userTrustMap[p.sellerId])
        ),
        ...uniqueLegacyServices.map((s) =>
          serviceToMixedFeedItem(s, userTrustMap[s.providerId])
        ),
        ...newStores.map((st) =>
          storeToMixedFeedItem(st, userTrustMap[st.ownerId])
        ),
        ...newAccommodations.map((acc) =>
          accommodationToMixedFeedItem(acc, userTrustMap[acc.ownerId])
        ),
      ];

      primeMixedFeedEntities(incomingMixed, true);
      const merged = mergeMixedFeedDelta(cachedItems, incomingMixed, 80);
      return { items: merged, addedCount: incomingMixed.length };
    }
  );
}

export { FEED_FRESH_MS };
