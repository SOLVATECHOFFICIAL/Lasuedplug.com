import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearMissingIndexCache,
  compactListingsForCache,
  compactMixedFeedForCache,
  hasKnownMissingIndex,
  markMissingIndex,
  runDeduplicatedQuery,
} from './firestoreQueryCache';

test('missing index cache records and clears keys cleanly', () => {
  clearMissingIndexCache();
  assert.equal(hasKnownMissingIndex('products:item:newest'), false);

  markMissingIndex('products:item:newest');
  assert.equal(hasKnownMissingIndex('products:item:newest'), true);

  clearMissingIndexCache();
  assert.equal(hasKnownMissingIndex('products:item:newest'), false);
});

test('runDeduplicatedQuery shares concurrent in-flight promises and cleans up after completion', async () => {
  let executions = 0;
  const fetcher = async () => {
    executions += 1;
    await new Promise((r) => setTimeout(r, 15));
    return ['ok'];
  };

  const [a, b] = await Promise.all([
    runDeduplicatedQuery('dedup:test', fetcher),
    runDeduplicatedQuery('dedup:test', fetcher),
  ]);

  assert.equal(executions, 1);
  assert.deepEqual(a, ['ok']);
  assert.deepEqual(b, ['ok']);

  const c = await runDeduplicatedQuery('dedup:test', fetcher);
  assert.equal(executions, 2);
  assert.deepEqual(c, ['ok']);
});

test('compactListingsForCache caps count and keeps only the first cover image', () => {
  const items = [
    { id: '1', images: ['cover-1', 'img-2', 'img-3', 'img-4'] },
    { id: '2', images: ['cover-2'] },
    { id: '3', images: [] },
  ];

  const compacted = compactListingsForCache(items, 2);
  assert.equal(compacted.length, 2);
  assert.deepEqual(compacted[0].images, ['cover-1']);
  assert.deepEqual(compacted[1].images, ['cover-2']);
});

test('compactMixedFeedForCache strips extra nested entity images and caps items', () => {
  const mixed = [
    { id: '1', product: { images: ['p1', 'p2', 'p3'] } },
    { id: '2', store: { images: ['s1', 's2'] } },
    { id: '3', accommodation: { images: ['a1', 'a2', 'a3'] } },
    { id: '4', service: { images: ['sv1', 'sv2'] } },
  ];

  const compacted = compactMixedFeedForCache(mixed, 3);
  assert.equal(compacted.length, 3);
  assert.deepEqual(compacted[0].product?.images, ['p1']);
  assert.deepEqual(compacted[1].store?.images, ['s1']);
  assert.deepEqual(compacted[2].accommodation?.images, ['a1']);
});
