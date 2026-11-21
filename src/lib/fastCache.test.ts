import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAllFastCache,
  getFastCache,
  invalidateFastCache,
  invalidateFastCachePrefix,
  setFastCache,
} from './fastCache.ts';

test('setFastCache and getFastCache store and return entries instantly', () => {
  clearAllFastCache();
  const payload = [{ id: 'p1', title: 'Campus Bike' }];
  setFastCache('home_mixed_feed', payload);

  const hit = getFastCache<typeof payload>('home_mixed_feed');
  assert.deepEqual(hit, payload);
});

test('invalidateFastCache and invalidateFastCachePrefix evict matching keys cleanly', () => {
  clearAllFastCache();
  setFastCache('product:1', { id: '1' });
  setFastCache('product:2', { id: '2' });
  setFastCache('home_mixed_feed', [{ id: '1' }]);

  invalidateFastCache('product:1');
  assert.equal(getFastCache('product:1'), null);
  assert.deepEqual(getFastCache('product:2'), { id: '2' });

  invalidateFastCachePrefix('product:');
  assert.equal(getFastCache('product:2'), null);
  assert.deepEqual(getFastCache('home_mixed_feed'), [{ id: '1' }]);
});
