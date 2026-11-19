import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNewUserProfile, getProtectedRouteDecision } from './authHelpers';

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
    getProtectedRouteDecision({ loading: false, isAuthenticated: true }),
    'allow'
  );
});
