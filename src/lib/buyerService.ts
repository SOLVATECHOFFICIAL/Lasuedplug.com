import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  FirestoreError,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  getFastCacheEnvelope,
  invalidateFastCachePrefix,
  setFastCache,
} from './fastCache';
import { buildFavoriteDocId, sortByCreatedAtDesc } from './buyerHelpers';
import { SEED_PRODUCTS } from './homeHelpers';
import { warmImages } from './imageCache';
import { FAVORITES_FRESH_MS, primeProductIntoCache } from './syncCache';
import { Enquiry, Favorite, Product } from '../types';

export interface FavoriteWithListing {
  favorite: Favorite;
  listing: Product | null;
}

const USER_FAV_MAP_PREFIX = 'user_fav_ids:';
const USER_FAV_ITEM_PREFIX = 'user_fav:';

function mapBuyerFirestoreError(err: unknown, fallbackMessage: string): Error {
  const firestoreErr = err as FirestoreError;
  if (firestoreErr?.code === 'unavailable') {
    return new Error(
      'Could not reach the database. Check your internet connection and try again.'
    );
  }
  if (firestoreErr?.code === 'permission-denied') {
    return new Error('You do not have permission to perform this action.');
  }
  if (err instanceof Error && err.message) {
    return err;
  }
  return new Error(fallbackMessage);
}

function updateCachedFavoriteState(
  userId: string,
  listingId: string,
  favorited: boolean
): void {
  setFastCache(`${USER_FAV_ITEM_PREFIX}${userId}:${listingId}`, favorited, {
    idbOnly: true,
  });
  const mapKey = `${USER_FAV_MAP_PREFIX}${userId}`;
  const fullMap = getFastCacheEnvelope<Record<string, boolean>>(mapKey, 0);
  if (fullMap) {
    const nextMap = { ...fullMap.data };
    if (favorited) {
      nextMap[listingId] = true;
    } else {
      delete nextMap[listingId];
    }
    setFastCache(mapKey, nextMap, { idbOnly: true });
  }
}

/**
 * Checks whether a listing is currently saved in the user's favorites.
 * Uses cached favorite map / item cache first to avoid Firestore reads on revisit,
 * then checks deterministic favorite doc ID before falling back to query.
 */
export async function isListingFavorited(
  userId: string,
  listingId: string
): Promise<boolean> {
  const cleanUser = userId.trim();
  const cleanListing = listingId.trim();
  if (!cleanUser || !cleanListing) {
    return false;
  }

  const fullMap = getFastCacheEnvelope<Record<string, boolean>>(
    `${USER_FAV_MAP_PREFIX}${cleanUser}`,
    FAVORITES_FRESH_MS
  );
  if (fullMap) {
    return Boolean(fullMap.data[cleanListing]);
  }

  const itemCache = getFastCacheEnvelope<boolean>(
    `${USER_FAV_ITEM_PREFIX}${cleanUser}:${cleanListing}`,
    FAVORITES_FRESH_MS
  );
  if (itemCache !== null) {
    return Boolean(itemCache.data);
  }

  if (!db) {
    return false;
  }

  try {
    const deterministicId = buildFavoriteDocId(cleanUser, cleanListing);
    const deterministicSnap = await getDoc(doc(db, 'favorites', deterministicId));
    if (deterministicSnap.exists()) {
      setFastCache(`${USER_FAV_ITEM_PREFIX}${cleanUser}:${cleanListing}`, true, {
        idbOnly: true,
      });
      return true;
    }

    const q = query(
      collection(db, 'favorites'),
      where('userId', '==', cleanUser),
      where('listingId', '==', cleanListing)
    );
    const snapshot = await getDocs(q);
    const result = !snapshot.empty;
    setFastCache(`${USER_FAV_ITEM_PREFIX}${cleanUser}:${cleanListing}`, result, {
      idbOnly: true,
    });
    return result;
  } catch (err) {
    console.warn('Unable to check favorite state:', err);
    return false;
  }
}

/**
 * Adds or removes a favorite record in Firestore for the logged-in user.
 * Returns the resulting favorited boolean state.
 */
export async function toggleFavorite(
  userId: string,
  listingId: string,
  listingType: 'item' | 'service' | 'product',
  isFavorited: boolean
): Promise<boolean> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  const cleanUser = userId.trim();
  const cleanListing = listingId.trim();
  if (!cleanUser || !cleanListing) {
    throw new Error('User and listing IDs are required.');
  }

  const colRef = collection(db, 'favorites');
  const deterministicId = buildFavoriteDocId(cleanUser, cleanListing);

  try {
    if (isFavorited) {
      const existingQuery = query(
        colRef,
        where('userId', '==', cleanUser),
        where('listingId', '==', cleanListing)
      );
      const snapshot = await getDocs(existingQuery);
      if (!snapshot.empty) {
        await Promise.all(
          snapshot.docs.map((docSnap) => deleteDoc(doc(db!, 'favorites', docSnap.id)))
        );
      } else {
        await deleteDoc(doc(db, 'favorites', deterministicId));
      }
      updateCachedFavoriteState(cleanUser, cleanListing, false);
      invalidateFastCachePrefix(`buyer_dash:${cleanUser}`);
      return false;
    }

    const payload: Omit<Favorite, 'id'> = {
      userId: cleanUser,
      listingId: cleanListing,
      listingType,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'favorites', deterministicId), payload);
    updateCachedFavoriteState(cleanUser, cleanListing, true);
    invalidateFastCachePrefix(`buyer_dash:${cleanUser}`);
    return true;
  } catch (err) {
    throw mapBuyerFirestoreError(err, 'Unable to update saved items right now.');
  }
}

async function fetchListingForFavorite(favorite: Favorite): Promise<Product | null> {
  if (!db) {
    return null;
  }

  const cached = getFastCacheEnvelope<Product>(`product:${favorite.listingId}`, 0);
  if (cached && cached.isFull !== false) {
    return cached.data;
  }

  const targetCollections: Array<'products' | 'services'> =
    favorite.listingType === 'service'
      ? ['products', 'services']
      : ['products'];

  for (const colName of targetCollections) {
    try {
      const snap = await getDoc(doc(db, colName, favorite.listingId));
      if (snap.exists()) {
        const data = snap.data() as Omit<Product, 'id'>;
        const resolved: Product = {
          id: snap.id,
          ...data,
          adType:
            data.adType ||
            (data.listingType === 'service' || favorite.listingType === 'service'
              ? 'service'
              : 'item'),
        };
        primeProductIntoCache(resolved, { isFull: true, idbOnly: true });
        return resolved;
      }
    } catch {
      // If a favorited item was unpublished or deleted, treat gracefully below.
    }
  }

  const seedMatch = SEED_PRODUCTS.find((item) => item.id === favorite.listingId);
  if (seedMatch) {
    return {
      ...seedMatch,
      createdAt: favorite.createdAt,
    };
  }

  return cached?.data ?? null;
}

/**
 * Fetches all saved favorites for the given user and resolves each listing's details.
 */
export async function getUserFavorites(
  userId: string
): Promise<FavoriteWithListing[]> {
  if (!db || !userId.trim()) {
    return [];
  }

  const cleanUser = userId.trim();
  const colRef = collection(db, 'favorites');
  let favorites: Favorite[] = [];

  try {
    const q = query(
      colRef,
      where('userId', '==', cleanUser),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    favorites = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Favorite, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('userId', '==', cleanUser));
      const snapshot = await getDocs(fallbackQ);
      favorites = sortByCreatedAtDesc(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Favorite, 'id'>),
        }))
      );
    } else {
      throw mapBuyerFirestoreError(err, 'Unable to load your saved items.');
    }
  }

  const favMap: Record<string, boolean> = {};
  favorites.forEach((fav) => {
    if (fav.listingId) {
      favMap[fav.listingId] = true;
    }
  });
  setFastCache(`${USER_FAV_MAP_PREFIX}${cleanUser}`, favMap, { idbOnly: true });

  const listings = await Promise.all(
    favorites.map((favorite) => fetchListingForFavorite(favorite))
  );

  warmImages(
    listings.map((item) => item?.images?.[0]),
    12
  );

  return favorites.map((favorite, idx) => ({
    favorite,
    listing: listings[idx],
  }));
}

/**
 * Logs a buyer's WhatsApp enquiry into the enquiries collection.
 */
export async function logEnquiry(
  buyerId: string,
  sellerId: string,
  listingId: string,
  listingTitle: string
): Promise<void> {
  if (!db || !buyerId.trim() || !listingId.trim()) {
    return;
  }

  const payload: Omit<Enquiry, 'id'> = {
    buyerId,
    sellerId: sellerId || 'unknown',
    listingId,
    listingTitle,
    createdAt: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, 'enquiries'), payload);
  } catch (err) {
    // Non-blocking: never prevent the buyer from opening WhatsApp if logging fails.
    console.warn('Could not log enquiry:', err);
  }
}

/**
 * Fetches all enquiries logged by a buyer, newest first.
 */
export async function getUserEnquiries(userId: string): Promise<Enquiry[]> {
  if (!db || !userId.trim()) {
    return [];
  }

  const colRef = collection(db, 'enquiries');

  try {
    const q = query(
      colRef,
      where('buyerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Enquiry, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('buyerId', '==', userId));
      const snapshot = await getDocs(fallbackQ);
      return sortByCreatedAtDesc(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Enquiry, 'id'>),
        }))
      );
    }
    throw mapBuyerFirestoreError(err, 'Unable to load your enquiry history.');
  }
}
