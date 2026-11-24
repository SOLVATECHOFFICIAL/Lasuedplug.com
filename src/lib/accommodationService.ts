import {
  collection,
  doc,
  FirestoreError,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { sanitizePublicAccommodation } from './accommodationHelpers';
import { invalidateFastCachePrefix } from './fastCache';
import {
  hasKnownMissingIndex,
  markMissingIndex,
  runDeduplicatedQuery,
} from './firestoreQueryCache';
import { getTimestampMillis } from './homeHelpers';
import { warmImages } from './imageCache';
import {
  invalidatePublicFeedCaches,
  primeAccommodationIntoCache,
  shouldSkipDetailNetworkFetch,
} from './syncCache';
import {
  Accommodation,
  AccommodationType,
  AccountType,
  RoommateRequest,
  RoommateRequestType,
} from '../types';

export interface CreateAccommodationInput {
  ownerId: string;
  type: AccommodationType;
  title: string;
  description: string;
  rentPrice: number;
  generalLocation: string;
  exactAddress?: string;
  locationType?: 'physical';
  latitude: number;
  longitude: number;
  amenities: string[];
  images: string[];
  whatsappNumber: string;
  isApproved?: boolean;
  ownerSnapshot: {
    fullName: string;
    isVerified: boolean;
    profilePic?: string;
    accountType?: AccountType;
  };
}

export interface CreateRoommateRequestInput {
  userId: string;
  type: RoommateRequestType;
  title: string;
  description: string;
  budget: number;
  generalLocation: string;
  locationType?: 'physical';
  latitude: number;
  longitude: number;
  preferences: string;
  images: string[];
  whatsappNumber: string;
  isApproved?: boolean;
  userSnapshot: {
    fullName: string;
    isVerified: boolean;
    profilePic?: string;
    accountType?: AccountType;
  };
}

export function primeAccommodationsIntoCache(
  items: ReadonlyArray<Omit<Accommodation, 'exactAddress'>>,
  isFull = true
): void {
  const coverUrls: Array<string | undefined> = [];
  for (const item of items) {
    primeAccommodationIntoCache(item, { isFull, idbOnly: true });
    coverUrls.push(item.images?.[0]);
  }
  warmImages(coverUrls, 12);
}

export async function fetchApprovedAccommodations(): Promise<
  Omit<Accommodation, 'exactAddress'>[]
> {
  if (!db) {
    return [];
  }

  return runDeduplicatedQuery('accommodations:approved', async () => {
    const colRef = collection(db!, 'accommodations');
    const indexKey = 'accommodations:approved_active_createdAt';

    const runFallback = async () => {
      const fallbackQ = query(
        colRef,
        where('isApproved', '==', true),
        limit(60)
      );
      const snapshot = await getDocs(fallbackQ);
      const rows = snapshot.docs
        .map((docSnap) =>
          sanitizePublicAccommodation({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Accommodation, 'id'>),
          })
        )
        .filter((item) => item.isApproved === true && item.isActive === true)
        .sort(
          (a, b) =>
            getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
      primeAccommodationsIntoCache(rows, true);
      return rows;
    };

    if (hasKnownMissingIndex(indexKey)) {
      return runFallback();
    }

    try {
      const q = query(
        colRef,
        where('isApproved', '==', true),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(60)
      );
      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map((docSnap) =>
        sanitizePublicAccommodation({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Accommodation, 'id'>),
        })
      );
      primeAccommodationsIntoCache(rows, true);
      return rows;
    } catch (err) {
      const firestoreErr = err as FirestoreError;
      if (firestoreErr?.code === 'failed-precondition') {
        markMissingIndex(indexKey);
        return runFallback();
      }
      if (firestoreErr?.code === 'unavailable') {
        throw new Error(
          'Could not reach the accommodation database. Check your internet connection and try again.'
        );
      }
      throw err;
    }
  });
}

export async function fetchApprovedAccommodationsDelta(
  afterCreatedAtMs: number
): Promise<Omit<Accommodation, 'exactAddress'>[]> {
  if (!db || afterCreatedAtMs <= 0) {
    return [];
  }

  const indexKey = 'accommodations:approved_active_createdAt';
  if (hasKnownMissingIndex(indexKey)) {
    return [];
  }

  try {
    const q = query(
      collection(db, 'accommodations'),
      where('isApproved', '==', true),
      where('isActive', '==', true),
      where('createdAt', '>', Timestamp.fromMillis(afterCreatedAtMs + 1)),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map((docSnap) =>
      sanitizePublicAccommodation({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Accommodation, 'id'>),
      })
    );
    primeAccommodationsIntoCache(rows, true);
    return rows;
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      markMissingIndex(indexKey);
    }
    return [];
  }
}

export async function getPublicAccommodationById(
  id: string,
  options?: { force?: boolean }
): Promise<Omit<Accommodation, 'exactAddress'> | null> {
  const cleanId = id.trim();
  if (!cleanId) {
    return null;
  }

  const cacheCheck = shouldSkipDetailNetworkFetch<
    Omit<Accommodation, 'exactAddress'>
  >(`accommodation:${cleanId}`, {
    force: options?.force,
  });
  if (cacheCheck.skip && cacheCheck.cached) {
    return cacheCheck.cached;
  }

  if (!db) {
    return cacheCheck.cached;
  }

  return runDeduplicatedQuery(`accommodation:get:${cleanId}`, async () => {
    try {
      const snap = await getDoc(doc(db!, 'accommodations', cleanId));
      if (!snap.exists()) {
        return null;
      }
      const record = sanitizePublicAccommodation({
        id: snap.id,
        ...(snap.data() as Omit<Accommodation, 'id'>),
      });
      primeAccommodationIntoCache(record, { isFull: true, idbOnly: false });
      return record;
    } catch (err) {
      const firestoreErr = err as FirestoreError;
      if (firestoreErr?.code === 'unavailable') {
        if (cacheCheck.cached) return cacheCheck.cached;
        throw new Error(
          'Could not reach the accommodation database. Check your internet connection and try again.'
        );
      }
      if (firestoreErr?.code === 'permission-denied') {
        return null;
      }
      throw err;
    }
  });
}

export async function createAccommodation(
  input: CreateAccommodationInput
): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }

  const colRef = collection(db, 'accommodations');
  const newDocRef = doc(colRef);

  const isApproved = input.isApproved === true;

  const payload: Record<string, unknown> = {
    ownerId: input.ownerId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    rentPrice: input.rentPrice,
    generalLocation: input.generalLocation.trim(),
    locationType: 'physical',
    latitude: input.latitude,
    longitude: input.longitude,
    amenities: input.amenities,
    images: input.images,
    whatsappNumber: input.whatsappNumber.trim(),
    ownerSnapshot: input.ownerSnapshot,
    isApproved,
    isActive: true,
    createdAt: serverTimestamp(),
  };

  if (input.exactAddress && input.exactAddress.trim()) {
    payload.exactAddress = input.exactAddress.trim();
  }

  try {
    await setDoc(newDocRef, payload);
    invalidateFastCachePrefix('seller_dash:');
    if (isApproved) {
      invalidatePublicFeedCaches({ accommodationId: newDocRef.id });
    }
    return newDocRef.id;
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'already-exists') {
      const existingSnap = await getDoc(newDocRef);
      if (
        existingSnap.exists() &&
        existingSnap.data()?.ownerId === input.ownerId
      ) {
        invalidateFastCachePrefix('seller_dash:');
        if (isApproved) {
          invalidatePublicFeedCaches({ accommodationId: newDocRef.id });
        }
        return newDocRef.id;
      }
      const fallbackRef = doc(colRef);
      await setDoc(fallbackRef, payload);
      invalidateFastCachePrefix('seller_dash:');
      if (isApproved) {
        invalidatePublicFeedCaches({ accommodationId: fallbackRef.id });
      }
      return fallbackRef.id;
    }
    throw err;
  }
}

export async function fetchApprovedRoommateRequests(): Promise<
  RoommateRequest[]
> {
  if (!db) {
    return [];
  }

  return runDeduplicatedQuery('roommates:approved', async () => {
    const colRef = collection(db!, 'roommate_requests');
    const indexKey = 'roommate_requests:approved_active_createdAt';

    const runFallback = async () => {
      const fallbackQ = query(
        colRef,
        where('isApproved', '==', true),
        limit(60)
      );
      const snapshot = await getDocs(fallbackQ);
      const rows = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as Partial<RoommateRequest>;
          return {
            id: docSnap.id,
            ...(data as Omit<RoommateRequest, 'id'>),
            images: Array.isArray(data.images) ? data.images : [],
          };
        })
        .filter((item) => item.isApproved === true && item.isActive === true)
        .sort(
          (a, b) =>
            getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
      warmImages(rows.map((r) => r.images?.[0]), 12);
      return rows;
    };

    if (hasKnownMissingIndex(indexKey)) {
      return runFallback();
    }

    try {
      const q = query(
        colRef,
        where('isApproved', '==', true),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(60)
      );
      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Partial<RoommateRequest>;
        return {
          id: docSnap.id,
          ...(data as Omit<RoommateRequest, 'id'>),
          images: Array.isArray(data.images) ? data.images : [],
        };
      });
      warmImages(rows.map((r) => r.images?.[0]), 12);
      return rows;
    } catch (err) {
      const firestoreErr = err as FirestoreError;
      if (firestoreErr?.code === 'failed-precondition') {
        markMissingIndex(indexKey);
        return runFallback();
      }
      if (firestoreErr?.code === 'unavailable') {
        throw new Error(
          'Could not reach the roommate requests database. Check your internet connection and try again.'
        );
      }
      throw err;
    }
  });
}

export async function fetchApprovedRoommateRequestsDelta(
  afterCreatedAtMs: number
): Promise<RoommateRequest[]> {
  if (!db || afterCreatedAtMs <= 0) {
    return [];
  }

  const indexKey = 'roommate_requests:approved_active_createdAt';
  if (hasKnownMissingIndex(indexKey)) {
    return [];
  }

  try {
    const q = query(
      collection(db, 'roommate_requests'),
      where('isApproved', '==', true),
      where('isActive', '==', true),
      where('createdAt', '>', Timestamp.fromMillis(afterCreatedAtMs + 1)),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Partial<RoommateRequest>;
      return {
        id: docSnap.id,
        ...(data as Omit<RoommateRequest, 'id'>),
        images: Array.isArray(data.images) ? data.images : [],
      };
    });
    warmImages(rows.map((r) => r.images?.[0]), 12);
    return rows;
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      markMissingIndex(indexKey);
    }
    return [];
  }
}

export async function createRoommateRequest(
  input: CreateRoommateRequestInput
): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }

  const colRef = collection(db, 'roommate_requests');
  const newDocRef = doc(colRef);

  const isApproved = input.isApproved === true;

  const payload: Record<string, unknown> = {
    userId: input.userId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    budget: input.budget,
    generalLocation: input.generalLocation.trim(),
    locationType: 'physical',
    latitude: input.latitude,
    longitude: input.longitude,
    preferences: input.preferences.trim(),
    images: Array.isArray(input.images) ? input.images : [],
    whatsappNumber: input.whatsappNumber.trim(),
    userSnapshot: input.userSnapshot,
    isApproved,
    isActive: true,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(newDocRef, payload);
    invalidateFastCachePrefix('seller_dash:');
    if (isApproved) {
      invalidatePublicFeedCaches();
    }
    return newDocRef.id;
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'already-exists') {
      const existingSnap = await getDoc(newDocRef);
      if (
        existingSnap.exists() &&
        existingSnap.data()?.userId === input.userId
      ) {
        invalidateFastCachePrefix('seller_dash:');
        if (isApproved) {
          invalidatePublicFeedCaches();
        }
        return newDocRef.id;
      }
      const fallbackRef = doc(colRef);
      await setDoc(fallbackRef, payload);
      invalidateFastCachePrefix('seller_dash:');
      if (isApproved) {
        invalidatePublicFeedCaches();
      }
      return fallbackRef.id;
    }
    throw err;
  }
}
