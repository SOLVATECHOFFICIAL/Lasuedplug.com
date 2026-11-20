import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarketplaceSearchUrl,
  filterAndSortListings,
  SEED_ACCOMMODATIONS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_ROOMMATE_REQUESTS,
  SEED_SERVICES,
} from './homeHelpers';
import { formatNaira } from './utils';

test('buildMarketplaceSearchUrl encodes trimmed search term or falls back to /marketplace', () => {
  assert.equal(buildMarketplaceSearchUrl('test'), '/marketplace?q=test');
  assert.equal(
    buildMarketplaceSearchUrl('  textbook 101  '),
    '/marketplace?q=textbook%20101'
  );
  assert.equal(buildMarketplaceSearchUrl('   '), '/marketplace');
});

test('filterAndSortListings filters to approved+active items, sorts descending, and limits', () => {
  const rows = [
    { id: '1', isApproved: true, isActive: true, createdAt: 100 },
    { id: '2', isApproved: false, isActive: true, createdAt: 500 },
    { id: '3', isApproved: true, isActive: false, createdAt: 400 },
    { id: '4', isApproved: true, isActive: true, createdAt: 300 },
    { id: '5', isApproved: true, isActive: true, createdAt: 200 },
  ];
  const result = filterAndSortListings(rows, 2);
  assert.deepEqual(
    result.map((r) => r.id),
    ['4', '5']
  );
});

test('formatNaira formats Nigerian Naira cleanly without decimals', () => {
  const formatted = formatNaira(5000);
  assert.ok(formatted.includes('5,000'));
  assert.ok(formatted.includes('₦') || formatted.includes('NGN'));
});

test('seed datasets include AI search food/tech items, adType, serviceLocation, and >12 products', () => {
  assert.equal(SEED_CATEGORIES.length, 11);
  assert.equal(SEED_PRODUCTS.length, 15);
  assert.equal(SEED_SERVICES.length, 3);
  assert.equal(SEED_ACCOMMODATIONS.length, 3);

  const titles = SEED_PRODUCTS.map((p) => p.title);
  for (const requiredTitle of [
    'Butter',
    'Akara and Bread',
    'Puff Puff',
    'Egg and Tea',
    'HP Laptop',
    'Phone Charger',
    'Nike Sneakers',
    'Phone Charging & Device Care',
  ]) {
    assert.ok(titles.includes(requiredTitle), `Missing seed product: ${requiredTitle}`);
  }

  assert.ok(
    SEED_PRODUCTS.every(
      (p) =>
        p.isApproved &&
        p.isActive &&
        p.viewCount === 0 &&
        p.contactCount === 0 &&
        (p.adType === 'item' || p.adType === 'service') &&
        (p.adType === 'service'
          ? p.quantity === undefined &&
            p.priceType === 'contact' &&
            (p.serviceLocation === 'shop' ||
              p.serviceLocation === 'mobile' ||
              p.serviceLocation === 'online')
          : typeof p.quantity === 'number' && p.quantity >= 1) &&
        Boolean(p.locationName) &&
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        p.images.every((img) => img.startsWith('data:image/')) &&
        !('googleMapLink' in p) &&
        p.whatsappNumber.startsWith('234')
    )
  );
  assert.ok(SEED_PRODUCTS.some((p) => p.adType === 'service'));
  assert.ok(SEED_PRODUCTS.some((p) => p.adType === 'item'));
  assert.ok(
    SEED_SERVICES.every(
      (s) => s.isApproved && s.isActive && s.viewCount === 0 && s.contactCount === 0
    )
  );
  assert.ok(
    SEED_ACCOMMODATIONS.every(
      (a) =>
        a.isApproved &&
        a.isActive &&
        typeof a.rentPrice === 'number' &&
        a.rentPrice > 0 &&
        Boolean(a.generalLocation) &&
        a.images.every((img) => img.startsWith('data:image/')) &&
        a.whatsappNumber.startsWith('234')
    )
  );
  assert.equal(SEED_ROOMMATE_REQUESTS.length, 2);
  assert.ok(
    SEED_ROOMMATE_REQUESTS.every(
      (r) =>
        r.isApproved &&
        r.isActive &&
        Boolean(r.generalLocation) &&
        Boolean(r.preferences) &&
        Array.isArray(r.images) &&
        r.images.every((img) => img.startsWith('data:image/')) &&
        r.whatsappNumber.startsWith('234')
    )
  );
});
