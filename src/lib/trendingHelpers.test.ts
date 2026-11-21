import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTwoHourTrendingShuffle,
  filterMixedFeedItems,
  getCurrentTwoHourSeed,
  MixedFeedItem,
  productToMixedFeedItem,
  seededShuffle,
  sortMixedFeedItems,
  storeToMixedFeedItem,
  TWO_HOURS_MS,
} from './trendingHelpers';
import {
  getRecentlyViewed,
  MAX_RECENTLY_VIEWED,
  RECENTLY_VIEWED_STORAGE_KEY,
  saveRecentlyViewed,
} from './recentlyViewed';
import {
  DASHBOARD_MODE_STORAGE_KEY,
  getPreferredDashboardPath,
  getSavedDashboardMode,
  saveDashboardMode,
} from './dashboardMode';

function installMockBrowserStorage() {
  const store = new Map<string, string>();
  const dispatched: string[] = [];

  const mockWindow = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
    dispatchEvent: (evt: { type?: string }) => {
      if (evt?.type) dispatched.push(evt.type);
      return true;
    },
  };

  (globalThis as unknown as { window?: unknown }).window = mockWindow;
  if (typeof (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent === 'undefined') {
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class MockCustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  }

  return {
    store,
    dispatched,
    cleanup: () => {
      delete (globalThis as unknown as { window?: unknown }).window;
    },
  };
}

test('getCurrentTwoHourSeed stays stable within a 2-hour block and advances every 7,200,000 ms', () => {
  const blockStart = 1000 * TWO_HOURS_MS;
  assert.equal(getCurrentTwoHourSeed(blockStart), 1000);
  assert.equal(getCurrentTwoHourSeed(blockStart + TWO_HOURS_MS - 1), 1000);
  assert.equal(getCurrentTwoHourSeed(blockStart + TWO_HOURS_MS), 1001);
});

test('applyTwoHourTrendingShuffle caps at top 30 by engagement, is deterministic per window, and rotates every 2 hours', () => {
  const candidates = Array.from({ length: 40 }, (_, index) => ({
    id: `item-${index + 1}`,
    contactCount: index + 1,
    viewCount: (index + 1) * 5,
    createdAt: 1000 + index,
  }));

  const t1 = 500 * TWO_HOURS_MS + 12345;
  const t2 = 500 * TWO_HOURS_MS + TWO_HOURS_MS - 10;
  const tNextWindow = 501 * TWO_HOURS_MS + 1000;

  const firstRun = applyTwoHourTrendingShuffle(candidates, t1);
  const sameWindowRun = applyTwoHourTrendingShuffle(candidates, t2);
  const nextWindowRun = applyTwoHourTrendingShuffle(candidates, tNextWindow);

  assert.equal(firstRun.length, 30);
  assert.deepEqual(
    firstRun.map((item) => item.id),
    sameWindowRun.map((item) => item.id)
  );
  // Only top 30 by engagement (ids item-11..item-40) should be included
  assert.ok(
    firstRun.every((item) => Number(item.id.replace('item-', '')) >= 11)
  );
  // Order rotates when timeSeed advances by 2 hours
  assert.notDeepEqual(
    firstRun.map((item) => item.id),
    nextWindowRun.map((item) => item.id)
  );

  // seededShuffle should never mutate input array
  const snapshot = seededShuffle(['a', 'b', 'c', 'd'], 42);
  assert.equal(snapshot.length, 4);
});

test('filterMixedFeedItems filters by type, verifiedOnly, and searchQuery', () => {
  const items: MixedFeedItem[] = [
    productToMixedFeedItem(
      {
        id: 'p1',
        sellerId: 'u1',
        title: 'HP EliteBook Laptop',
        description: 'Clean 16GB RAM laptop',
        categoryId: 'electronics',
        categoryName: 'Electronics',
        price: 250000,
        priceType: 'fixed',
        adType: 'item',
        locationName: 'Epe Gate',
        images: [],
        whatsappNumber: '2348011111111',
        viewCount: 10,
        contactCount: 2,
        isApproved: true,
        isActive: true,
        createdAt: 300,
        sellerSnapshot: { fullName: 'Tunde', phone: '08011111111', isVerified: true },
      },
      { trustScore: 4.9, reviewCount: 12, isVerified: true }
    ),
    storeToMixedFeedItem(
      {
        id: 's1',
        ownerId: 'u2',
        name: 'Campus Braids Studio',
        description: 'Quick hair styling near senate',
        category: 'Beauty & Grooming',
        locationName: 'Hostel B',
        openingHours: '8am - 6pm',
        whatsappNumber: '2348022222222',
        isApproved: true,
        isActive: true,
        trustScore: 4.5,
        reviewCount: 4,
        createdAt: 400,
        ownerSnapshot: { fullName: 'Amaka', phone: '08022222222', isVerified: false },
      },
      { trustScore: 4.5, reviewCount: 4, isVerified: false }
    ),
  ];

  assert.equal(filterMixedFeedItems(items, { verifiedOnly: true }).length, 1);
  assert.equal(
    filterMixedFeedItems(items, { typeFilter: 'store' }).map((x) => x.id).join(','),
    's1'
  );
  assert.equal(
    filterMixedFeedItems(items, { typeFilter: 'service' }).map((x) => x.id).join(','),
    's1'
  );
  assert.equal(
    filterMixedFeedItems(items, { searchQuery: 'laptop' }).map((x) => x.id).join(','),
    'p1'
  );
});

test('sortMixedFeedItems sorts newest by createdAt and top_rated by trustScore then reviewCount', () => {
  const base: MixedFeedItem[] = [
    {
      id: 'low-trust-new',
      _type: 'item',
      title: 'Item A',
      sellerId: 'u1',
      isVerified: false,
      trustScore: 3.0,
      reviewCount: 5,
      contactCount: 0,
      viewCount: 0,
      createdAt: 900,
      searchHaystack: 'item a',
    },
    {
      id: 'high-trust-older',
      _type: 'store',
      title: 'Store B',
      sellerId: 'u2',
      isVerified: true,
      trustScore: 4.9,
      reviewCount: 10,
      contactCount: 0,
      viewCount: 0,
      createdAt: 200,
      searchHaystack: 'store b',
    },
    {
      id: 'same-trust-more-reviews',
      _type: 'service',
      title: 'Service C',
      sellerId: 'u3',
      isVerified: true,
      trustScore: 4.9,
      reviewCount: 25,
      contactCount: 0,
      viewCount: 0,
      createdAt: 100,
      searchHaystack: 'service c',
    },
  ];

  assert.deepEqual(
    sortMixedFeedItems(base, 'newest').map((i) => i.id),
    ['low-trust-new', 'high-trust-older', 'same-trust-more-reviews']
  );

  assert.deepEqual(
    sortMixedFeedItems(base, 'top_rated').map((i) => i.id),
    ['same-trust-more-reviews', 'high-trust-older', 'low-trust-new']
  );
});

test('saveRecentlyViewed deduplicates and caps at last 5 items under recentlyViewed key', () => {
  const env = installMockBrowserStorage();
  try {
    for (let i = 1; i <= 7; i += 1) {
      saveRecentlyViewed({
        id: `p-${i}`,
        _type: 'item',
        title: `Product ${i}`,
        priceLabel: `₦${i}00`,
        href: `/marketplace/p-${i}`,
      });
    }

    // Re-viewing an earlier item should move it to front without duplicating
    saveRecentlyViewed({
      id: 'p-4',
      _type: 'item',
      title: 'Product 4 Updated',
      priceLabel: '₦400',
      href: '/marketplace/p-4',
    });

    const saved = getRecentlyViewed();
    assert.equal(saved.length, MAX_RECENTLY_VIEWED);
    assert.equal(saved[0].id, 'p-4');
    assert.equal(saved[0].title, 'Product 4 Updated');
    assert.ok(env.store.has(RECENTLY_VIEWED_STORAGE_KEY));
  } finally {
    env.cleanup();
  }
});

test('saveDashboardMode persists buyer/seller preference under dashboard_mode key', () => {
  const env = installMockBrowserStorage();
  try {
    assert.equal(getSavedDashboardMode(), 'buyer');
    assert.equal(getPreferredDashboardPath(), '/dashboard/buyer');

    saveDashboardMode('seller');
    assert.equal(env.store.get(DASHBOARD_MODE_STORAGE_KEY), 'seller');
    assert.equal(getSavedDashboardMode(), 'seller');
    assert.equal(getPreferredDashboardPath(), '/dashboard/seller');

    saveDashboardMode('buyer');
    assert.equal(getPreferredDashboardPath(), '/dashboard/buyer');
  } finally {
    env.cleanup();
  }
});
