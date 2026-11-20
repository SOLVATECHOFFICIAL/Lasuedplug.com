import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BANNED_ACCOUNT_MESSAGE,
  buildNewUserProfile,
  checkProfileCompleteness,
  formatFirebaseAuthError,
  getFieldCooldownStatus,
  getInitials,
  getPrimaryRoleLabel,
  getProtectedRouteDecision,
  isAcademicFieldLocked,
  isAccountBanned,
  isAccountSuspended,
  PHONE_UPDATE_COOLDOWN_DAYS,
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
  assert.equal(profile.isVerified, false);
  assert.equal(profile.status, 'active');
  assert.equal(profile.roles.buyer, true);
  assert.equal(profile.roles.admin, undefined);
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
    'Your account has been suspended. Contact Admin on WhatsApp.'
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
