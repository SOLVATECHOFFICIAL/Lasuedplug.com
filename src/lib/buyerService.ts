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
import { buildFavoriteDocId, sortByCreatedAtDesc } from './buyerHelpers';
import { SEED_PRODUCTS } from './homeHelpers';
import { Enquiry, Favorite, Product } from '../types';

export interface FavoriteWithListing {
  favorite: Favorite;
  listing: Product | null;
}

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

/**
 * Checks whether a listing is currently saved in the user's favorites.
 */
export async function isListingFavorited(
  userId: string,
  listingId: string
): Promise<boolean> {
  if (!db || !userId.trim() || !listingId.trim()) {
    return false;
  }

  try {
    const q = query(
      collection(db, 'favorites'),
      where('userId', '==', userId),
      where('listingId', '==', listingId)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
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
  if (!userId.trim() || !listingId.trim()) {
    throw new Error('User and listing IDs are required.');
  }

  const colRef = collection(db, 'favorites');
  const deterministicId = buildFavoriteDocId(userId, listingId);

  try {
    if (isFavorited) {
      const existingQuery = query(
        colRef,
        where('userId', '==', userId),
        where('listingId', '==', listingId)
      );
      const snapshot = await getDocs(existingQuery);
      if (!snapshot.empty) {
        await Promise.all(
          snapshot.docs.map((docSnap) => deleteDoc(doc(db!, 'favorites', docSnap.id)))
        );
      } else {
        await deleteDoc(doc(db, 'favorites', deterministicId));
      }
      return false;
    }

    const payload: Omit<Favorite, 'id'> = {
      userId,
      listingId,
      listingType,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'favorites', deterministicId), payload);
    return true;
  } catch (err) {
    throw mapBuyerFirestoreError(err, 'Unable to update saved items right now.');
  }
}

async function fetchListingForFavorite(favorite: Favorite): Promise<Product | null> {
  if (!db) {
    return null;
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
        return {
          id: snap.id,
          ...data,
          adType:
            data.adType ||
            (data.listingType === 'service' || favorite.listingType === 'service'
              ? 'service'
              : 'item'),
        };
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

  return null;
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

  const colRef = collection(db, 'favorites');
  let favorites: Favorite[] = [];

  try {
    const q = query(
      colRef,
      where('userId', '==', userId),
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
      const fallbackQ = query(colRef, where('userId', '==', userId));
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

  const listings = await Promise.all(
    favorites.map((favorite) => fetchListingForFavorite(favorite))
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
