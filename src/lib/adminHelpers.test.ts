import assert from 'node:assert/strict';
import test from 'node:test';
import {
  areAllVisibleSelected,
  buildAdminBellAlerts,
  extractListingOwnerId,
  filterAdminUsers,
  filterPendingAdminItems,
  filterVerificationRequestsByAccountType,
  getAdminAlertTotal,
  getAdminModuleLabel,
  getAdminReportTargetCollection,
  getAdminUserFilterUrl,
  getPrimaryUserRoleBadge,
  getReportListingRoute,
  hasAnyAdminAlerts,
  isAuthorizedAdminEmail,
  isAuthorizedAdminSession,
  isUserAdmin,
  mapAccommodationToPendingAdminItem,
  mapProductToPendingAdminItem,
  mapRoommateToPendingAdminItem,
  mapStoreToPendingAdminItem,
  PRIMARY_ADMIN_EMAIL,
  sortPendingAdminItems,
  toggleBulkSelectionKey,
  toggleSelectAllVisibleKeys,
} from './adminHelpers';
import {
  accommodationToUnifiedSellerListing,
  calculateUnifiedSellerStats,
  filterUnifiedSellerListingsByTab,
  getUnifiedStatusBadge,
  roommateToUnifiedSellerListing,
  storeToUnifiedSellerListing,
} from './sellerHelpers';
import { UserProfile, VerificationRequest } from '../types';

test('isUserAdmin recognizes roles.admin or admin custom claim and rejects normal users', () => {
  assert.equal(isUserAdmin({ roles: { buyer: true, seller: true } }, false), false);
  assert.equal(isUserAdmin(null, false), false);
  assert.equal(isUserAdmin({ roles: { admin: true } }, false), true);
  assert.equal(isUserAdmin({ roles: { buyer: true } }, true), true);
});

test('isAuthorizedAdminSession allows only verified primary admin email', () => {
  assert.equal(isAuthorizedAdminEmail(PRIMARY_ADMIN_EMAIL), true);
  assert.equal(isAuthorizedAdminEmail('  AWOYINFASOLOMON1@gmail.com '), true);
  assert.equal(isAuthorizedAdminEmail('hacker@gmail.com'), false);
  assert.equal(
    isAuthorizedAdminSession({
      email: PRIMARY_ADMIN_EMAIL,
      emailVerified: true,
    }),
    true
  );
  assert.equal(
    isAuthorizedAdminSession({
      email: PRIMARY_ADMIN_EMAIL,
      emailVerified: false,
    }),
    false
  );
  assert.equal(
    isAuthorizedAdminSession({
      email: 'other@lasued.edu.ng',
      emailVerified: true,
    }),
    false
  );
  assert.equal(isAuthorizedAdminSession(null), false);
});

test('admin pending queue mappers normalize all 4 modules cleanly', () => {
  const itemPending = mapProductToPendingAdminItem({
    id: 'p1',
    sellerId: 'u1',
    adType: 'item',
    title: 'HP EliteBook',
    description: 'Clean laptop',
    categoryId: 'electronics',
    subcategory: 'Laptops & Computers',
    images: [],
    priceType: 'fixed',
    price: 120000,
    quantity: 1,
    whatsappNumber: '2348012345678',
    locationName: 'LASUED Gate',
    status: 'active',
    isApproved: false,
    isActive: true,
    createdAt: 100,
  });
  const servicePending = mapProductToPendingAdminItem({
    id: 'p2',
    sellerId: 'u1',
    adType: 'service',
    title: 'Barbing Service',
    description: 'Clean fade',
    categoryId: 'beauty',
    subcategory: 'Barbing',
    images: [],
    priceType: 'contact',
    whatsappNumber: '2348012345678',
    locationName: 'Hostel Road',
    status: 'active',
    isApproved: false,
    isActive: true,
    needsAiReview: true,
    createdAt: 200,
  });
  assert.equal(servicePending.needsAiReview, true);
  assert.equal(itemPending.needsAiReview, false);
  const roomPending = mapAccommodationToPendingAdminItem({
    id: 'a1',
    ownerId: 'u2',
    type: 'self_contain',
    title: 'Self Contain Epe',
    description: 'Tiled room',
    rentPrice: 220000,
    generalLocation: 'Igbogbo, Epe',
    amenities: ['Water'],
    images: [],
    whatsappNumber: '2348023456789',
    isApproved: false,
    isActive: true,
    createdAt: 300,
  });
  const roommatePending = mapRoommateToPendingAdminItem({
    id: 'r1',
    userId: 'u3',
    type: 'need_roommate',
    title: 'Need Female Roommate',
    description: 'Split rent',
    budget: 90000,
    generalLocation: 'Near Gate',
    preferences: 'Female, quiet',
    images: ['data:image/png;base64,AAA'],
    whatsappNumber: '2348034567890',
    isApproved: false,
    isActive: true,
    createdAt: 400,
  });
  const storePending = mapStoreToPendingAdminItem({
    id: 's1',
    ownerId: 'u4',
    name: 'Campus Gadgets',
    description: 'Accessories store',
    category: 'Electronics & Gadgets',
    whatsappNumber: '2348045678901',
    locationName: 'Arcade',
    isApproved: false,
    isActive: true,
    createdAt: 500,
  });

  const all = sortPendingAdminItems([
    itemPending,
    servicePending,
    roomPending,
    roommatePending,
    storePending,
  ]);

  assert.deepEqual(
    all.map((x) => `${x._type}:${x.id}`),
    ['store:s1', 'roommate:r1', 'room:a1', 'service:p2', 'item:p1']
  );
  assert.equal(getAdminModuleLabel('room'), 'Room');
  assert.equal(filterPendingAdminItems(all, 'store').length, 1);
  assert.equal(filterPendingAdminItems(all, 'all').length, 5);
});

test('getAdminReportTargetCollection resolves all report target types cleanly', () => {
  assert.equal(getAdminReportTargetCollection('product'), 'products');
  assert.equal(getAdminReportTargetCollection('service'), 'services');
  assert.equal(getAdminReportTargetCollection('accommodation'), 'accommodations');
  assert.equal(getAdminReportTargetCollection('roommate_request'), 'roommate_requests');
  assert.equal(getAdminReportTargetCollection('store'), 'stores');
  assert.equal(getAdminReportTargetCollection('user'), null);
});

test('filterAdminUsers filters by query and accountType and detects Marketer vs Student Seller badges', () => {
  const users: UserProfile[] = [
    {
      uid: '1',
      email: 'ada@lasued.edu.ng',
      fullName: 'Ada Obi',
      phone: '0801 234 5678',
      campus: 'LASUED',
      department: 'Computer Science',
      accountType: 'student',
      roles: { buyer: true, admin: true },
      isVerified: true,
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      uid: '2',
      email: 'tunde@lasu.edu.ng',
      fullName: 'Tunde Bello',
      phone: '08098765432',
      campus: 'LASU',
      department: 'Economics',
      accountType: 'business',
      businessName: 'Bello Campus Gadgets',
      shopAddress: 'Shop 7, LASUED Gate',
      roles: { buyer: true, landlord: true },
      isVerified: false,
      status: 'suspended',
      createdAt: 2,
      updatedAt: 2,
    },
    {
      uid: '3',
      email: 'chioma@lasued.edu.ng',
      fullName: 'Chioma Eze',
      phone: '08055554444',
      campus: 'LASUED',
      department: 'Biology',
      accountType: 'student',
      roles: { buyer: true, seller: true },
      isVerified: true,
      status: 'active',
      createdAt: 3,
      updatedAt: 3,
    },
  ];

  assert.equal(filterAdminUsers(users, 'ada').length, 1);
  assert.equal(filterAdminUsers(users, 'economics').length, 1);
  assert.equal(filterAdminUsers(users, '08012345678').length, 1);
  assert.equal(filterAdminUsers(users, '0809876').length, 1);
  assert.equal(filterAdminUsers(users, 'lasu').length, 3);
  assert.equal(filterAdminUsers(users, 'lasued').length, 3); // campus 'LASUED' or shopAddress 'LASUED Gate'
  assert.equal(filterAdminUsers(users, 'bello campus').length, 1);
  assert.equal(filterAdminUsers(users, 'shop 7').length, 1);
  assert.equal(filterAdminUsers(users, '2').length, 2); // uid '2' and phone '08098765432'
  assert.equal(filterAdminUsers(users, 'tunde@lasu').length, 1);

  assert.equal(filterAdminUsers(users, '', 'all').length, 3);
  assert.equal(filterAdminUsers(users, '', 'student').length, 2);
  assert.equal(filterAdminUsers(users, '', 'business').length, 1);

  assert.equal(getPrimaryUserRoleBadge(users[0]), 'Admin');
  assert.equal(getPrimaryUserRoleBadge(users[1]), 'Marketer');
  assert.equal(getPrimaryUserRoleBadge(users[2]), 'Student Seller');
});

test('filterVerificationRequestsByAccountType separates Student and Marketer verification requests', () => {
  const requests: VerificationRequest[] = [
    {
      id: 'v1',
      userId: 'u1',
      fullName: 'Student Ada',
      accountType: 'student',
      documentType: 'Student ID Card',
      idCardImage: 'data:image/jpeg;base64,AAA',
      status: 'pending',
      createdAt: 100,
    },
    {
      id: 'v2',
      userId: 'u2',
      fullName: 'Marketer Tunde',
      accountType: 'business',
      documentType: 'NIN Slip / Card',
      idCardImage: 'data:image/jpeg;base64,BBB',
      status: 'pending',
      createdAt: 200,
    },
  ];

  assert.equal(filterVerificationRequestsByAccountType(requests, 'all').length, 2);
  assert.equal(filterVerificationRequestsByAccountType(requests, 'student').length, 1);
  assert.equal(filterVerificationRequestsByAccountType(requests, 'student')[0].id, 'v1');
  assert.equal(filterVerificationRequestsByAccountType(requests, 'business').length, 1);
  assert.equal(filterVerificationRequestsByAccountType(requests, 'business')[0].id, 'v2');
});

test('hasAnyAdminAlerts and bulk selection helpers behave deterministically', () => {
  assert.equal(
    hasAnyAdminAlerts({ pendingListings: 0, pendingVerifications: 0, openReports: 0 }),
    false
  );
  assert.equal(
    hasAnyAdminAlerts({ pendingListings: 2, pendingVerifications: 0, openReports: 0 }),
    true
  );
  assert.equal(
    hasAnyAdminAlerts({ pendingListings: 0, pendingVerifications: 1, openReports: 0 }),
    true
  );
  assert.equal(
    hasAnyAdminAlerts({ pendingListings: 0, pendingVerifications: 0, openReports: 3 }),
    true
  );

  let selected: string[] = [];
  selected = toggleBulkSelectionKey(selected, 'a');
  assert.deepEqual(selected, ['a']);
  selected = toggleBulkSelectionKey(selected, 'b');
  assert.equal(areAllVisibleSelected(selected, ['a', 'b']), true);
  selected = toggleSelectAllVisibleKeys(selected, ['a', 'b']);
  assert.deepEqual(selected, []);
  selected = toggleSelectAllVisibleKeys(['x'], ['a', 'b']);
  assert.deepEqual(selected, ['x', 'a', 'b']);
  selected = toggleSelectAllVisibleKeys(selected, ['a', 'b']);
  assert.deepEqual(selected, ['x']);
});

test('extractListingOwnerId, getReportListingRoute, and getAdminUserFilterUrl resolve moderation targets', () => {
  assert.equal(
    extractListingOwnerId('product', 'p-1', { sellerId: 'u-seller' }),
    'u-seller'
  );
  assert.equal(
    extractListingOwnerId('service', 's-1', { providerId: 'u-provider' }),
    'u-provider'
  );
  assert.equal(
    extractListingOwnerId('accommodation', 'a-1', { ownerId: 'u-landlord' }),
    'u-landlord'
  );
  assert.equal(
    extractListingOwnerId('roommate_request', 'r-1', { userId: 'u-student' }),
    'u-student'
  );
  assert.equal(
    extractListingOwnerId('store', 'st-1', { ownerId: 'u-store' }),
    'u-store'
  );
  assert.equal(extractListingOwnerId('user', 'u-reported', null), 'u-reported');
  assert.equal(extractListingOwnerId('product', 'p-missing', null), null);

  assert.equal(getReportListingRoute('product', 'p-1'), '/marketplace/p-1');
  assert.equal(getReportListingRoute('service', 's-1'), '/marketplace/s-1');
  assert.equal(
    getReportListingRoute('accommodation', 'a-1'),
    '/accommodation/a-1'
  );
  assert.equal(
    getReportListingRoute('roommate_request', 'r-1'),
    '/roommates'
  );
  assert.equal(
    getReportListingRoute('store', 'st-1', { name: 'Plug Store' }),
    '/marketplace?tab=stores&q=Plug%20Store'
  );
  assert.equal(getReportListingRoute('user', 'u-1'), null);

  assert.equal(getAdminUserFilterUrl('ada@lasued.edu.ng'), '/admin/users?q=ada%40lasued.edu.ng');
  assert.equal(getAdminUserFilterUrl(''), '/admin/users');
});

test('unified seller dashboard helpers combine accommodations, roommates, and stores with status badges', () => {
  const acc = accommodationToUnifiedSellerListing({
    id: 'acc-1',
    title: 'Self Contain',
    rentPrice: 200000,
    generalLocation: 'Epe',
    isApproved: true,
    isActive: true,
    createdAt: 100,
  });
  const roomie = roommateToUnifiedSellerListing({
    id: 'rm-1',
    title: 'Need Roommate',
    generalLocation: 'Gate',
    isApproved: false,
    isActive: true,
    createdAt: 200,
  });
  const store = storeToUnifiedSellerListing({
    id: 'st-1',
    name: 'Plug Store',
    category: 'Fashion',
    locationName: 'Gate',
    isApproved: false,
    isActive: true,
    createdAt: 300,
  });

  const all = [acc, roomie, store];
  const stats = calculateUnifiedSellerStats(all);
  assert.equal(stats.totalListings, 3);
  assert.equal(stats.pendingApproval, 2);
  assert.equal(getUnifiedStatusBadge(store).label, 'Pending Approval');
  assert.equal(getUnifiedStatusBadge(acc).label, 'Active');
  assert.equal(filterUnifiedSellerListingsByTab(all, 'pending').length, 2);
  assert.equal(filterUnifiedSellerListingsByTab(all, 'active').length, 1);
});

test('filterAdminUsers, getPrimaryUserRoleBadge, and filterVerificationRequestsByAccountType detect legacy marketers', () => {
  const users: UserProfile[] = [
    {
      uid: 'leg-1',
      email: 'legacy1@example.com',
      fullName: 'Kemi Ade',
      accountType: 'student',
      businessName: 'Kemi Hair Studio',
      roles: { buyer: true, seller: true },
      isVerified: false,
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      uid: 'leg-2',
      email: 'legacy2@example.com',
      fullName: 'Seyi Alabi',
      roles: { buyer: true, landlord: true },
      isVerified: true,
      status: 'active',
      createdAt: 2,
      updatedAt: 2,
    },
    {
      uid: 'stu-1',
      email: 'stu1@lasued.edu.ng',
      fullName: 'Bola Musa',
      accountType: 'student',
      roles: { buyer: true, seller: true },
      isVerified: true,
      status: 'active',
      createdAt: 3,
      updatedAt: 3,
    },
  ];

  assert.equal(filterAdminUsers(users, '', 'business').length, 2);
  assert.equal(filterAdminUsers(users, '', 'student').length, 1);
  assert.equal(getPrimaryUserRoleBadge(users[0]), 'Marketer');
  assert.equal(getPrimaryUserRoleBadge(users[1]), 'Marketer');
  assert.equal(getPrimaryUserRoleBadge(users[2]), 'Student Seller');

  const requests: VerificationRequest[] = [
    {
      id: 'vr-1',
      userId: 'leg-1',
      fullName: 'Kemi Ade',
      accountType: 'student',
      businessName: 'Kemi Hair Studio',
      documentType: 'NIN Slip / Card',
      idCardImage: 'data:image/jpeg;base64,AAA',
      status: 'pending',
      createdAt: 100,
    },
    {
      id: 'vr-2',
      userId: 'stu-1',
      fullName: 'Bola Musa',
      accountType: 'student',
      documentType: 'Student ID Card',
      idCardImage: 'data:image/jpeg;base64,BBB',
      status: 'pending',
      createdAt: 200,
    },
  ];

  assert.equal(filterVerificationRequestsByAccountType(requests, 'business').length, 1);
  assert.equal(filterVerificationRequestsByAccountType(requests, 'business')[0].id, 'vr-1');
  assert.equal(filterVerificationRequestsByAccountType(requests, 'student').length, 1);
  assert.equal(filterVerificationRequestsByAccountType(requests, 'student')[0].id, 'vr-2');
});

test('getAdminAlertTotal and buildAdminBellAlerts aggregate and format admin moderation alerts', () => {
  assert.equal(
    getAdminAlertTotal({ pendingListings: 3, pendingVerifications: 2, openReports: 1 }),
    6
  );
  assert.equal(
    getAdminAlertTotal({ pendingListings: -2, pendingVerifications: 0, openReports: 4 }),
    4
  );

  assert.deepEqual(
    buildAdminBellAlerts({ pendingListings: 0, pendingVerifications: 0, openReports: 0 }),
    []
  );

  const alerts = buildAdminBellAlerts({
    pendingListings: 1,
    pendingVerifications: 2,
    openReports: 1,
  });
  assert.equal(alerts.length, 3);
  assert.deepEqual(
    alerts.map((a) => ({ id: a.id, count: a.count, to: a.to, tone: a.tone })),
    [
      { id: 'listings', count: 1, to: '/admin/listings', tone: 'amber' },
      { id: 'verifications', count: 2, to: '/admin/verifications', tone: 'indigo' },
      { id: 'reports', count: 1, to: '/admin/reports', tone: 'red' },
    ]
  );
  assert.equal(alerts[0].subtitle, '1 listing awaiting approval');
  assert.equal(alerts[1].subtitle, '2 submissions to verify');
  assert.equal(alerts[2].subtitle, '1 report needs moderation');
});

