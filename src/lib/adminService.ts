import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  FirestoreError,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { getTimestampMillis } from './homeHelpers';
import {
  AdminDashboardStats,
  EnrichedReport,
  extractListingOwnerId,
  getAdminReportTargetCollection,
  getAdminUserFilterUrl,
  getReportListingRoute,
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

const USER_LISTING_COLLECTIONS: ReadonlyArray<{
  collectionName: string;
  ownerField: string;
}> = [
  { collectionName: 'products', ownerField: 'sellerId' },
  { collectionName: 'services', ownerField: 'providerId' },
  { collectionName: 'accommodations', ownerField: 'ownerId' },
  { collectionName: 'roommate_requests', ownerField: 'userId' },
  { collectionName: 'stores', ownerField: 'ownerId' },
];

/**
 * Hides all listings/stores belonging to a user by setting `isActive = false`
 * across all listing collections without deleting any documents.
 */
export async function hideAllUserListings(uid: string): Promise<number> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  const cleanUid = uid.trim();
  if (!cleanUid) {
    return 0;
  }

  const firestore = db;
  const refsToHide: DocumentReference[] = [];

  await Promise.all(
    USER_LISTING_COLLECTIONS.map(async ({ collectionName, ownerField }) => {
      const q = query(
        collection(firestore, collectionName),
        where(ownerField, '==', cleanUid)
      );
      const snap = await getDocs(q);
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data() as { isActive?: boolean };
        if (data.isActive !== false) {
          refsToHide.push(docSnap.ref);
        }
      });
    })
  );

  const BATCH_LIMIT = 400;
  for (let i = 0; i < refsToHide.length; i += BATCH_LIMIT) {
    const batch = writeBatch(firestore);
    const chunk = refsToHide.slice(i, i + BATCH_LIMIT);
    chunk.forEach((ref) => {
      batch.update(ref, { isActive: false });
    });
    await batch.commit();
  }

  return refsToHide.length;
}

export async function updateUserAccountStatus(
  uid: string,
  nextStatus: 'active' | 'suspended'
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  const cleanUid = uid.trim();
  if (!cleanUid) {
    throw new Error('User ID is missing.');
  }

  try {
    if (nextStatus === 'suspended') {
      await updateDoc(doc(db, 'users', cleanUid), {
        status: 'suspended',
      });
      await hideAllUserListings(cleanUid);
    } else {
      await updateDoc(doc(db, 'users', cleanUid), {
        status: 'active',
        isBanned: false,
      });
    }
  } catch (err) {
    throw mapAdminError(err, 'Failed to update user account status.');
  }
}

export async function banUserAccount(uid: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  const cleanUid = uid.trim();
  if (!cleanUid) {
    throw new Error('User ID is missing.');
  }

  try {
    await updateDoc(doc(db, 'users', cleanUid), {
      status: 'suspended',
      isBanned: true,
    });
    await hideAllUserListings(cleanUid);
  } catch (err) {
    throw mapAdminError(err, 'Failed to ban user account.');
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

/**
 * Fetches all open reports and enriches each with reporter name, offender info/profile link,
 * and reported listing title/link for the admin moderation modal.
 */
export async function getEnrichedOpenReports(): Promise<EnrichedReport[]> {
  if (!db) {
    return [];
  }

  const firestore = db;
  const openReports = await getOpenReports();
  if (openReports.length === 0) {
    return [];
  }

  const userCache = new Map<string, UserProfile | null>();

  async function loadUserCached(uid: string): Promise<UserProfile | null> {
    const clean = uid.trim();
    if (!clean) return null;
    if (userCache.has(clean)) {
      return userCache.get(clean) || null;
    }
    try {
      const snap = await getDoc(doc(firestore, 'users', clean));
      const profile = snap.exists()
        ? ({
            uid: snap.id,
            ...(snap.data() as Omit<UserProfile, 'uid'>),
          } as UserProfile)
        : null;
      userCache.set(clean, profile);
      return profile;
    } catch {
      userCache.set(clean, null);
      return null;
    }
  }

  const enriched = await Promise.all(
    openReports.map(async (report): Promise<EnrichedReport> => {
      const reporterProfile = await loadUserCached(report.reporterId);
      const reporterName =
        reporterProfile?.fullName?.trim() ||
        reporterProfile?.email ||
        report.reporterId ||
        'Unknown Reporter';

      let targetData: Record<string, unknown> | null = null;
      let listingExists = false;
      const targetCollection = getAdminReportTargetCollection(report.targetType);

      if (targetCollection && report.targetId) {
        try {
          const targetSnap = await getDoc(
            doc(firestore, targetCollection, report.targetId)
          );
          if (targetSnap.exists()) {
            listingExists = true;
            targetData = targetSnap.data() as Record<string, unknown>;
          }
        } catch {
          targetData = null;
        }
      }

      const offenderId = extractListingOwnerId(
        report.targetType,
        report.targetId,
        targetData
      );
      const offenderProfile = offenderId ? await loadUserCached(offenderId) : null;

      const offenderName =
        offenderProfile?.fullName?.trim() ||
        offenderProfile?.email ||
        (offenderId ? `User (${offenderId.slice(0, 8)}...)` : 'Unknown User');

      const offenderEmail = offenderProfile?.email || '';
      const offenderProfileUrl = offenderId
        ? getAdminUserFilterUrl(offenderEmail || offenderId)
        : null;

      const rawTitle =
        typeof targetData?.title === 'string' && targetData.title.trim()
          ? targetData.title.trim()
          : typeof targetData?.name === 'string' && targetData.name.trim()
          ? targetData.name.trim()
          : '';

      const listingTitle =
        report.targetType === 'user'
          ? offenderName
          : rawTitle ||
            (listingExists
              ? `Listing (${report.targetId})`
              : `Deleted or unavailable (${report.targetId})`);

      const listingUrl =
        report.targetType !== 'user' && listingExists
          ? getReportListingRoute(report.targetType, report.targetId, targetData)
          : null;

      return {
        report,
        reporterName,
        offenderId,
        offenderName,
        offenderEmail,
        offenderStatus: offenderProfile?.status ?? null,
        offenderIsBanned: Boolean(offenderProfile?.isBanned),
        offenderProfileUrl,
        listingTitle,
        listingExists,
        listingUrl,
      };
    })
  );

  return enriched;
}

/**
 * Action 1: Dismisses a report without touching the listing or user (`status = 'dismissed'`).
 */
export async function dismissReport(reportId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!reportId.trim()) {
    throw new Error('Report ID is missing.');
  }

  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status: 'dismissed',
    });
  } catch (err) {
    throw mapAdminError(err, 'Failed to dismiss report.');
  }
}

/**
 * Action 2: Deletes the specific reported listing and marks report `status = 'resolved'`.
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
    if (report.targetId && report.targetType !== 'user') {
      const targetCollection = getAdminReportTargetCollection(
        report.targetType
      );
      if (targetCollection) {
        await deleteDoc(doc(db, targetCollection, report.targetId));
      }
    }

    await updateDoc(doc(db, 'reports', report.id), {
      status: 'resolved',
    });
  } catch (err) {
    throw mapAdminError(err, 'Failed to delete reported listing.');
  }
}

/**
 * Action 3: Suspends the offending user (`status = 'suspended'`), hides all their listings
 * (`isActive = false`), and marks report `status = 'resolved'`.
 */
export async function suspendReportedUserAndResolve(
  reportId: string,
  offenderId: string
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!reportId.trim()) {
    throw new Error('Report ID is missing.');
  }
  if (!offenderId.trim()) {
    throw new Error('Offending user ID could not be resolved.');
  }

  try {
    await updateUserAccountStatus(offenderId, 'suspended');
    await updateDoc(doc(db, 'reports', reportId), {
      status: 'resolved',
    });
  } catch (err) {
    throw mapAdminError(err, 'Failed to suspend offending user.');
  }
}

/**
 * Action 4: Bans the offending user (`status = 'suspended'`, `isBanned = true`),
 * hides all their listings (`isActive = false`), and marks report `status = 'resolved'`.
 */
export async function banReportedUserAndResolve(
  reportId: string,
  offenderId: string
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  if (!reportId.trim()) {
    throw new Error('Report ID is missing.');
  }
  if (!offenderId.trim()) {
    throw new Error('Offending user ID could not be resolved.');
  }

  try {
    await banUserAccount(offenderId);
    await updateDoc(doc(db, 'reports', reportId), {
      status: 'resolved',
    });
  } catch (err) {
    throw mapAdminError(err, 'Failed to ban offending user.');
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
