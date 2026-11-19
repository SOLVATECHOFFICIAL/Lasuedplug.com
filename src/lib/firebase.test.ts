import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFirebaseConfig, isFirebaseEnvComplete } from './firebaseConfig';
import { isFirebaseConfigured } from './firebase';

test('isFirebaseEnvComplete returns false when any required env var is missing or blank', () => {
  assert.equal(isFirebaseEnvComplete({}), false);
  assert.equal(
    isFirebaseEnvComplete({
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'lasuedplug.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'lasuedplug',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '   ',
      VITE_FIREBASE_APP_ID: '1:123:web:abc',
    }),
    false
  );
});

test('isFirebaseEnvComplete returns true only when all 5 env vars are non-empty', () => {
  assert.equal(
    isFirebaseEnvComplete({
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'lasuedplug.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'lasuedplug',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123456',
      VITE_FIREBASE_APP_ID: '1:123:web:abc',
    }),
    true
  );
});

test('buildFirebaseConfig trims values cleanly', () => {
  const cfg = buildFirebaseConfig({
    VITE_FIREBASE_API_KEY: ' abc ',
    VITE_FIREBASE_PROJECT_ID: ' lasuedplug ',
  });
  assert.equal(cfg.apiKey, 'abc');
  assert.equal(cfg.projectId, 'lasuedplug');
  assert.equal(cfg.appId, '');
});

test('isFirebaseConfigured does not crash when env vars are unset', () => {
  assert.equal(isFirebaseConfigured(), false);
});
