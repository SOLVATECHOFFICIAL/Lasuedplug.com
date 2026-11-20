import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  FirestoreError,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getTimestampMillis } from './homeHelpers';
import {
  AdminDashboardStats,
  getAdminReportTargetCollection,
  mapAccommodationToPendingAdminItem,
  mapProductToPendingAdminItem,
  mapRoommateToPendingAdminItem,
  mapStoreToPendingAdminItem,
  PendingAdminItem,
  sortPendingAdminItems,
} from './adminHelpers';
import { buildListingRejectedNotification } from './notificationHelpers';
import { createNotification, notifyListingApproved } from './notificationService';
import {
  Accommodation,
  Product,
  Report,
  RoommateRequest,
  Store,
  UserProfile,
} from '../types';

function mapAdminError(err: unknown, fallback: string): Error {
  const firestoreErr = err as FirestoreError;
  if (firestoreErr?.code === 'unavailable') {
    return new Error(
      'Database temporarily unavailable. Check your internet connection and retry.'
    );
  }
  if (firestoreErr?.code === 'permission-denied') {
    return new Error(
      'Admin permissions required. Verify your account has admin privileges and Firestore rules are deployed.'
    );
  }
  if (err instanceof Error && err.message) {
    return err;
  }
  return new Error(fallback);
}

async function safeCountCollection(
  collectionName: string,
  filterField?: string,
  filterValue?: unknown
): Promise<number> {
  if (!db) return 0;
  const colRef = collection(db, collectionName);
  const q =
    filterField !== undefined
      ? query(colRef, where(filterField, '==', filterValue))
      : colRef;

  try {
    const agg = await getCountFromServer(q);
    return agg.data().count;
  } catch {
    const snap = await getDocs(q);
    return snap.size;
  }
}

/**
 * Aggregates top-level platform stats across Users, all 4 listing modules, Pending queue, and Open Reports.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  if (!db) {
    return {
      totalUsers: 0,
      totalListings: 0,
      pendingApprovals: 0,
      openReports: 0,
    };
  }

  try {
    const [
      totalUsers,
      totalProducts,
      totalAccommodations,
      totalRoommates,
      totalStores,
      pendingProducts,
      pendingAccommodations,
      pendingRoommates,
      pendingStores,
      openReports,
    ] = await Promise.all([
      safeCountCollection('users'),
      safeCountCollection('products'),
      safeCountCollection('accommodations'),
      safeCountCollection('roommate_requests'),
      safeCountCollection('stores'),
      safeCountCollection('products', 'isApproved', false),
      safeCountCollection('accommodations', 'isApproved', false),
      safeCountCollection('roommate_requests', 'isApproved', false),
      safeCountCollection('stores', 'isApproved', false),
      safeCountCollection('reports', 'status', 'open'),
    ]);

    return {
      totalUsers,
      totalListings:
        totalProducts + totalAccommodations + totalRoommates + totalStores,
      pendingApprovals:
        pendingProducts +
        pendingAccommodations +
        pendingRoommates +
        pendingStores,
      openReports,
    };
  } catch (err) {
    throw mapAdminError(err, 'Unable to load admin statistics.');
  }
}

async function fetchPendingDocs<T>(collectionName: string): Promise<T[]> {
  if (!db) return [];
  const colRef = collection(db, collectionName);
  const q = query(colRef, where('isApproved', '==', false));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<T, 'id'>),
  })) as T[];
}

/**
 * Fetches ALL unapproved (isApproved == false) submissions across the 4 modules:
 * products (Items & Services), accommodations, roommate_requests, and stores.
 */
export async function fetchPendingApprovals(): Promise<PendingAdminItem[]> {
  if (!db) {
    return [];
  }

  try {
    const [products, accommodations, roommates, stores] = await Promise.all([
      fetchPendingDocs<Product>('products'),
      fetchPendingDocs<Accommodation>('accommodations'),
      fetchPendingDocs<RoommateRequest>('roommate_requests'),
      fetchPendingDocs<Store>('stores'),
    ]);

    const combined: PendingAdminItem[] = [
      ...products.map(mapProductToPendingAdminItem),
      ...accommodations.map(mapAccommodationToPendingAdminItem),
      ...roommates.map(mapRoommateToPendingAdminItem),
      ...stores.map(mapStoreToPendingAdminItem),
    ];

    return sortPendingAdminItems(combined);
  } catch (err) {
    throw mapAdminError(err, 'Unable to fetch pending approvals queue.');
  }
}

/**
 * Approves a pending item in its target collection and notifies the owner.
 */
export async function approvePendingItem(item: PendingAdminItem): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!item.id) {
    throw new Error('Listing ID is missing.');
  }

  try {
    await updateDoc(doc(db, item.collectionName, item.id), {
      isApproved: true,
    });
    if (item.ownerId) {
      await notifyListingApproved(
        item.ownerId,
        item.title,
        '/dashboard/seller'
      );
    }
  } catch (err) {
    throw mapAdminError(err, 'Failed to approve listing.');
  }
}

/**
 * Rejects and deletes a pending item from its target collection and notifies the owner.
 */
export async function rejectPendingItem(item: PendingAdminItem): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!item.id) {
    throw new Error('Listing ID is missing.');
  }

  try {
    await deleteDoc(doc(db, item.collectionName, item.id));
    if (item.ownerId) {
      try {
        await createNotification(
          buildListingRejectedNotification(
            item.ownerId,
            item.title,
            '/dashboard/seller'
          )
        );
      } catch (notifErr) {
        console.warn('Failed to create rejection notification:', notifErr);
      }
    }
  } catch (err) {
    throw mapAdminError(err, 'Failed to reject and delete listing.');
  }
}

/**
 * Fetches all registered users sorted newest first.
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, 'users');

  try {
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      uid: docSnap.id,
      ...(docSnap.data() as Omit<UserProfile, 'uid'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const snap = await getDocs(colRef);
      return snap.docs
        .map((docSnap) => ({
          uid: docSnap.id,
          ...(docSnap.data() as Omit<UserProfile, 'uid'>),
        }))
        .sort(
          (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
    }
    throw mapAdminError(err, 'Unable to load users.');
  }
}

export async function updateUserAccountStatus(
  uid: string,
  nextStatus: 'active' | 'suspended'
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!uid.trim()) {
    throw new Error('User ID is missing.');
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      status: nextStatus,
    });
  } catch (err) {
    throw mapAdminError(err, 'Failed to update user account status.');
  }
}

/**
 * Fetches all open moderation reports ordered newest first.
 */
export async function getOpenReports(): Promise<Report[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, 'reports');

  try {
    const q = query(
      colRef,
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Report, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('status', '==', 'open'));
      const snap = await getDocs(fallbackQ);
      return snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Report, 'id'>),
        }))
        .sort(
          (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
        );
    }
    throw mapAdminError(err, 'Unable to load open reports.');
  }
}

export async function dismissReport(reportId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!reportId.trim()) {
    throw new Error('Report ID is missing.');
  }

  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status: 'resolved',
    });
  } catch (err) {
    throw mapAdminError(err, 'Failed to dismiss report.');
  }
}

/**
 * Deletes the reported listing/store target (or suspends the user if targetType === 'user')
 * and marks the report status as 'resolved'.
 */
export async function deleteReportTargetAndResolve(
  report: Report
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!report.id) {
    throw new Error('Report ID is missing.');
  }

  try {
    if (report.targetId) {
      if (report.targetType === 'user') {
        await updateDoc(doc(db, 'users', report.targetId), {
          status: 'suspended',
        });
      } else {
        const targetCollection = getAdminReportTargetCollection(
          report.targetType
        );
        if (targetCollection) {
          await deleteDoc(doc(db, targetCollection, report.targetId));
        }
      }
    }

    await updateDoc(doc(db, 'reports', report.id), {
      status: 'resolved',
    });
  } catch (err) {
    throw mapAdminError(err, 'Failed to remove reported content.');
  }
}

export async function submitReport(input: {
  reporterId: string;
  targetId: string;
  targetType: Report['targetType'];
  reason: string;
}): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  const trimmedReason = input.reason.trim();
  if (!trimmedReason || trimmedReason.length < 5) {
    throw new Error('Please describe the issue (at least 5 characters).');
  }

  try {
    const ref = await addDoc(collection(db, 'reports'), {
      reporterId: input.reporterId,
      targetId: input.targetId,
      targetType: input.targetType,
      reason: trimmedReason,
      status: 'open',
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    throw mapAdminError(err, 'Could not submit report. Please try again.');
  }
}
