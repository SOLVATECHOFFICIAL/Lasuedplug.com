import {
  collection,
  FirestoreError,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  hasKnownMissingIndex,
  markMissingIndex,
  runDeduplicatedQuery,
} from './firestoreQueryCache';
import { fetchPublicUserTrustMap } from './homeService';
import { warmImages } from './imageCache';
import { primeProductIntoCache } from './syncCache';
import {
  applyTwoHourTrendingShuffle,
  compareByEngagement,
  MixedFeedItem,
  productToMixedFeedItem,
  serviceToMixedFeedItem,
} from './trendingHelpers';
import { Product, Service } from '../types';

async function fetchTopEngagedProducts(limitCount = 30): Promise<Product[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, 'products');
  const indexKey = 'products:approved_active_contact_view';
  const fallbackLimit = Math.max(limitCount * 2, 40);

  const runFallback = async () => {
    const fallbackQ = query(
      colRef,
      where('isApproved', '==', true),
      limit(fallbackLimit)
    );
    const snapshot = await getDocs(fallbackQ);
    return snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Product, 'id'>),
      }))
      .filter((p) => p.isActive !== false && p.categoryId !== 'accommodation')
      .sort(compareByEngagement)
      .slice(0, limitCount);
  };

  if (hasKnownMissingIndex(indexKey)) {
    return runFallback();
  }

  try {
    const q = query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      orderBy('contactCount', 'desc'),
      orderBy('viewCount', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Product, 'id'>),
      }))
      .filter((p) => p.categoryId !== 'accommodation');
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      markMissingIndex(indexKey);
      return runFallback();
    }
    throw err;
  }
}

async function fetchTopEngagedLegacyServices(limitCount = 15): Promise<Service[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, 'services');
  const indexKey = 'services:approved_active_contact_view';
  const fallbackLimit = Math.max(limitCount * 2, 24);

  const runFallback = async () => {
    const fallbackQ = query(
      colRef,
      where('isApproved', '==', true),
      limit(fallbackLimit)
    );
    const snapshot = await getDocs(fallbackQ);
    return snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Service, 'id'>),
      }))
      .filter((s) => s.isActive !== false)
      .sort(compareByEngagement)
      .slice(0, limitCount);
  };

  if (hasKnownMissingIndex(indexKey)) {
    return runFallback();
  }

  try {
    const q = query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      orderBy('contactCount', 'desc'),
      orderBy('viewCount', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Service, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      markMissingIndex(indexKey);
      return runFallback();
    }
    return [];
  }
}

/**
 * Fetches the top 30 items sorted by contactCount and viewCount, then applies
 * a deterministic 2-hour rotating time-seed shuffle (Math.floor(Date.now() / 7200000)).
 */
export async function getTrendingItems(
  nowMs: number = Date.now()
): Promise<MixedFeedItem[]> {
  if (!db) {
    return [];
  }

  return runDeduplicatedQuery('trending:items', async () => {
    const [topProducts, topServices] = await Promise.all([
      fetchTopEngagedProducts(30),
      fetchTopEngagedLegacyServices(15),
    ]);

    const seenIds = new Set(
      topProducts.map((p) => p.id).filter(Boolean) as string[]
    );
    const uniqueLegacyServices = topServices.filter(
      (s) => !s.id || !seenIds.has(s.id)
    );

    const sellerIds = [
      ...topProducts.map((p) => p.sellerId),
      ...uniqueLegacyServices.map((s) => s.providerId),
    ];
    const userTrustMap = await fetchPublicUserTrustMap(sellerIds);

    const combined: MixedFeedItem[] = [
      ...topProducts.map((p) => {
        primeProductIntoCache(p, { isFull: true, idbOnly: true });
        return productToMixedFeedItem(p, userTrustMap[p.sellerId]);
      }),
      ...uniqueLegacyServices.map((s) =>
        serviceToMixedFeedItem(s, userTrustMap[s.providerId])
      ),
    ];

    warmImages(
      combined.map(
        (item) =>
          item.product?.images?.[0] ||
          item.service?.images?.[0] ||
          item.store?.images?.[0] ||
          item.store?.logoUrl ||
          item.accommodation?.images?.[0]
      ),
      16
    );

    return applyTwoHourTrendingShuffle(combined, nowMs, 30);
  });
}
