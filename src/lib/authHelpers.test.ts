import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areMarketerProfileFieldsLocked,
  BANNED_ACCOUNT_MESSAGE,
  buildNewUserProfile,
  calculateProfileCompletion,
  canSwitchAccountTypeOnProfile,
  checkProfileCompleteness,
  formatFirebaseAuthError,
  getAccountTypeLabel,
  getFieldCooldownStatus,
  getInitials,
  getPrimaryRoleLabel,
  getProfilePicLockStatus,
  getProtectedRouteDecision,
  getUserAvatarUrl,
  isAcademicFieldLocked,
  isAccountBanned,
  isAccountSuspended,
  isMarketerProfile,
  parseOpeningHoursRange,
  PHONE_UPDATE_COOLDOWN_DAYS,
  PROFILE_PIC_COOLDOWN_DAYS,
  resolveAccountType,
  resolvePostLoginRedirect,
  shouldAutoApproveListing,
  SUSPENDED_ACCOUNT_MESSAGE,
  validateEmailField,
  validateLoginForm,
  validateSignupForm,
} from './authHelpers';

test('buildNewUserProfile sets safe unprivileged defaults', () => {
  const ts = { seconds: 100 };
  const profile = buildNewUserProfile({
    uid: 'user-123',
    email: ' Student@LASUED.edu.ng ',
    fullName: ' Ada Okafor ',
    timestamp: ts,
  });

  assert.equal(profile.uid, 'user-123');
  assert.equal(profile.email, 'student@lasued.edu.ng');
  assert.equal(profile.fullName, 'Ada Okafor');
  assert.equal(profile.accountType, 'student');
  assert.equal(profile.trustScore, 0);
  assert.equal(profile.reviewCount, 0);
  assert.equal(profile.isVerified, false);
  assert.equal(profile.emailVerified, false);
  assert.equal(profile.status, 'active');
  assert.equal(profile.roles.buyer, true);
  assert.equal(profile.roles.admin, undefined);

  const bizProfile = buildNewUserProfile({
    uid: 'biz-123',
    email: 'shop@lasuedplug.com',
    fullName: 'Tunde Bello',
    accountType: 'business',
    timestamp: ts,
  });
  assert.equal(bizProfile.accountType, 'business');
  assert.equal(bizProfile.trustScore, 0);
  assert.equal(bizProfile.reviewCount, 0);
});

test('getProtectedRouteDecision returns loading, redirect, or allow correctly', () => {
  assert.equal(
    getProtectedRouteDecision({ loading: true, isAuthenticated: false }),
    'loading'
  );
  assert.equal(
    getProtectedRouteDecision({ loading: false, isAuthenticated: false }),
    'redirect'
  );
  assert.equal(
    getProtectedRouteDecision({
      loading: false,
      isAuthenticated: true,
      isSuspended: true,
    }),
    'redirect'
  );
  assert.equal(
    getProtectedRouteDecision({
      loading: false,
      isAuthenticated: true,
      isSuspended: false,
    }),
    'allow'
  );
  assert.equal(
    getProtectedRouteDecision({ loading: false, isAuthenticated: true }),
    'allow'
  );
  assert.equal(
    getProtectedRouteDecision({
      loading: false,
      isAuthenticated: true,
      requireEmailVerified: true,
      isEmailVerified: false,
    }),
    'verify-email'
  );
  assert.equal(
    getProtectedRouteDecision({
      loading: false,
      isAuthenticated: true,
      requireEmailVerified: true,
      isEmailVerified: true,
    }),
    'allow'
  );
});

test('isAccountSuspended and isAccountBanned detect suspended/banned states and preserve exact messages', () => {
  assert.equal(isAccountSuspended(null), false);
  assert.equal(isAccountSuspended({ status: 'active', isBanned: false }), false);
  assert.equal(isAccountSuspended({ status: 'suspended', isBanned: false }), true);
  assert.equal(isAccountSuspended({ status: 'active', isBanned: true }), true);
  assert.equal(isAccountBanned(null), false);
  assert.equal(isAccountBanned({ isBanned: false }), false);
  assert.equal(isAccountBanned({ isBanned: true }), true);
  assert.equal(
    SUSPENDED_ACCOUNT_MESSAGE,
    'Your account has been suspended. Contact Support on WhatsApp.'
  );
  assert.ok(BANNED_ACCOUNT_MESSAGE.includes('permanently banned'));
});

test('validateSignupForm enforces required fields, email, password length, and matching passwords', () => {
  const emptyErrors = validateSignupForm({
    fullName: '',
    email: 'bad-email',
    password: '123',
    confirmPassword: '456',
  });
  assert.ok(emptyErrors.fullName);
  assert.ok(emptyErrors.email);
  assert.ok(emptyErrors.password);
  assert.ok(emptyErrors.confirmPassword);

  const validErrors = validateSignupForm({
    fullName: 'Solomon Awoyinfa',
    email: 'solomon@lasuedplug.com',
    password: 'password123',
    confirmPassword: 'password123',
  });
  assert.deepEqual(validErrors, {});
});

test('validateLoginForm and validateEmailField validate inputs accurately', () => {
  const loginErr = validateLoginForm({ email: '', password: '' });
  assert.ok(loginErr.email);
  assert.ok(loginErr.password);
  assert.deepEqual(
    validateLoginForm({ email: 'test@lasued.edu.ng', password: 'secret' }),
    {}
  );
  assert.ok(validateEmailField('not-an-email'));
  assert.equal(validateEmailField('user@lasued.edu.ng'), undefined);
});

test('getInitials and getPrimaryRoleLabel compute clean display values', () => {
  assert.equal(getInitials('Ada Okafor', 'ada@test.com'), 'AO');
  assert.equal(getInitials('Solomon', 'sol@test.com'), 'SO');
  assert.equal(getInitials('', 'solomon@test.com'), 'S');
  assert.equal(getPrimaryRoleLabel({ buyer: true }), 'Buyer');
  assert.equal(getPrimaryRoleLabel({ buyer: true, seller: true }), 'Seller');
  assert.equal(getPrimaryRoleLabel({ buyer: true, admin: true }), 'Admin');
  assert.equal(getPrimaryRoleLabel({ buyer: true }, 'business'), 'Marketer');
  assert.equal(getPrimaryRoleLabel({ buyer: true, landlord: true }), 'Marketer');
  assert.equal(getAccountTypeLabel('student'), 'Student');
  assert.equal(getAccountTypeLabel('business'), 'Marketer');
});

test('parseOpeningHoursRange converts 12h and 24h strings into 24h time picker values', () => {
  assert.deepEqual(parseOpeningHoursRange('8:00 AM - 6:00 PM'), {
    start: '08:00',
    end: '18:00',
  });
  assert.deepEqual(parseOpeningHoursRange('08:30 - 17:45'), {
    start: '08:30',
    end: '17:45',
  });
  assert.deepEqual(parseOpeningHoursRange(''), { start: '', end: '' });
});

test('formatFirebaseAuthError maps Firebase error codes cleanly', () => {
  assert.equal(
    formatFirebaseAuthError({ code: 'auth/email-already-in-use' }),
    'An account with this email already exists.'
  );
  assert.equal(
    formatFirebaseAuthError({ code: 'auth/invalid-credential' }),
    'Invalid email or password. Please check your credentials and try again.'
  );
  assert.equal(
    formatFirebaseAuthError({ code: 'unavailable' }),
    'Could not reach the database right now. Please check your internet connection and try again.'
  );
});

test('checkProfileCompleteness returns true only when all 5 required profile fields are filled', () => {
  assert.equal(checkProfileCompleteness(null), false);
  assert.equal(
    checkProfileCompleteness({
      fullName: 'Ada Okafor',
      phone: '08012345678',
      campus: 'LASUED',
      department: 'Computer Science Education',
    }),
    false
  );
  assert.equal(
    checkProfileCompleteness({
      fullName: 'Ada Okafor',
      phone: '08012345678',
      campus: 'LASUED',
      department: 'Computer Science Education',
      level: '200L',
    }),
    true
  );

  // Marketer accounts require fullName, phone, businessName; online-only marketers are exempt from opening hours & address
  assert.equal(
    checkProfileCompleteness({
      accountType: 'business',
      fullName: 'Tunde Bello',
      phone: '08012345678',
    }),
    false
  );
  // Online-only marketer with businessName -> complete even without opening hours or address
  assert.equal(
    checkProfileCompleteness({
      accountType: 'business',
      fullName: 'Tunde Bello',
      phone: '08012345678',
      businessName: 'Tunde Gadgets & Repairs',
      isOnlineOnly: true,
    }),
    true
  );
  // Physical shop missing opening hours -> incomplete even with shopAddress + GPS
  assert.equal(
    checkProfileCompleteness({
      accountType: 'business',
      fullName: 'Tunde Bello',
      phone: '08012345678',
      businessName: 'Tunde Gadgets & Repairs',
      isOnlineOnly: false,
      shopAddress: 'Shop 4, Main Gate',
      latitude: 6.5812,
      longitude: 3.9821,
    }),
    false
  );
  // Physical shop missing shopAddress or GPS -> incomplete
  assert.equal(
    checkProfileCompleteness({
      accountType: 'business',
      fullName: 'Tunde Bello',
      phone: '08012345678',
      businessName: 'Tunde Gadgets & Repairs',
      openingTimeStart: '08:00',
      openingTimeEnd: '18:00',
      isOnlineOnly: false,
      shopAddress: 'Shop 4, Main Gate',
    }),
    false
  );
  // Physical shop marketer with address + GPS + opening hours -> complete
  assert.equal(
    checkProfileCompleteness({
      accountType: 'business',
      fullName: 'Tunde Bello',
      phone: '08012345678',
      businessName: 'Tunde Gadgets & Repairs',
      openingTimeStart: '08:00',
      openingTimeEnd: '18:00',
      isOnlineOnly: false,
      shopAddress: 'Shop 4, LASUED Main Gate',
      latitude: 6.5812,
      longitude: 3.9821,
    }),
    true
  );
});

test('isAcademicFieldLocked and getFieldCooldownStatus enforce permanent lock and 7-day phone lock', () => {
  assert.equal(isAcademicFieldLocked(undefined), false);
  assert.equal(isAcademicFieldLocked('   '), false);
  assert.equal(isAcademicFieldLocked('LASUED'), true);

  const dayMs = 24 * 60 * 60 * 1000;
  const baseMs = Date.UTC(2026, 0, 1);

  const neverUpdated = getFieldCooldownStatus(
    null,
    PHONE_UPDATE_COOLDOWN_DAYS,
    baseMs
  );
  assert.equal(neverUpdated.isLocked, false);

  const phoneLocked = getFieldCooldownStatus(
    { seconds: Math.floor(baseMs / 1000) },
    PHONE_UPDATE_COOLDOWN_DAYS,
    baseMs + 2 * dayMs
  );
  assert.equal(phoneLocked.isLocked, true);
  assert.equal(phoneLocked.remainingDays, 5);

  const phoneUnlocked = getFieldCooldownStatus(
    { seconds: Math.floor(baseMs / 1000) },
    PHONE_UPDATE_COOLDOWN_DAYS,
    baseMs + 7 * dayMs
  );
  assert.equal(phoneUnlocked.isLocked, false);
});

test('getUserAvatarUrl prioritizes profilePic over avatarUrl', () => {
  assert.equal(getUserAvatarUrl(null), '');
  assert.equal(
    getUserAvatarUrl({ avatarUrl: 'https://example.com/old.jpg' }),
    'https://example.com/old.jpg'
  );
  assert.equal(
    getUserAvatarUrl({
      profilePic: 'data:image/jpeg;base64,NEW',
      avatarUrl: 'https://example.com/old.jpg',
    }),
    'data:image/jpeg;base64,NEW'
  );
});

test('getProfilePicLockStatus enforces 7-day DP lock and constructs lock message', () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const baseMs = Date.UTC(2026, 2, 10, 12, 0, 0);

  const neverSet = getProfilePicLockStatus(null, baseMs);
  assert.equal(neverSet.isLocked, false);
  assert.equal(neverSet.lockMessage, null);

  const locked = getProfilePicLockStatus(
    { seconds: Math.floor(baseMs / 1000) },
    baseMs + 3 * dayMs
  );
  assert.equal(locked.isLocked, true);
  assert.equal(locked.remainingDays, PROFILE_PIC_COOLDOWN_DAYS - 3);
  assert.ok(locked.lockMessage);
  assert.ok(
    locked.lockMessage.startsWith(
      '🔒 Profile picture locked. You can change it again on '
    )
  );

  const unlocked = getProfilePicLockStatus(
    { seconds: Math.floor(baseMs / 1000) },
    baseMs + PROFILE_PIC_COOLDOWN_DAYS * dayMs
  );
  assert.equal(unlocked.isLocked, false);
  assert.equal(unlocked.lockMessage, null);
});

test('isMarketerProfile, resolveAccountType, and canSwitchAccountTypeOnProfile detect legacy marketers and enforce switch locks', () => {
  assert.equal(isMarketerProfile(null), false);
  assert.equal(isMarketerProfile({ accountType: 'business' }), true);
  assert.equal(isMarketerProfile({ accountType: 'marketer' }), true);
  assert.equal(
    isMarketerProfile({ accountType: 'student', roles: { landlord: true } }),
    true
  );
  assert.equal(
    isMarketerProfile({ accountType: 'student', businessName: 'Plug Gadgets' }),
    true
  );
  assert.equal(
    isMarketerProfile({ shopAddress: 'Shop 2, Epe Main Gate' }),
    true
  );
  assert.equal(
    isMarketerProfile({ accountType: 'student', isOnlineOnly: true }),
    true
  );
  assert.equal(
    isMarketerProfile({ accountType: 'student', roles: { buyer: true, seller: true } }),
    false
  );

  assert.equal(resolveAccountType({ accountType: 'marketer' }), 'business');
  assert.equal(resolveAccountType({ businessName: 'Campus Kicks' }), 'business');
  assert.equal(resolveAccountType({ accountType: 'student' }), 'student');

  assert.equal(canSwitchAccountTypeOnProfile(null), false);
  assert.equal(
    canSwitchAccountTypeOnProfile({ accountType: 'student', isVerified: false }),
    false
  );
  assert.equal(
    canSwitchAccountTypeOnProfile({ accountType: 'student', isVerified: true }),
    false
  );
  assert.equal(
    canSwitchAccountTypeOnProfile({ accountType: 'student', campus: 'LASUED' }),
    false
  );
  assert.equal(
    canSwitchAccountTypeOnProfile({
      accountType: 'business',
      department: 'Computer Science',
    }),
    false
  );
  assert.equal(
    canSwitchAccountTypeOnProfile({ accountType: 'business', level: '200L' }),
    false
  );

  // Marketer profile fields lock permanently once businessName is saved
  assert.equal(areMarketerProfileFieldsLocked(null), false);
  assert.equal(
    areMarketerProfileFieldsLocked({
      accountType: 'student',
      fullName: 'Ada Okafor',
      campus: 'LASUED',
    }),
    false
  );
  assert.equal(
    areMarketerProfileFieldsLocked({
      accountType: 'business',
      fullName: 'Tunde Bello',
    }),
    false
  );
  assert.equal(
    areMarketerProfileFieldsLocked({
      accountType: 'business',
      fullName: 'Tunde Bello',
      businessName: 'Tunde Ventures',
    }),
    true
  );

  // Legacy marketer with missing or 'student' accountType still uses marketer completeness rules
  assert.equal(
    checkProfileCompleteness({
      accountType: 'student',
      roles: { buyer: true, landlord: true },
      fullName: 'Tunde Bello',
      phone: '08012345678',
      businessName: 'Tunde Ventures',
      isOnlineOnly: true,
    }),
    true
  );
  assert.equal(
    checkProfileCompleteness({
      fullName: 'Tunde Bello',
      phone: '08012345678',
      businessName: 'Tunde Ventures',
      isOnlineOnly: false,
      shopAddress: 'Shop 4, Gate',
    }),
    false
  );
});

test('calculateProfileCompletion computes accurate student and marketer progress percentages', () => {
  assert.deepEqual(calculateProfileCompletion(null), {
    percentage: 0,
    completedCount: 0,
    totalCount: 5,
    missingFields: ['Profile Photo', 'Phone', 'Campus', 'Department', 'Level'],
    isComplete: false,
  });

  // 3 of 5 student fields -> 60%
  const studentSixty = calculateProfileCompletion({
    accountType: 'student',
    phone: '08012345678',
    campus: 'LASUED',
    department: 'Computer Science',
  });
  assert.equal(studentSixty.percentage, 60);
  assert.equal(studentSixty.completedCount, 3);
  assert.equal(studentSixty.totalCount, 5);
  assert.deepEqual(studentSixty.missingFields, ['Profile Photo', 'Level']);
  assert.equal(studentSixty.isComplete, false);

  // All 5 student fields -> 100%
  const studentFull = calculateProfileCompletion({
    accountType: 'student',
    profilePic: 'data:image/jpeg;base64,ABC',
    phone: '08012345678',
    campus: 'LASUED',
    department: 'Computer Science',
    level: '200L',
  });
  assert.equal(studentFull.percentage, 100);
  assert.equal(studentFull.isComplete, true);
  assert.deepEqual(studentFull.missingFields, []);

  // Online-only marketer -> 3 fields
  const onlineMarketer = calculateProfileCompletion({
    accountType: 'business',
    isOnlineOnly: true,
    phone: '08012345678',
    businessName: 'Campus Tech',
  });
  assert.equal(onlineMarketer.percentage, 67);
  assert.equal(onlineMarketer.totalCount, 3);
  assert.deepEqual(onlineMarketer.missingFields, ['Profile Photo']);
  assert.equal(onlineMarketer.isComplete, false);
});

test('shouldAutoApproveListing and resolvePostLoginRedirect follow verified and dashboard rules', () => {
  assert.equal(shouldAutoApproveListing(null), false);
  assert.equal(shouldAutoApproveListing({ isVerified: false }), false);
  assert.equal(shouldAutoApproveListing({ isVerified: true }), true);

  assert.equal(
    resolvePostLoginRedirect(undefined, '/dashboard/buyer'),
    '/dashboard/buyer'
  );
  assert.equal(
    resolvePostLoginRedirect('/', '/dashboard/seller'),
    '/dashboard/seller'
  );
  assert.equal(
    resolvePostLoginRedirect('/login', '/dashboard/buyer'),
    '/dashboard/buyer'
  );
  assert.equal(
    resolvePostLoginRedirect('/marketplace/create', '/dashboard/buyer'),
    '/marketplace/create'
  );
});



