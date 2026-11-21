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
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  hasKnownMissingIndex,
  markMissingIndex,
  runDeduplicatedQuery,
} from './firestoreQueryCache';
import { getTimestampMillis } from './homeHelpers';
import { sanitizePublicAccommodation } from './accommodationHelpers';
import {
  Accommodation,
  AccommodationType,
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
  ownerSnapshot: {
    fullName: string;
    isVerified: boolean;
    profilePic?: string;
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
  userSnapshot: {
    fullName: string;
    isVerified: boolean;
    profilePic?: string;
  };
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
      return snapshot.docs
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
      return snapshot.docs.map((docSnap) =>
        sanitizePublicAccommodation({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Accommodation, 'id'>),
        })
      );
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

export async function getPublicAccommodationById(
  id: string
): Promise<Omit<Accommodation, 'exactAddress'> | null> {
  if (!db || !id.trim()) {
    return null;
  }

  try {
    const snap = await getDoc(doc(db, 'accommodations', id));
    if (!snap.exists()) {
      return null;
    }
    return sanitizePublicAccommodation({
      id: snap.id,
      ...(snap.data() as Omit<Accommodation, 'id'>),
    });
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'unavailable') {
      throw new Error(
        'Could not reach the accommodation database. Check your internet connection and try again.'
      );
    }
    if (firestoreErr?.code === 'permission-denied') {
      return null;
    }
    throw err;
  }
}

export async function createAccommodation(
  input: CreateAccommodationInput
): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }

  const colRef = collection(db, 'accommodations');
  const newDocRef = doc(colRef);

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
    isApproved: false,
    isActive: true,
    createdAt: serverTimestamp(),
  };

  if (input.exactAddress && input.exactAddress.trim()) {
    payload.exactAddress = input.exactAddress.trim();
  }

  try {
    await setDoc(newDocRef, payload);
    return newDocRef.id;
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'already-exists') {
      const existingSnap = await getDoc(newDocRef);
      if (
        existingSnap.exists() &&
        existingSnap.data()?.ownerId === input.ownerId
      ) {
        return newDocRef.id;
      }
      const fallbackRef = doc(colRef);
      await setDoc(fallbackRef, payload);
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
      return snapshot.docs
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

export async function createRoommateRequest(
  input: CreateRoommateRequestInput
): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }

  const colRef = collection(db, 'roommate_requests');
  const newDocRef = doc(colRef);

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
    isApproved: false,
    isActive: true,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(newDocRef, payload);
    return newDocRef.id;
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'already-exists') {
      const existingSnap = await getDoc(newDocRef);
      if (
        existingSnap.exists() &&
        existingSnap.data()?.userId === input.userId
      ) {
        return newDocRef.id;
      }
      const fallbackRef = doc(colRef);
      await setDoc(fallbackRef, payload);
      return fallbackRef.id;
    }
    throw err;
  }
}
