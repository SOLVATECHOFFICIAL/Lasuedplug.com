import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRouteKey,
  getSavedRouteScroll,
  getSavedRouteViewState,
  getScrollActionForNavigation,
  hasInAppBackHistory,
  resetFeedScrollStateForTests,
  saveRouteScroll,
  saveRouteViewState,
} from './feedScrollState';

test('feedScrollState saves and restores scroll offset by historyKey and route fallback', () => {
  resetFeedScrollStateForTests();

  const routeKey = buildRouteKey('/marketplace', '');
  saveRouteScroll('entry-1', routeKey, 1480);

  assert.equal(getSavedRouteScroll('entry-1', routeKey), 1480);
  // Route fallback works if another history entry revisits the route
  assert.equal(getSavedRouteScroll('default', routeKey), 1480);
  assert.equal(getSavedRouteScroll('entry-2', '/services'), undefined);
});

test('feedScrollState stores and restores route view state cleanly', () => {
  resetFeedScrollStateForTests();

  saveRouteViewState('h-9', '/', {
    sortMode: 'trending',
    typeFilter: 'service',
    verifiedOnly: true,
    visibleCount: 24,
  });

  const restored = getSavedRouteViewState<{
    sortMode: string;
    visibleCount: number;
  }>('h-9', '/');

  assert.deepEqual(restored, {
    sortMode: 'trending',
    typeFilter: 'service',
    verifiedOnly: true,
    visibleCount: 24,
  });
});

test('getScrollActionForNavigation resets on pathname change PUSH/REPLACE and restores on POP', () => {
  assert.equal(
    getScrollActionForNavigation({
      navigationType: 'PUSH',
      pathnameChanged: true,
    }),
    'reset-top'
  );
  assert.equal(
    getScrollActionForNavigation({
      navigationType: 'REPLACE',
      pathnameChanged: true,
    }),
    'reset-top'
  );
  // Filter search param replace inside the same feed does NOT jump scroll
  assert.equal(
    getScrollActionForNavigation({
      navigationType: 'REPLACE',
      pathnameChanged: false,
    }),
    'none'
  );
  // Going back via Go Back button or browser back ALWAYS triggers restore
  assert.equal(
    getScrollActionForNavigation({
      navigationType: 'POP',
      pathnameChanged: true,
    }),
    'restore'
  );
});

test('hasInAppBackHistory distinguishes in-app navigation from direct landing', () => {
  assert.equal(hasInAppBackHistory({ idx: 0 }, 'default'), false);
  assert.equal(hasInAppBackHistory({ idx: 0 }, 'abc'), false);
  assert.equal(hasInAppBackHistory({ idx: 2 }, 'abc'), true);
  assert.equal(hasInAppBackHistory(null, 'default'), false);
  assert.equal(hasInAppBackHistory(null, 'abc'), true);
});
