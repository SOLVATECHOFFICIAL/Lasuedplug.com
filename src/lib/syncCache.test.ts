import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAllFastCache,
  getFastCacheEnvelope,
  setFastCache,
  touchFastCache,
} from './fastCache';
import {
  claimSessionViewTrack,
  DETAIL_FRESH_MS,
  FEED_FRESH_MS,
  FEED_FULL_RECONCILE_MS,
  getNewestCreatedAtMs,
  isSyntheticSeedId,
  mergeDeltaEntities,
  mergeMixedFeedDelta,
  primeEntityRecord,
  primeProductIntoCache,
  resetSessionViewMemoryForTests,
  resolveSyncStrategy,
  shouldSkipDetailNetworkFetch,
  SimpleStorageLike,
} from './syncCache';
import { MixedFeedItem } from './trendingHelpers';
import { Product } from '../types';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? 'prod-1',
    sellerId: overrides.sellerId ?? 'user-1',
    title: overrides.title ?? 'Test Textbook',
    description: overrides.description ?? 'Clean copy for 200L students',
    categoryId: overrides.categoryId ?? 'books',
    images: overrides.images ?? ['https://cdn.example.com/1.jpg'],
    priceType: overrides.priceType ?? 'fixed',
    price: overrides.price ?? 4500,
    whatsappNumber: overrides.whatsappNumber ?? '2348012345678',
    viewCount: overrides.viewCount ?? 0,
    contactCount: overrides.contactCount ?? 0,
    status: overrides.status ?? 'available',
    isApproved: overrides.isApproved ?? true,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? { toMillis: () => 1_700_000_000_000 },
  };
}

describe('syncCache helpers', () => {
  beforeEach(() => {
    clearAllFastCache();
    resetSessionViewMemoryForTests();
  });

  it('resolveSyncStrategy selects full-sync when missing or forced', () => {
    const now = 2_000_000_000;
    assert.equal(
      resolveSyncStrategy({ hasCached: false, nowMs: now }),
      'full-sync'
    );
    assert.equal(
      resolveSyncStrategy({
        hasCached: true,
        lastSyncedAt: now - 10_000,
        lastFullSyncAt: now - 10_000,
        nowMs: now,
        forceRefresh: true,
      }),
      'full-sync'
    );
  });

  it('resolveSyncStrategy skips Firestore reads inside FEED_FRESH_MS window', () => {
    const now = 2_000_000_000;
    assert.equal(
      resolveSyncStrategy({
        hasCached: true,
        lastSyncedAt: now - (FEED_FRESH_MS - 5_000),
        lastFullSyncAt: now - (FEED_FRESH_MS - 5_000),
        nowMs: now,
      }),
      'fresh-skip'
    );
  });

  it('resolveSyncStrategy uses delta-sync after fresh window until reconcile expiry', () => {
    const now = 2_000_000_000;
    assert.equal(
      resolveSyncStrategy({
        hasCached: true,
        lastSyncedAt: now - (FEED_FRESH_MS + 10_000),
        lastFullSyncAt: now - (FEED_FRESH_MS + 10_000),
        nowMs: now,
      }),
      'delta-sync'
    );
    assert.equal(
      resolveSyncStrategy({
        hasCached: true,
        lastSyncedAt: now - (FEED_FRESH_MS + 10_000),
        lastFullSyncAt: now - (FEED_FULL_RECONCILE_MS + 1_000),
        nowMs: now,
      }),
      'full-sync'
    );
  });

  it('getNewestCreatedAtMs ignores synthetic seed IDs', () => {
    const newest = getNewestCreatedAtMs([
      { id: 'seed-1', createdAt: { toMillis: () => 9_999_999_999_999 } },
      { id: 'real-a', createdAt: { toMillis: () => 1_700_000_001_000 } },
      { id: 'real-b', createdAt: { toMillis: () => 1_700_000_005_000 } },
    ]);
    assert.equal(newest, 1_700_000_005_000);
    assert.equal(isSyntheticSeedId('seed-abc'), true);
    assert.equal(isSyntheticSeedId('real-a'), false);
  });

  it('mergeDeltaEntities deduplicates IDs and sorts newest first', () => {
    const existing = [
      makeProduct({ id: 'a', createdAt: { toMillis: () => 1000 } }),
      makeProduct({ id: 'b', createdAt: { toMillis: () => 2000 } }),
    ];
    const incoming = [
      makeProduct({ id: 'b', title: 'Updated B', createdAt: { toMillis: () => 2500 } }),
      makeProduct({ id: 'c', title: 'New C', createdAt: { toMillis: () => 3000 } }),
    ];
    const merged = mergeDeltaEntities(
      existing,
      incoming,
      (p) => p.id,
      (p) =>
        typeof (p.createdAt as { toMillis?: () => number })?.toMillis === 'function'
          ? (p.createdAt as { toMillis: () => number }).toMillis()
          : 0,
      10
    );
    assert.deepEqual(
      merged.map((m) => m.id),
      ['c', 'b', 'a']
    );
    assert.equal(merged.find((m) => m.id === 'b')?.title, 'Updated B');
  });

  it('mergeMixedFeedDelta keys properly by _type:id', () => {
    const existing: MixedFeedItem[] = [
      {
        id: 'x1',
        _type: 'item',
        title: 'Item 1',
        isVerified: true,
        trustScore: 4,
        contactCount: 0,
        viewCount: 0,
        createdAt: { toMillis: () => 1000 },
        images: [],
      },
      {
        id: 'x1',
        _type: 'store',
        title: 'Store 1',
        isVerified: true,
        trustScore: 5,
        contactCount: 0,
        viewCount: 0,
        createdAt: { toMillis: () => 1500 },
        images: [],
      },
    ];
    const incoming: MixedFeedItem[] = [
      {
        id: 'x2',
        _type: 'service',
        title: 'New Service',
        isVerified: false,
        trustScore: 0,
        contactCount: 0,
        viewCount: 0,
        createdAt: { toMillis: () => 3000 },
        images: [],
      },
    ];
    const merged = mergeMixedFeedDelta(existing, incoming, 10);
    assert.equal(merged.length, 3);
    assert.equal(merged[0].id, 'x2');
  });

  it('primeEntityRecord never overwrites a full multi-image gallery with a compacted 1-image item', () => {
    const fullProduct = makeProduct({
      id: 'prod-gallery',
      images: [
        'https://cdn.example.com/1.jpg',
        'https://cdn.example.com/2.jpg',
        'https://cdn.example.com/3.jpg',
      ],
    });
    primeProductIntoCache(fullProduct, { isFull: true });

    const compactedProduct = makeProduct({
      id: 'prod-gallery',
      title: 'Test Textbook',
      images: ['https://cdn.example.com/1.jpg'],
    });
    primeEntityRecord('product:prod-gallery', compactedProduct, { isFull: false });

    const env = getFastCacheEnvelope<Product>('product:prod-gallery', 0);
    assert.ok(env);
    assert.equal(env.data.images.length, 3);
    assert.equal(env.isFull, true);
  });

  it('shouldSkipDetailNetworkFetch only skips when fresh AND full-fidelity', () => {
    const now = 3_000_000_000;
    setFastCache(
      'product:p-compact',
      makeProduct({ id: 'p-compact', images: ['img1'] }),
      { savedAt: now, syncedAt: now, isFull: false }
    );
    const compactCheck = shouldSkipDetailNetworkFetch<Product>(
      'product:p-compact',
      { nowMs: now + 1000 }
    );
    assert.equal(compactCheck.skip, false);
    assert.ok(compactCheck.cached);

    setFastCache(
      'product:p-full',
      makeProduct({ id: 'p-full', images: ['img1', 'img2'] }),
      { savedAt: now, syncedAt: now, isFull: true }
    );
    const fullFreshCheck = shouldSkipDetailNetworkFetch<Product>(
      'product:p-full',
      { nowMs: now + 5000 }
    );
    assert.equal(fullFreshCheck.skip, true);

    const fullStaleCheck = shouldSkipDetailNetworkFetch<Product>(
      'product:p-full',
      { nowMs: now + DETAIL_FRESH_MS + 1000 }
    );
    assert.equal(fullStaleCheck.skip, false);
  });

  it('touchFastCache refreshes syncedAt while preserving fullSyncAt', () => {
    const initialFullSync = Date.now() - 10 * 60_000;
    setFastCache('home_mixed_feed', [makeProduct({ id: 'p1' })], {
      savedAt: initialFullSync,
      syncedAt: initialFullSync,
      fullSyncAt: initialFullSync,
      isFull: true,
    });
    touchFastCache('home_mixed_feed');
    const env = getFastCacheEnvelope('home_mixed_feed', 0);
    assert.ok(env);
    assert.equal(env.fullSyncAt, initialFullSync);
    assert.ok((env.syncedAt ?? 0) > initialFullSync);
  });

  it('claimSessionViewTrack returns true once per listing per session', () => {
    const store = new Map<string, string>();
    const fakeStorage: SimpleStorageLike = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
    };
    assert.equal(claimSessionViewTrack('item-1', fakeStorage), true);
    assert.equal(claimSessionViewTrack('item-1', fakeStorage), false);
    assert.equal(claimSessionViewTrack('seed-item', fakeStorage), false);
    assert.equal(claimSessionViewTrack('item-2', fakeStorage), true);
  });
});
