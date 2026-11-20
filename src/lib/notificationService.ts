import {
  addDoc,
  collection,
  doc,
  FirestoreError,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  buildListingApprovedNotification,
  buildWhatsAppContactNotification,
  CreateNotificationPayload,
  sortNotificationsByNewest,
} from './notificationHelpers';
import { AppNotification } from '../types';

function mapNotificationError(err: unknown, fallback: string): Error {
  const firestoreErr = err as FirestoreError;
  if (firestoreErr?.code === 'unavailable') {
    return new Error(
      'Could not reach the notifications service. Check your internet connection.'
    );
  }
  if (firestoreErr?.code === 'permission-denied') {
    return new Error('You do not have permission to access these notifications.');
  }
  if (err instanceof Error && err.message) {
    return err;
  }
  return new Error(fallback);
}

/**
 * Fetches notifications for a given user ordered newest first.
 */
export async function getUserNotifications(
  userId: string,
  maxItems = 50
): Promise<AppNotification[]> {
  if (!db || !userId.trim()) {
    return [];
  }

  const colRef = collection(db, 'notifications');

  try {
    const q = query(
      colRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<AppNotification, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('userId', '==', userId));
      const snapshot = await getDocs(fallbackQ);
      return sortNotificationsByNewest(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AppNotification, 'id'>),
        }))
      ).slice(0, maxItems);
    }
    throw mapNotificationError(err, 'Unable to load notifications.');
  }
}

/**
 * Real-time listener for user notifications (used by Navbar bell badge).
 * Automatically falls back to unsorted query + client sort if composite index is missing.
 */
export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (items: AppNotification[]) => void,
  onError?: (err: Error) => void,
  maxItems = 30
): Unsubscribe {
  if (!db || !userId.trim()) {
    onUpdate([]);
    return () => {};
  }

  const firestore = db;
  const colRef = collection(firestore, 'notifications');
  let activeUnsubscribe: Unsubscribe = () => {};
  let switchedToFallback = false;

  const subscribePrimary = () => {
    const q = query(
      colRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );

    activeUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AppNotification, 'id'>),
        }));
        onUpdate(items);
      },
      (err) => {
        if (err?.code === 'failed-precondition' && !switchedToFallback) {
          switchedToFallback = true;
          const fallbackQ = query(colRef, where('userId', '==', userId));
          activeUnsubscribe = onSnapshot(
            fallbackQ,
            (snapshot) => {
              const sorted = sortNotificationsByNewest(
                snapshot.docs.map((docSnap) => ({
                  id: docSnap.id,
                  ...(docSnap.data() as Omit<AppNotification, 'id'>),
                }))
              ).slice(0, maxItems);
              onUpdate(sorted);
            },
            (fallbackErr) => {
              onError?.(
                mapNotificationError(fallbackErr, 'Unable to sync notifications.')
              );
            }
          );
          return;
        }
        onError?.(mapNotificationError(err, 'Unable to sync notifications.'));
      }
    );
  };

  subscribePrimary();

  return () => {
    activeUnsubscribe();
  };
}

/**
 * Marks a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  if (!db || !notificationId.trim()) {
    return;
  }

  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
    });
  } catch (err) {
    throw mapNotificationError(err, 'Failed to mark notification as read.');
  }
}

/**
 * Marks all provided unread notifications as read.
 */
export async function markAllAsRead(notificationIds: string[]): Promise<void> {
  if (!db || notificationIds.length === 0) {
    return;
  }

  try {
    const batch = writeBatch(db);
    for (const id of notificationIds) {
      if (id.trim()) {
        batch.update(doc(db, 'notifications', id), { isRead: true });
      }
    }
    await batch.commit();
  } catch (err) {
    throw mapNotificationError(err, 'Failed to mark notifications as read.');
  }
}

/**
 * Creates a notification document in Firestore.
 */
export async function createNotification(
  input: CreateNotificationPayload
): Promise<string | null> {
  if (!db || !input.userId.trim()) {
    return null;
  }

  const payload: Record<string, unknown> = {
    userId: input.userId.trim(),
    title: input.title.trim(),
    message: input.message.trim(),
    type: input.type,
    isRead: false,
    createdAt: serverTimestamp(),
  };

  if (input.link && input.link.trim()) {
    payload.link = input.link.trim();
  }

  const ref = await addDoc(collection(db, 'notifications'), payload);
  return ref.id;
}

/**
 * Convenience helper for admin listing approval notifications (Prompt 13).
 */
export async function notifyListingApproved(
  sellerId: string,
  listingTitle: string,
  link = '/dashboard/seller'
): Promise<void> {
  try {
    await createNotification(
      buildListingApprovedNotification(sellerId, listingTitle, link)
    );
  } catch (err) {
    console.warn('Failed to create listing approval notification:', err);
  }
}

/**
 * Convenience non-blocking helper for WhatsApp click enquiries.
 */
export async function notifyWhatsAppContact(
  sellerId: string,
  listingTitle: string,
  link = '/dashboard/seller'
): Promise<void> {
  try {
    await createNotification(
      buildWhatsAppContactNotification(sellerId, listingTitle, link)
    );
  } catch (err) {
    console.warn('Failed to create WhatsApp contact notification:', err);
  }
}
