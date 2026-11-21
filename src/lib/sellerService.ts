import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  FirestoreError,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getUserAvatarUrl } from './authHelpers';
import {
  getFastCacheEnvelope,
  invalidateFastCachePrefix,
  setFastCache,
} from './fastCache';
import { runDeduplicatedQuery } from './firestoreQueryCache';
import { getTimestampMillis } from './homeHelpers';
import { warmImages } from './imageCache';
import {
  getProductLocationLabel,
  getProductPriceDisplay,
} from './marketplaceHelpers';
import { getUserStores } from './storeService';
import {
  DETAIL_FRESH_MS,
  invalidatePublicFeedCaches,
  primeProductIntoCache,
} from './syncCache';
import { primeUserProfilePic } from './userAvatarCache';
import {
  accommodationToUnifiedSellerListing,
  buildEditedListingUpdatePayload,
  computeNextSoldOneUpdate,
  computeNextToggleActiveUpdate,
  EditListingInput,
  isServiceAd,
  productToUnifiedSellerListing,
  roommateToUnifiedSellerListing,
  SellerCollectionName,
  storeToUnifiedSellerListing,
  UnifiedSellerListing,
} from './sellerHelpers';
import { Accommodation, Product, RoommateRequest, UserProfile } from '../types';

function mapFirestoreError(err: unknown, fallbackMessage: string): Error {
  const firestoreErr = err as FirestoreError;
  if (firestoreErr?.code === 'unavailable') {
    return new Error(
      'Could not reach the marketplace database. Check your internet connection and try again.'
    );
  }
  if (firestoreErr?.code === 'permission-denied') {
    return new Error(
      'You do not have permission to modify this listing.'
    );
  }
  if (err instanceof Error && err.message) {
    return err;
  }
  return new Error(fallbackMessage);
}

/**
 * Fetches all listings belonging to a seller ordered by createdAt descending.
 * Falls back cleanly to client-side timestamp sorting if the composite index
 * (sellerId ASC, createdAt DESC) has not yet been created in Firestore.
 */
export async function getSellerListings(sellerId: string): Promise<Product[]> {
  if (!db || !sellerId.trim()) {
    return [];
  }

  const colRef = collection(db, 'products');

  try {
    const q = query(
      colRef,
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Product, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      console.warn(
        'Firestore composite index required on collection "products": (sellerId ASC, createdAt DESC). Check firestore.indexes.json.',
        firestoreErr.message
      );
      const fallbackQ = query(colRef, where('sellerId', '==', sellerId));
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        }))
        .sort(
          (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
    }
    throw mapFirestoreError(err, 'Failed to load your listings.');
  }
}

export async function getUserAccommodations(
  ownerId: string
): Promise<Accommodation[]> {
  if (!db || !ownerId.trim()) {
    return [];
  }

  const colRef = collection(db, 'accommodations');

  try {
    const q = query(
      colRef,
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Accommodation, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('ownerId', '==', ownerId));
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Accommodation, 'id'>),
        }))
        .sort(
          (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
    }
    throw mapFirestoreError(err, 'Failed to load your accommodation listings.');
  }
}

export async function getUserRoommateRequests(
  userId: string
): Promise<RoommateRequest[]> {
  if (!db || !userId.trim()) {
    return [];
  }

  const colRef = collection(db, 'roommate_requests');

  try {
    const q = query(
      colRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Partial<RoommateRequest>;
      return {
        id: docSnap.id,
        ...(data as Omit<RoommateRequest, 'id'>),
        images: Array.isArray(data.images) ? data.images : [],
      };
    });
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('userId', '==', userId));
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as Partial<RoommateRequest>;
          return {
            id: docSnap.id,
            ...(data as Omit<RoommateRequest, 'id'>),
            images: Array.isArray(data.images) ? data.images : [],
          };
        })
        .sort(
          (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
    }
    throw mapFirestoreError(err, 'Failed to load your roommate requests.');
  }
}

/**
 * Fetches ALL user listings across all 4 LASUEDPLUG modules:
 * 1) products (Items & Services where sellerId == uid)
 * 2) accommodations (where ownerId == uid)
 * 3) roommate_requests (where userId == uid)
 * 4) stores (where ownerId == uid)
 */
export async function getAllSellerDashboardItems(
  uid: string
): Promise<UnifiedSellerListing[]> {
  if (!db || !uid.trim()) {
    return [];
  }

  const [products, accommodations, roommates, stores] = await Promise.all([
    getSellerListings(uid),
    getUserAccommodations(uid),
    getUserRoommateRequests(uid),
    getUserStores(uid),
  ]);

  const unified: UnifiedSellerListing[] = [
    ...products.map((product) =>
      productToUnifiedSellerListing(
        product,
        getProductPriceDisplay(product).text,
        getProductLocationLabel(product)
      )
    ),
    ...accommodations.map((acc) => accommodationToUnifiedSellerListing(acc)),
    ...roommates.map((req) => roommateToUnifiedSellerListing(req)),
    ...stores.map((store) => storeToUnifiedSellerListing(store)),
  ];

  return unified.sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
  );
}

export async function markSellerListingSoldOne(
  listing: Product
): Promise<{ quantity: number; status: Product['status']; isActive: boolean }> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!listing.id) {
    throw new Error('Listing ID is missing.');
  }
  if (isServiceAd(listing)) {
    throw new Error('Stock quantity is only tracked for physical items.');
  }

  const nextState = computeNextSoldOneUpdate(listing);

  try {
    await updateDoc(doc(db, 'products', listing.id), {
      quantity: nextState.quantity,
      status: nextState.status,
      isActive: nextState.isActive,
    });
    invalidateFastCachePrefix('home_');
    invalidateFastCachePrefix('mkt_');
    invalidateFastCachePrefix('services_');
    invalidateFastCachePrefix('seller_dash:');
    invalidateFastCachePrefix(`product:${listing.id}`);
    return nextState;
  } catch (err) {
    throw mapFirestoreError(err, 'Failed to update stock count.');
  }
}

export async function toggleSellerListingActive(
  listing: Product,
  nextActive: boolean
): Promise<{ isActive: boolean; status: Product['status'] }> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!listing.id) {
    throw new Error('Listing ID is missing.');
  }

  const nextState = computeNextToggleActiveUpdate(listing, nextActive);

  try {
    await updateDoc(doc(db, 'products', listing.id), {
      isActive: nextState.isActive,
      status: nextState.status,
    });
    invalidateFastCachePrefix('home_');
    invalidateFastCachePrefix('mkt_');
    invalidateFastCachePrefix('services_');
    invalidateFastCachePrefix('seller_dash:');
    invalidateFastCachePrefix(`product:${listing.id}`);
    return nextState;
  } catch (err) {
    throw mapFirestoreError(err, 'Failed to update listing visibility.');
  }
}

export async function deleteSellerListing(productId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!productId.trim()) {
    throw new Error('Listing ID is missing.');
  }

  try {
    await deleteDoc(doc(db, 'products', productId));
    invalidateFastCachePrefix('home_');
    invalidateFastCachePrefix('mkt_');
    invalidateFastCachePrefix('services_');
    invalidateFastCachePrefix('seller_dash:');
    invalidateFastCachePrefix(`product:${productId}`);
  } catch (err) {
    throw mapFirestoreError(err, 'Failed to delete listing.');
  }
}

export async function deleteUnifiedSellerListing(
  id: string,
  collectionName: SellerCollectionName
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!id.trim()) {
    throw new Error('Listing ID is missing.');
  }

  try {
    await deleteDoc(doc(db, collectionName, id));
    invalidateFastCachePrefix('home_');
    invalidateFastCachePrefix('mkt_');
    invalidateFastCachePrefix('services_');
    invalidateFastCachePrefix('accommodations_');
    invalidateFastCachePrefix('roommates_');
    invalidateFastCachePrefix('approved_stores');
    invalidateFastCachePrefix('seller_dash:');
  } catch (err) {
    throw mapFirestoreError(err, 'Failed to delete item.');
  }
}

export async function updateSellerListing(
  productId: string,
  input: EditListingInput
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!productId.trim()) {
    throw new Error('Listing ID is missing.');
  }

  const payload = buildEditedListingUpdatePayload(input);
  // Ensure price field is cleanly removed if switched to 'contact'
  if (payload.priceType === 'contact') {
    payload.price = deleteField();
  }
  // Remove physical location coordinates and shop hours if switched to 'online'
  if (payload.locationType === 'online') {
    payload.latitude = deleteField();
    payload.longitude = deleteField();
    payload.landmark = deleteField();
    payload.openingHours = deleteField();
    payload.openingTimeStart = deleteField();
    payload.openingTimeEnd = deleteField();
    if (input.adType === 'item') {
      payload.locationName = 'Online / Delivery';
    }
  }
  // Enforce Auto-Hide on Edit security rule
  payload.isApproved = false;

  try {
    await updateDoc(doc(db, 'products', productId), payload);
    invalidateFastCachePrefix('home_');
    invalidateFastCachePrefix('mkt_');
    invalidateFastCachePrefix('services_');
    invalidateFastCachePrefix('seller_dash:');
    invalidateFastCachePrefix(`product:${productId}`);
  } catch (err) {
    throw mapFirestoreError(err, 'Failed to save listing updates.');
  }
}

export async function getPublicUserProfile(
  uid: string,
  options?: { force?: boolean }
): Promise<UserProfile | null> {
  const cleanUid = uid.trim();
  if (!cleanUid) {
    return null;
  }

  const cacheKey = `seller_public_user:${cleanUid}`;
  if (!options?.force) {
    const cached = getFastCacheEnvelope<UserProfile>(cacheKey, DETAIL_FRESH_MS);
    if (cached) {
      return cached.data;
    }
  }

  if (!db) {
    return null;
  }

  return runDeduplicatedQuery(`public_user:get:${cleanUid}`, async () => {
    try {
      const snap = await getDoc(doc(db!, 'users', cleanUid));
      if (!snap.exists()) {
        return null;
      }
      const profile: UserProfile = {
        uid: snap.id,
        ...(snap.data() as Omit<UserProfile, 'uid'>),
      };
      setFastCache(cacheKey, profile, { idbOnly: true });
      primeUserProfilePic(cleanUid, getUserAvatarUrl(profile));
      return profile;
    } catch (err) {
      const stale = getFastCacheEnvelope<UserProfile>(cacheKey, 0);
      if (stale) {
        return stale.data;
      }
      throw mapFirestoreError(err, 'Unable to load seller profile.');
    }
  });
}

export async function getApprovedProductsBySeller(
  sellerId: string
): Promise<Product[]> {
  if (!db || !sellerId.trim()) {
    return [];
  }

  try {
    const q = query(
      collection(db, 'products'),
      where('sellerId', '==', sellerId.trim()),
      where('isApproved', '==', true)
    );
    const snapshot = await getDocs(q);
    const rows = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Product, 'id'>),
      }))
      .filter((p) => p.isActive !== false)
      .sort(
        (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
      );
    rows.forEach((p) => primeProductIntoCache(p, { isFull: true, idbOnly: true }));
    warmImages(rows.map((p) => p.images?.[0]), 12);
    return rows;
  } catch (err) {
    throw mapFirestoreError(err, 'Unable to load seller listings.');
  }
}
