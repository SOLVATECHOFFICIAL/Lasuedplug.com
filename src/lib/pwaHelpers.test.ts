import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canShowInstallControls,
  isIosSafariUserAgent,
  isStandaloneDisplayMode,
  shouldShowInstallBanner,
} from './pwaHelpers';

test('isStandaloneDisplayMode detects standalone media query or iOS navigator.standalone', () => {
  assert.equal(isStandaloneDisplayMode(true, false), true);
  assert.equal(isStandaloneDisplayMode(false, true), true);
  assert.equal(isStandaloneDisplayMode(false, false), false);
  assert.equal(isStandaloneDisplayMode(false, undefined), false);
});

test('isIosSafariUserAgent detects Safari on iPhone/iPad and excludes Chrome/Firefox/Edge on iOS', () => {
  assert.equal(
    isIosSafariUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    ),
    true
  );
  assert.equal(
    isIosSafariUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1'
    ),
    false
  );
  assert.equal(
    isIosSafariUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    ),
    false
  );
  assert.equal(isIosSafariUserAgent(''), false);
});

test('canShowInstallControls and shouldShowInstallBanner suppress UI when installed or dismissed', () => {
  assert.equal(
    canShowInstallControls({
      isInstalled: true,
      hasDeferredPrompt: true,
      isIosSafari: false,
    }),
    false
  );
  assert.equal(
    canShowInstallControls({
      isInstalled: false,
      hasDeferredPrompt: true,
      isIosSafari: false,
    }),
    true
  );
  assert.equal(
    canShowInstallControls({
      isInstalled: false,
      hasDeferredPrompt: false,
      isIosSafari: true,
    }),
    true
  );
  assert.equal(
    canShowInstallControls({
      isInstalled: false,
      hasDeferredPrompt: false,
      isIosSafari: false,
    }),
    false
  );

  assert.equal(
    shouldShowInstallBanner({
      isInstalled: false,
      dismissed: true,
      hasDeferredPrompt: true,
      isIosSafari: false,
    }),
    false
  );
  assert.equal(
    shouldShowInstallBanner({
      isInstalled: false,
      dismissed: false,
      hasDeferredPrompt: true,
      isIosSafari: false,
    }),
    true
  );
});
