import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  FirestoreError,
} from 'firebase/firestore';
import { db } from './firebase';
import { filterAndSortListings } from './homeHelpers';
import { Accommodation, Product, Service } from '../types';

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
    // Fallback when composite index has not yet been deployed to the Firebase project.
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

export async function getLatestProducts(limitCount = 4): Promise<Product[]> {
  return fetchLatestFromCollection<Product>('products', limitCount);
}

export async function getLatestServices(limitCount = 4): Promise<Service[]> {
  return fetchLatestFromCollection<Service>('services', limitCount);
}

export async function getLatestAccommodations(
  limitCount = 4
): Promise<Accommodation[]> {
  return fetchLatestFromCollection<Accommodation>('accommodations', limitCount);
}
