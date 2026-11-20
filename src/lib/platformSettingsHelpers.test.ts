import assert from 'node:assert/strict';
import test from 'node:test';
import { PRIMARY_ADMIN_EMAIL } from './adminHelpers';
import {
  isMaintenanceBypassPath,
  shouldShowMaintenanceScreen,
} from './platformSettingsHelpers';

test('isMaintenanceBypassPath allows admin and login/recovery paths during maintenance', () => {
  assert.equal(isMaintenanceBypassPath('/login'), true);
  assert.equal(isMaintenanceBypassPath('/auth/login'), true);
  assert.equal(isMaintenanceBypassPath('/forgot-password'), true);
  assert.equal(isMaintenanceBypassPath('/admin'), true);
  assert.equal(isMaintenanceBypassPath('/admin/settings'), true);
  assert.equal(isMaintenanceBypassPath('/'), false);
  assert.equal(isMaintenanceBypassPath('/marketplace'), false);
  assert.equal(isMaintenanceBypassPath('/signup'), false);
});

test('shouldShowMaintenanceScreen blocks public users when active, allows verified admin and admin login paths', () => {
  assert.equal(
    shouldShowMaintenanceScreen({
      maintenanceMode: false,
      pathname: '/marketplace',
      user: null,
    }),
    false
  );

  assert.equal(
    shouldShowMaintenanceScreen({
      maintenanceMode: true,
      pathname: '/marketplace',
      user: null,
    }),
    true
  );

  assert.equal(
    shouldShowMaintenanceScreen({
      maintenanceMode: true,
      pathname: '/marketplace',
      user: { email: 'student@lasued.edu.ng', emailVerified: true },
    }),
    true
  );

  assert.equal(
    shouldShowMaintenanceScreen({
      maintenanceMode: true,
      pathname: '/marketplace',
      user: { email: PRIMARY_ADMIN_EMAIL, emailVerified: true },
    }),
    false
  );

  assert.equal(
    shouldShowMaintenanceScreen({
      maintenanceMode: true,
      pathname: '/marketplace',
      user: { email: PRIMARY_ADMIN_EMAIL, emailVerified: false },
    }),
    true
  );

  assert.equal(
    shouldShowMaintenanceScreen({
      maintenanceMode: true,
      pathname: '/login',
      user: null,
    }),
    false
  );

  assert.equal(
    shouldShowMaintenanceScreen({
      maintenanceMode: true,
      pathname: '/admin/settings',
      user: null,
    }),
    false
  );
});
