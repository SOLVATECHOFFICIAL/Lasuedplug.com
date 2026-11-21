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
import { fetchPublicUserTrustMap } from './homeService';
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
      const fallbackQ = query(colRef, where('isApproved', '==', true));
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        }))
        .filter((p) => p.isActive !== false && p.categoryId !== 'accommodation')
        .sort(compareByEngagement)
        .slice(0, limitCount);
    }
    throw err;
  }
}

async function fetchTopEngagedLegacyServices(limitCount = 15): Promise<Service[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, 'services');
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
      const fallbackQ = query(colRef, where('isApproved', '==', true));
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Service, 'id'>),
        }))
        .filter((s) => s.isActive !== false)
        .sort(compareByEngagement)
        .slice(0, limitCount);
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
    ...topProducts.map((p) =>
      productToMixedFeedItem(p, userTrustMap[p.sellerId])
    ),
    ...uniqueLegacyServices.map((s) =>
      serviceToMixedFeedItem(s, userTrustMap[s.providerId])
    ),
  ];

  return applyTwoHourTrendingShuffle(combined, nowMs, 30);
}
