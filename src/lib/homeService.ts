import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  FirestoreError,
} from 'firebase/firestore';
import { db } from './firebase';
import { filterAndSortListings, getTimestampMillis } from './homeHelpers';
import { getListingAdType } from './marketplaceHelpers';
import { getApprovedStores } from './storeService';
import {
  accommodationToMixedFeedItem,
  MixedFeedItem,
  productToMixedFeedItem,
  serviceToMixedFeedItem,
  storeToMixedFeedItem,
} from './trendingHelpers';
import { Accommodation, Product, Service, UserProfile } from '../types';

export interface PublicSellerStats {
  trustScore: number;
  reviewCount: number;
  isVerified: boolean;
}

async function fetchLatestFromCollection<
  T extends { id?: string; isApproved: boolean; isActive: boolean; createdAt: unknown }
>(collectionName: string, limitCount: number): Promise<T[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, collectionName);

  try {
    const q = query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<T, 'id'>),
    })) as T[];
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('isApproved', '==', true));
      const snapshot = await getDocs(fallbackQ);
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<T, 'id'>),
      })) as T[];
      return filterAndSortListings(docs, limitCount);
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
      const fallbackQ = query(colRef, where('isApproved', '==', true));
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
  uids: ReadonlyArray<string>
): Promise<Record<string, PublicSellerStats>> {
  const result: Record<string, PublicSellerStats> = {};
  if (!db || uids.length === 0) {
    return result;
  }

  const uniqueUids = Array.from(
    new Set(uids.map((id) => id.trim()).filter(Boolean))
  );
  const usersCol = collection(db, 'users');

  // Firestore 'in' queries allow up to 30 document IDs per batch
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueUids.length; i += 30) {
    chunks.push(uniqueUids.slice(i, i + 30));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const q = query(usersCol, where(documentId(), 'in', chunk));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as Partial<UserProfile>;
          result[docSnap.id] = {
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
        });
      } catch {
        // Non-blocking fallback when offline or restricted
      }
    })
  );

  return result;
}

export async function getLatestProducts(limitCount = 4): Promise<Product[]> {
  const rows = await fetchLatestProductsByAdType(
    'item',
    Math.max(limitCount * 2, limitCount)
  );
  return rows.slice(0, limitCount);
}

export async function getLatestServices(limitCount = 4): Promise<Service[]> {
  const [productServices, legacyServices] = await Promise.all([
    fetchLatestProductsByAdType('service', limitCount),
    fetchLatestFromCollection<Service>('services', limitCount),
  ]);

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
}

export async function getLatestAccommodations(
  limitCount = 4
): Promise<Accommodation[]> {
  return fetchLatestFromCollection<Accommodation>('accommodations', limitCount);
}

export async function getHomeMixedFeed(
  limitPerCollection = 40
): Promise<MixedFeedItem[]> {
  if (!db) {
    return [];
  }

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
  return mixed;
}

