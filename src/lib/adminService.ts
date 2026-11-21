import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  DocumentReference,
  FirestoreError,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { invalidateFastCache, invalidateFastCachePrefix } from './fastCache';
import { getTimestampMillis } from './homeHelpers';
import { isMarketerProfile } from './authHelpers';
import { isServiceAd } from './sellerHelpers';
import {
  AdminAlertCounts,
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
import { fetchPendingVerificationRequests } from './verificationService';
import {
  Accommodation,
  AccountType,
  Product,
  Report,
  RoommateRequest,
  Store,
  UserProfile,
  VerificationRequest,
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
 * Aggregates comprehensive platform stats across Users (Students vs Marketers, verification, shop mode),
 * all 5 marketplace modules (Items, Services, Accommodation, Roommates, Stores), Pending queues, and Open Reports.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  if (!db) {
    return {
      totalUsers: 0,
      studentUsers: 0,
      marketerUsers: 0,
      verifiedUsers: 0,
      verifiedStudents: 0,
      verifiedMarketers: 0,
      physicalShopMarketers: 0,
      onlineOnlyMarketers: 0,
      suspendedUsers: 0,
      bannedUsers: 0,
      totalListings: 0,
      pendingApprovals: 0,
      pendingVerifications: 0,
      openReports: 0,
      moduleBreakdown: {
        itemsTotal: 0,
        itemsPending: 0,
        servicesTotal: 0,
        servicesPending: 0,
        roomsTotal: 0,
        roomsPending: 0,
        roommatesTotal: 0,
        roommatesPending: 0,
        storesTotal: 0,
        storesPending: 0,
      },
    };
  }

  try {
    const [
      usersSnap,
      productsSnap,
      totalAccommodations,
      totalRoommates,
      totalStores,
      pendingAccommodations,
      pendingRoommates,
      pendingStores,
      pendingVerifications,
      openReports,
    ] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'products')),
      safeCountCollection('accommodations'),
      safeCountCollection('roommate_requests'),
      safeCountCollection('stores'),
      safeCountCollection('accommodations', 'isApproved', false),
      safeCountCollection('roommate_requests', 'isApproved', false),
      safeCountCollection('stores', 'isApproved', false),
      safeCountCollection('verification_requests', 'status', 'pending'),
      safeCountCollection('reports', 'status', 'open'),
    ]);

    let studentUsers = 0;
    let marketerUsers = 0;
    let verifiedStudents = 0;
    let verifiedMarketers = 0;
    let physicalShopMarketers = 0;
    let onlineOnlyMarketers = 0;
    let suspendedUsers = 0;
    let bannedUsers = 0;

    usersSnap.docs.forEach((docSnap) => {
      const u = docSnap.data() as Partial<UserProfile>;
      const isMarketer = isMarketerProfile(u);
      if (isMarketer) {
        marketerUsers += 1;
        if (u.isVerified) verifiedMarketers += 1;
        if (u.isOnlineOnly === true) {
          onlineOnlyMarketers += 1;
        } else {
          physicalShopMarketers += 1;
        }
      } else {
        studentUsers += 1;
        if (u.isVerified) verifiedStudents += 1;
      }
      if (u.status === 'suspended' || u.isBanned === true) {
        suspendedUsers += 1;
      }
      if (u.isBanned === true) {
        bannedUsers += 1;
      }
    });

    let itemsTotal = 0;
    let itemsPending = 0;
    let servicesTotal = 0;
    let servicesPending = 0;

    productsSnap.docs.forEach((docSnap) => {
      const p = docSnap.data() as Product;
      const isService = isServiceAd(p);
      if (isService) {
        servicesTotal += 1;
        if (p.isApproved === false) servicesPending += 1;
      } else {
        itemsTotal += 1;
        if (p.isApproved === false) itemsPending += 1;
      }
    });

    const totalUsers = usersSnap.size;
    const verifiedUsers = verifiedStudents + verifiedMarketers;
    const totalListings =
      itemsTotal +
      servicesTotal +
      totalAccommodations +
      totalRoommates +
      totalStores;
    const pendingApprovals =
      itemsPending +
      servicesPending +
      pendingAccommodations +
      pendingRoommates +
      pendingStores;

    return {
      totalUsers,
      studentUsers,
      marketerUsers,
      verifiedUsers,
      verifiedStudents,
      verifiedMarketers,
      physicalShopMarketers,
      onlineOnlyMarketers,
      suspendedUsers,
      bannedUsers,
      totalListings,
      pendingApprovals,
      pendingVerifications,
      openReports,
      moduleBreakdown: {
        itemsTotal,
        itemsPending,
        servicesTotal,
        servicesPending,
        roomsTotal: totalAccommodations,
        roomsPending: pendingAccommodations,
        roommatesTotal: totalRoommates,
        roommatesPending: pendingRoommates,
        storesTotal: totalStores,
        storesPending: pendingStores,
      },
    };
  } catch (err) {
    throw mapAdminError(err, 'Unable to load admin statistics.');
  }
}

export interface EnhancedAdminOverview {
  stats: AdminDashboardStats;
  recentPendingListings: PendingAdminItem[];
  recentVerifications: VerificationRequest[];
  recentReports: Report[];
}

export async function getEnhancedAdminOverview(): Promise<EnhancedAdminOverview> {
  const [stats, pendingListings, pendingVerifications, openReports] =
    await Promise.all([
      getAdminDashboardStats(),
      fetchPendingApprovals(),
      fetchPendingVerificationRequests(),
      getOpenReports(),
    ]);

  return {
    stats,
    recentPendingListings: pendingListings.slice(0, 5),
    recentVerifications: pendingVerifications.slice(0, 5),
    recentReports: openReports.slice(0, 5),
  };
}

/**
 * Subscribes in real time to pending listings (across all 4 modules),
 * pending student verifications, and open reports for the Admin Alert Banner.
 */
export function subscribeToAdminAlertCounts(
  onUpdate: (counts: AdminAlertCounts) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) {
    onUpdate({ pendingListings: 0, pendingVerifications: 0, openReports: 0 });
    return () => {};
  }

  let pendingProducts = 0;
  let pendingAccommodations = 0;
  let pendingRoommates = 0;
  let pendingStores = 0;
  let pendingVerifications = 0;
  let openReports = 0;

  const emit = () => {
    onUpdate({
      pendingListings:
        pendingProducts +
        pendingAccommodations +
        pendingRoommates +
        pendingStores,
      pendingVerifications,
      openReports,
    });
  };

  const handleErr = (err: unknown) => {
    if (onError) {
      onError(mapAdminError(err, 'Unable to sync real-time admin alerts.'));
    }
  };

  const unsubProducts = onSnapshot(
    query(collection(db, 'products'), where('isApproved', '==', false)),
    (snap) => {
      pendingProducts = snap.size;
      emit();
    },
    handleErr
  );

  const unsubAccommodations = onSnapshot(
    query(collection(db, 'accommodations'), where('isApproved', '==', false)),
    (snap) => {
      pendingAccommodations = snap.size;
      emit();
    },
    handleErr
  );

  const unsubRoommates = onSnapshot(
    query(collection(db, 'roommate_requests'), where('isApproved', '==', false)),
    (snap) => {
      pendingRoommates = snap.size;
      emit();
    },
    handleErr
  );

  const unsubStores = onSnapshot(
    query(collection(db, 'stores'), where('isApproved', '==', false)),
    (snap) => {
      pendingStores = snap.size;
      emit();
    },
    handleErr
  );

  const unsubVerifications = onSnapshot(
    query(collection(db, 'verification_requests'), where('status', '==', 'pending')),
    (snap) => {
      pendingVerifications = snap.size;
      emit();
    },
    handleErr
  );

  const unsubReports = onSnapshot(
    query(collection(db, 'reports'), where('status', '==', 'open')),
    (snap) => {
      openReports = snap.size;
      emit();
    },
    handleErr
  );

  return () => {
    unsubProducts();
    unsubAccommodations();
    unsubRoommates();
    unsubStores();
    unsubVerifications();
    unsubReports();
  };
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
    invalidateFastCachePrefix('home_');
    invalidateFastCachePrefix('mkt_');
    invalidateFastCachePrefix('services_');
    invalidateFastCachePrefix('accommodations_');
    invalidateFastCachePrefix('roommates_');
    invalidateFastCachePrefix('approved_stores');
    invalidateFastCachePrefix('admin_stats');
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
    invalidateFastCachePrefix('home_');
    invalidateFastCachePrefix('admin_stats');
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

export async function bulkApprovePendingItems(items: PendingAdminItem[]): Promise<{
  succeeded: PendingAdminItem[];
  failedCount: number;
}> {
  const succeeded: PendingAdminItem[] = [];
  let failedCount = 0;

  for (const item of items) {
    try {
      await approvePendingItem(item);
      succeeded.push(item);
    } catch {
      failedCount += 1;
    }
  }

  return { succeeded, failedCount };
}

export async function bulkRejectPendingItems(items: PendingAdminItem[]): Promise<{
  succeeded: PendingAdminItem[];
  failedCount: number;
}> {
  const succeeded: PendingAdminItem[] = [];
  let failedCount = 0;

  for (const item of items) {
    try {
      await rejectPendingItem(item);
      succeeded.push(item);
    } catch {
      failedCount += 1;
    }
  }

  return { succeeded, failedCount };
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
 * Admin: Switches a user's accountType ('student' <-> 'business' / Marketer)
 * and propagates the corrected accountType across their listings, stores, and verification requests.
 */
export async function updateUserAccountTypeAdmin(
  uid: string,
  nextAccountType: AccountType
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }
  const cleanUid = uid.trim();
  if (!cleanUid) {
    throw new Error('User ID is missing.');
  }

  try {
    const firestore = db;
    const userRef = doc(firestore, 'users', cleanUid);
    const userUpdates: Record<string, unknown> = {
      accountType: nextAccountType,
      updatedAt: serverTimestamp(),
    };
    if (nextAccountType === 'student') {
      userUpdates['roles.landlord'] = deleteField();
      userUpdates.businessName = deleteField();
      userUpdates.shopAddress = deleteField();
      userUpdates.isOnlineOnly = deleteField();
    }
    await updateDoc(userRef, userUpdates);

    // Best-effort propagate accountType across user's listing snapshots & verification requests
    try {
      const snapshotTargets: Array<{
        collectionName: string;
        ownerField: string;
        updateField: string;
      }> = [
        {
          collectionName: 'products',
          ownerField: 'sellerId',
          updateField: 'sellerSnapshot.accountType',
        },
        {
          collectionName: 'accommodations',
          ownerField: 'ownerId',
          updateField: 'ownerSnapshot.accountType',
        },
        {
          collectionName: 'roommate_requests',
          ownerField: 'userId',
          updateField: 'userSnapshot.accountType',
        },
        {
          collectionName: 'stores',
          ownerField: 'ownerId',
          updateField: 'ownerSnapshot.accountType',
        },
        {
          collectionName: 'verification_requests',
          ownerField: 'userId',
          updateField: 'accountType',
        },
      ];

      const batch = writeBatch(firestore);
      let count = 0;

      for (const target of snapshotTargets) {
        const snap = await getDocs(
          query(
            collection(firestore, target.collectionName),
            where(target.ownerField, '==', cleanUid)
          )
        );
        snap.docs.forEach((docSnap) => {
          batch.update(docSnap.ref, { [target.updateField]: nextAccountType });
          count += 1;
        });
      }

      if (count > 0) {
        await batch.commit();
      }
    } catch (syncErr) {
      console.warn('Could not sync accountType across existing listings:', syncErr);
    }

    invalidateFastCache('admin_users');
    invalidateFastCache('admin_stats');
    invalidateFastCache('admin_overview');
    invalidateFastCachePrefix('home_');
    invalidateFastCachePrefix('mkt_');
    invalidateFastCachePrefix('services_');
    invalidateFastCachePrefix('seller_profile:');
  } catch (err) {
    throw mapAdminError(err, 'Failed to update user account type.');
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
