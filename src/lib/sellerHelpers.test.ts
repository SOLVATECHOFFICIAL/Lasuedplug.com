import assert from 'node:assert/strict';
import test from 'node:test';
import { Product } from '../types';
import {
  calculateSellerStats,
  canMarkOneAsSold,
  computeNextSoldOneUpdate,
  computeNextToggleActiveUpdate,
  filterSellerListingsByTab,
  getListingStatusBadge,
  isListingSoldOut,
} from './sellerHelpers';

function makeListing(overrides: Partial<Product> = {}): Product {
  return {
    id: 'listing-1',
    sellerId: 'seller-1',
    adType: 'item',
    title: 'Sample Product',
    description: 'Clean campus product description.',
    categoryId: 'electronics',
    subcategory: 'Laptops & Computers',
    images: [],
    quantity: 3,
    priceType: 'fixed',
    price: 25000,
    priceUnit: 'total',
    whatsappNumber: '08012345678',
    locationName: 'LASUED Main Gate',
    hasDelivery: false,
    viewCount: 10,
    contactCount: 2,
    status: 'active',
    isApproved: true,
    isActive: true,
    createdAt: 1000,
    ...overrides,
  };
}

test('calculateSellerStats totals listings, active items, pending approval, and views accurately', () => {
  const listings: Product[] = [
    makeListing({ id: '1', isApproved: true, isActive: true, status: 'active', viewCount: 12 }),
    makeListing({ id: '2', isApproved: false, isActive: true, status: 'active', viewCount: 5 }),
    makeListing({ id: '3', isApproved: true, isActive: false, status: 'sold', quantity: 0, viewCount: 30 }),
    makeListing({ id: '4', isApproved: false, isActive: false, status: 'unavailable', viewCount: 3 }),
  ];

  const stats = calculateSellerStats(listings);
  assert.deepEqual(stats, {
    totalListings: 4,
    activeListings: 2,
    pendingApproval: 2,
    totalViews: 50,
  });
});

test('getListingStatusBadge returns Sold Out, Pending Approval, Hidden, or Active cleanly', () => {
  assert.equal(
    getListingStatusBadge(makeListing({ status: 'sold', quantity: 0 })).label,
    'Sold Out'
  );
  assert.equal(
    getListingStatusBadge(makeListing({ isApproved: false })).label,
    'Pending Approval'
  );
  assert.equal(
    getListingStatusBadge(makeListing({ isApproved: true, isActive: false })).label,
    'Hidden'
  );
  assert.equal(
    getListingStatusBadge(makeListing({ isApproved: true, isActive: true, status: 'active' })).label,
    'Active'
  );
});

test('filterSellerListingsByTab separates All, Active, Pending, and Sold Out tabs', () => {
  const activeItem = makeListing({ id: 'a', isApproved: true, isActive: true, status: 'active', quantity: 2 });
  const pendingItem = makeListing({ id: 'p', isApproved: false, isActive: true, status: 'active', quantity: 1 });
  const soldItem = makeListing({ id: 's', isApproved: true, isActive: false, status: 'sold', quantity: 0 });
  const hiddenItem = makeListing({ id: 'h', isApproved: true, isActive: false, status: 'active', quantity: 4 });

  const all = [activeItem, pendingItem, soldItem, hiddenItem];

  assert.deepEqual(filterSellerListingsByTab(all, 'all').map((x) => x.id), ['a', 'p', 's', 'h']);
  assert.deepEqual(filterSellerListingsByTab(all, 'active').map((x) => x.id), ['a']);
  assert.deepEqual(filterSellerListingsByTab(all, 'pending').map((x) => x.id), ['p']);
  assert.deepEqual(filterSellerListingsByTab(all, 'sold').map((x) => x.id), ['s']);
});

test('canMarkOneAsSold returns true only for items with quantity > 0 and false for services', () => {
  assert.equal(canMarkOneAsSold(makeListing({ adType: 'item', quantity: 2 })), true);
  assert.equal(canMarkOneAsSold(makeListing({ adType: 'item', quantity: 0 })), false);
  assert.equal(canMarkOneAsSold(makeListing({ adType: 'service', quantity: undefined })), false);
  assert.equal(canMarkOneAsSold(makeListing({ adType: undefined, listingType: 'service', quantity: undefined })), false);
});

test('computeNextSoldOneUpdate decrements stock and marks listing sold + inactive when reaching 0', () => {
  const step1 = computeNextSoldOneUpdate({ quantity: 2, status: 'active', isActive: true });
  assert.deepEqual(step1, { quantity: 1, status: 'active', isActive: true });

  const step2 = computeNextSoldOneUpdate({ quantity: 1, status: 'active', isActive: true });
  assert.deepEqual(step2, { quantity: 0, status: 'sold', isActive: false });
});

test('isListingSoldOut does not flag services without quantity as sold out', () => {
  const service = makeListing({ adType: 'service', quantity: undefined, status: 'active' });
  assert.equal(isListingSoldOut(service), false);
});

test('computeNextToggleActiveUpdate guards against reactivating a 0-stock product', () => {
  assert.throws(() =>
    computeNextToggleActiveUpdate(
      { adType: 'item', quantity: 0, status: 'sold', isActive: false },
      true
    )
  );

  assert.deepEqual(
    computeNextToggleActiveUpdate(
      { adType: 'service', quantity: undefined, status: 'active', isActive: false },
      true
    ),
    { isActive: true, status: 'active' }
  );
});
