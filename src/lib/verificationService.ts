import {
  addDoc,
  collection,
  doc,
  FirestoreError,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { createNotification } from './notificationService';
import {
  sortVerificationRequests,
  validateVerificationInput,
} from './verificationHelpers';
import { VerificationRequest } from '../types';

function mapVerificationError(err: unknown, fallback: string): Error {
  const firestoreErr = err as FirestoreError;
  if (firestoreErr?.code === 'unavailable') {
    return new Error(
      'Database temporarily unavailable. Check your internet connection and retry.'
    );
  }
  if (firestoreErr?.code === 'permission-denied') {
    return new Error(
      'Permission denied. Make sure you are signed in and Firestore rules are deployed.'
    );
  }
  if (err instanceof Error && err.message) {
    return err;
  }
  return new Error(fallback);
}

/**
 * Fetches verification requests submitted by a specific user (newest first).
 */
export async function getUserVerificationRequests(
  userId: string
): Promise<VerificationRequest[]> {
  if (!db || !userId.trim()) {
    return [];
  }

  try {
    const colRef = collection(db, 'verification_requests');
    const q = query(colRef, where('userId', '==', userId.trim()));
    const snap = await getDocs(q);
    const items = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<VerificationRequest, 'id'>),
    }));
    return sortVerificationRequests(items);
  } catch (err) {
    throw mapVerificationError(err, 'Unable to load verification status.');
  }
}

/**
 * Submits a new Student ID / Fee Receipt verification request for admin review.
 */
export async function submitVerificationRequest(input: {
  userId: string;
  fullName: string;
  idCardImage: string;
}): Promise<VerificationRequest> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }

  const validationError = validateVerificationInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const existing = await getUserVerificationRequests(input.userId);
    if (existing.some((req) => req.status === 'pending')) {
      throw new Error('You already have a verification request pending review.');
    }

    const trimmedUserId = input.userId.trim();
    const trimmedFullName = input.fullName.trim();

    const docRef = await addDoc(collection(db, 'verification_requests'), {
      userId: trimmedUserId,
      fullName: trimmedFullName,
      idCardImage: input.idCardImage,
      status: 'pending',
      createdAt: serverTimestamp(),
      reviewedAt: null,
    });

    return {
      id: docRef.id,
      userId: trimmedUserId,
      fullName: trimmedFullName,
      idCardImage: input.idCardImage,
      status: 'pending',
      createdAt: new Date(),
      reviewedAt: null,
    };
  } catch (err) {
    throw mapVerificationError(err, 'Failed to submit verification request.');
  }
}

/**
 * Admin: Fetches all pending student verification requests (newest first).
 */
export async function fetchPendingVerificationRequests(): Promise<
  VerificationRequest[]
> {
  if (!db) {
    return [];
  }

  try {
    const colRef = collection(db, 'verification_requests');
    const q = query(colRef, where('status', '==', 'pending'));
    const snap = await getDocs(q);
    const items = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<VerificationRequest, 'id'>),
    }));
    return sortVerificationRequests(items);
  } catch (err) {
    throw mapVerificationError(
      err,
      'Unable to load pending verification requests.'
    );
  }
}

async function syncUserSnapshotVerification(userId: string): Promise<void> {
  if (!db || !userId.trim()) return;

  const targets: Array<{
    collectionName: string;
    ownerField: string;
    snapshotField: string;
  }> = [
    {
      collectionName: 'products',
      ownerField: 'sellerId',
      snapshotField: 'sellerSnapshot.isVerified',
    },
    {
      collectionName: 'accommodations',
      ownerField: 'ownerId',
      snapshotField: 'ownerSnapshot.isVerified',
    },
    {
      collectionName: 'roommate_requests',
      ownerField: 'userId',
      snapshotField: 'userSnapshot.isVerified',
    },
    {
      collectionName: 'stores',
      ownerField: 'ownerId',
      snapshotField: 'ownerSnapshot.isVerified',
    },
  ];

  const batch = writeBatch(db);
  let updateCount = 0;

  for (const target of targets) {
    const snap = await getDocs(
      query(
        collection(db, target.collectionName),
        where(target.ownerField, '==', userId)
      )
    );
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, { [target.snapshotField]: true });
      updateCount += 1;
    }
  }

  if (updateCount > 0) {
    await batch.commit();
  }
}

/**
 * Admin: Approves a verification request, grants isVerified = true on users/{userId},
 * and best-effort propagates the badge to existing listing snapshots.
 */
export async function approveVerificationRequest(
  request: VerificationRequest
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!request.id || !request.userId) {
    throw new Error('Verification request ID or user ID is missing.');
  }

  try {
    await updateDoc(doc(db, 'verification_requests', request.id), {
      status: 'approved',
      reviewedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'users', request.userId), {
      isVerified: true,
      updatedAt: serverTimestamp(),
    });

    try {
      await syncUserSnapshotVerification(request.userId);
    } catch (syncErr) {
      console.warn('Could not sync snapshot verification across listings:', syncErr);
    }

    try {
      await createNotification({
        userId: request.userId,
        title: 'Student Verification Approved!',
        message:
          'Your Student ID has been verified. The Verified Student badge is now active on your profile and listings.',
        type: 'system',
        link: '/dashboard/profile',
      });
    } catch (notifErr) {
      console.warn('Could not send verification approval notification:', notifErr);
    }
  } catch (err) {
    throw mapVerificationError(err, 'Failed to approve verification request.');
  }
}

/**
 * Admin: Rejects a pending verification request and notifies the student.
 */
export async function rejectVerificationRequest(
  request: VerificationRequest
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!request.id) {
    throw new Error('Verification request ID is missing.');
  }

  try {
    await updateDoc(doc(db, 'verification_requests', request.id), {
      status: 'rejected',
      reviewedAt: serverTimestamp(),
    });

    if (request.userId) {
      try {
        await createNotification({
          userId: request.userId,
          title: 'Verification Request Not Approved',
          message:
            'Your uploaded ID document could not be verified. Please upload a clearer Student ID or School Fee Receipt on your profile.',
          type: 'system',
          link: '/dashboard/profile',
        });
      } catch (notifErr) {
        console.warn('Could not send verification rejection notification:', notifErr);
      }
    }
  } catch (err) {
    throw mapVerificationError(err, 'Failed to reject verification request.');
  }
}

export async function bulkApproveVerificationRequests(
  requests: VerificationRequest[]
): Promise<{ succeeded: VerificationRequest[]; failedCount: number }> {
  const succeeded: VerificationRequest[] = [];
  let failedCount = 0;

  for (const req of requests) {
    try {
      await approveVerificationRequest(req);
      succeeded.push(req);
    } catch {
      failedCount += 1;
    }
  }

  return { succeeded, failedCount };
}

export async function bulkRejectVerificationRequests(
  requests: VerificationRequest[]
): Promise<{ succeeded: VerificationRequest[]; failedCount: number }> {
  const succeeded: VerificationRequest[] = [];
  let failedCount = 0;

  for (const req of requests) {
    try {
      await rejectVerificationRequest(req);
      succeeded.push(req);
    } catch {
      failedCount += 1;
    }
  }

  return { succeeded, failedCount };
}

