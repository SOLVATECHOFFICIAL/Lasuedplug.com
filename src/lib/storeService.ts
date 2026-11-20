import {
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
import { getTimestampMillis } from './homeHelpers';
import { Store } from '../types';

function mapStoreFirestoreError(err: unknown, fallbackMessage: string): Error {
  const firestoreErr = err as FirestoreError;
  if (firestoreErr?.code === 'unavailable') {
    return new Error(
      'Could not reach the database. Check your internet connection and try again.'
    );
  }
  if (firestoreErr?.code === 'permission-denied') {
    return new Error(
      'Permission denied while saving store. Make sure you are signed in and Firestore rules are deployed.'
    );
  }
  if (err instanceof Error && err.message) {
    return err;
  }
  return new Error(fallbackMessage);
}

/**
 * Fetches all stores owned by a specific user (including pending approval), newest first.
 */
export async function getUserStores(ownerId: string): Promise<Store[]> {
  if (!db || !ownerId.trim()) {
    return [];
  }

  const colRef = collection(db, 'stores');

  try {
    const q = query(
      colRef,
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Partial<Store>;
      return {
        id: docSnap.id,
        ...(data as Omit<Store, 'id'>),
        isApproved: data.isApproved === true,
        isActive: data.isActive !== false,
      };
    });
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('ownerId', '==', ownerId));
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as Partial<Store>;
          return {
            id: docSnap.id,
            ...(data as Omit<Store, 'id'>),
            isApproved: data.isApproved === true,
            isActive: data.isActive !== false,
          };
        })
        .sort(
          (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
    }
    throw mapStoreFirestoreError(err, 'Unable to load your stores.');
  }
}

/**
 * Fetches publicly approved and active stores.
 */
export async function getApprovedStores(): Promise<Store[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, 'stores');

  try {
    const q = query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Store, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('isApproved', '==', true));
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Store, 'id'>),
        }))
        .filter((s) => s.isApproved === true && s.isActive !== false)
        .sort(
          (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
    }
    throw mapStoreFirestoreError(err, 'Unable to load stores.');
  }
}

/**
 * Creates a new Store document in Firestore with isApproved: false so an Admin must approve
 * before it becomes publicly visible. Includes idempotent already-exists recovery.
 */
export async function createStore(
  storeData: Omit<Store, 'id' | 'createdAt' | 'isApproved' | 'isActive'>
): Promise<Store> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }

  const storesCol = collection(db, 'stores');
  const docRef = doc(storesCol);
  const payload = {
    ...storeData,
    isApproved: false,
    isActive: true,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
    return {
      id: docRef.id,
      ...storeData,
      isApproved: false,
      isActive: true,
      createdAt: new Date(),
    };
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';

    if (code === 'already-exists') {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data()?.ownerId === storeData.ownerId) {
          return {
            id: docRef.id,
            ...storeData,
            isApproved: false,
            isActive: true,
            createdAt: new Date(),
          };
        }
      } catch {
        // Ignore and write to a fresh ID
      }
      const freshRef = doc(storesCol);
      await setDoc(freshRef, payload);
      return {
        id: freshRef.id,
        ...storeData,
        isApproved: false,
        isActive: true,
        createdAt: new Date(),
      };
    }

    throw mapStoreFirestoreError(err, 'Failed to create store. Please try again.');
  }
}

export async function deleteStore(storeId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!storeId.trim()) {
    throw new Error('Store ID is missing.');
  }

  try {
    await deleteDoc(doc(db, 'stores', storeId));
  } catch (err) {
    throw mapStoreFirestoreError(err, 'Failed to delete store.');
  }
}
