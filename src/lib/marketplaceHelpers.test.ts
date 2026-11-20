import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLocalMarketplaceFiltersAndSort,
  buildAdminWhatsAppUrl,
  buildProductWhatsAppUrl,
  filterProductsByQuery,
  formatNigerianWhatsAppDigits,
  getListingAdType,
  getPriceUnitLabel,
  getPriceUnitSuffix,
  getProductLocationLabel,
  getProductPriceDisplay,
  getServiceLocationLabel,
  hasActiveMarketplaceFilters,
} from './marketplaceHelpers';
import { Product } from '../types';

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: '1',
    sellerId: 's1',
    adType: 'item',
    title: 'HP Pavilion Laptop',
    description: 'Clean laptop',
    images: [],
    quantity: 2,
    priceType: 'fixed',
    price: 45000,
    priceUnit: 'total',
    categoryId: 'electronics',
    subcategory: 'Laptops & Computers',
    locationName: 'Shop 4, LASUED Gate',
    hasDelivery: false,
    viewCount: 15,
    contactCount: 2,
    whatsappNumber: '2348031234567',
    status: 'active',
    isApproved: true,
    isActive: true,
    createdAt: 100,
  },
  {
    id: '2',
    sellerId: 's2',
    adType: 'item',
    title: 'Used Calculus Textbook',
    description: 'Clean book',
    priceType: 'negotiable',
    price: 2500,
    priceUnit: 'total',
    categoryId: 'books',
    subcategory: 'Textbooks & Handouts',
    images: [],
    quantity: 1,
    locationName: 'Block B, Room 12',
    hasDelivery: true,
    viewCount: 8,
    contactCount: 9,
    whatsappNumber: '2348031234567',
    status: 'active',
    isApproved: true,
    isActive: true,
    createdAt: 300,
  },
  {
    id: '3',
    sellerId: 's3',
    adType: 'service',
    serviceLocation: 'shop',
    title: 'Phone Repair Service',
    description: 'Fast phone repair spot',
    priceType: 'contact',
    categoryId: 'tech_repairs',
    subcategory: 'Phone Repairs',
    images: [],
    locationName: 'Opposite Main Gate',
    viewCount: 30,
    contactCount: 5,
    whatsappNumber: '2348031234567',
    status: 'active',
    isApproved: true,
    isActive: true,
    createdAt: 200,
  },
];

test('formatNigerianWhatsAppDigits strips leading 0 and adds 234 prefix', () => {
  assert.equal(formatNigerianWhatsAppDigits('09049979183'), '2349049979183');
  assert.equal(formatNigerianWhatsAppDigits('0803 123 4567'), '2348031234567');
  assert.equal(formatNigerianWhatsAppDigits('+2348031234567'), '2348031234567');
  assert.equal(formatNigerianWhatsAppDigits('8031234567'), '2348031234567');
});

test('buildProductWhatsAppUrl constructs proper wa.me link with listing message', () => {
  const url = buildProductWhatsAppUrl('08031234567', 'HP Laptop');
  assert.equal(
    url,
    'https://wa.me/2348031234567?text=Hello%2C%20I%20saw%20your%20listing%20for%20HP%20Laptop%20on%20LASUEDPLUG.%20Is%20it%20still%20available%3F'
  );
});

test('buildAdminWhatsAppUrl builds wa.me link for admin profile change request', () => {
  const url = buildAdminWhatsAppUrl('09049979183', 'ada@lasued.edu.ng', 'Ada Okafor');
  assert.ok(url.startsWith('https://wa.me/2349049979183?text='));
  assert.ok(decodeURIComponent(url).includes('Ada Okafor'));
});

test('getListingAdType and getServiceLocationLabel resolve item vs service properly', () => {
  assert.equal(getListingAdType({ adType: 'service' }), 'service');
  assert.equal(getListingAdType({ listingType: 'service' }), 'service');
  assert.equal(getListingAdType({ adType: 'item' }), 'item');
  assert.equal(getListingAdType({}), 'item');

  assert.equal(getServiceLocationLabel('shop'), 'Come to Shop');
  assert.equal(getServiceLocationLabel('mobile'), 'We come to you');
  assert.equal(getServiceLocationLabel('online'), 'Online / Delivery');
});

test('price unit helpers and getProductPriceDisplay format units and force Contact for Price on services', () => {
  assert.equal(getPriceUnitSuffix('total'), '');
  assert.equal(getPriceUnitSuffix('per_day'), '/ day');
  assert.equal(getPriceUnitSuffix('per_hour'), '/ hour');
  assert.equal(getPriceUnitSuffix('per_item'), '/ item');
  assert.equal(getPriceUnitLabel('per_day'), 'per day');

  const fixed = getProductPriceDisplay({
    adType: 'item',
    priceType: 'fixed',
    price: 45000,
    priceUnit: 'total',
  });
  assert.equal(fixed.isContact, false);
  assert.ok(fixed.text.includes('45,000'));
  assert.ok(!fixed.text.includes('/'));

  const negotiable = getProductPriceDisplay({
    adType: 'item',
    priceType: 'negotiable',
    price: 2500,
    priceUnit: 'total',
  });
  assert.ok(negotiable.text.includes('2,500'));
  assert.ok(negotiable.text.includes('(Negotiable)'));

  const serviceDisplay = getProductPriceDisplay({
    adType: 'service',
    priceType: 'contact',
  });
  assert.equal(serviceDisplay.isContact, true);
  assert.equal(serviceDisplay.text, 'Contact for Price');
});

test('getProductLocationLabel handles serviceLocation, locationName, and online fallbacks cleanly', () => {
  assert.equal(
    getProductLocationLabel({
      adType: 'service',
      serviceLocation: 'mobile',
      locationName: 'Epe Campus',
    }),
    'We come to you'
  );
  assert.equal(
    getProductLocationLabel({
      adType: 'service',
      serviceLocation: 'online',
    }),
    'Online / Delivery'
  );
  assert.equal(
    getProductLocationLabel({
      adType: 'service',
      serviceLocation: 'shop',
      locationName: 'Shop 4, Main Gate',
    }),
    'Come to Shop · Shop 4, Main Gate'
  );
  assert.equal(
    getProductLocationLabel({
      adType: 'item',
      locationName: 'Block B, Room 12',
    }),
    'Block B, Room 12'
  );
  assert.equal(getProductLocationLabel({}), 'LASUED Campus');
});

test('filterProductsByQuery and applyLocalMarketplaceFiltersAndSort filter and sort accurately', () => {
  assert.equal(filterProductsByQuery(SAMPLE_PRODUCTS, '').length, 3);
  assert.deepEqual(
    filterProductsByQuery(SAMPLE_PRODUCTS, '  laptop ').map((p) => p.id),
    ['1']
  );

  // Newest first
  assert.deepEqual(
    applyLocalMarketplaceFiltersAndSort(SAMPLE_PRODUCTS, { sortBy: 'newest' }).map(
      (p) => p.id
    ),
    ['2', '3', '1']
  );

  // Most Contacted
  assert.deepEqual(
    applyLocalMarketplaceFiltersAndSort(SAMPLE_PRODUCTS, {
      sortBy: 'most_contacted',
    }).map((p) => p.id),
    ['2', '3', '1']
  );

  // Price low to high
  assert.deepEqual(
    applyLocalMarketplaceFiltersAndSort(SAMPLE_PRODUCTS, {
      sortBy: 'price_asc',
    }).map((p) => p.id),
    ['2', '1', '3']
  );

  // Category & Subcategory filter
  assert.deepEqual(
    applyLocalMarketplaceFiltersAndSort(SAMPLE_PRODUCTS, {
      categoryId: 'books',
      subcategory: 'Textbooks & Handouts',
    }).map((p) => p.id),
    ['2']
  );

  assert.equal(hasActiveMarketplaceFilters({}), false);
  assert.equal(hasActiveMarketplaceFilters({ sortBy: 'newest' }), false);
  assert.equal(hasActiveMarketplaceFilters({ sortBy: 'most_contacted' }), true);
  assert.equal(hasActiveMarketplaceFilters({ categoryId: 'electronics' }), true);
});

test('applyLocalMarketplaceFiltersAndSort excludes accommodation listings from marketplace', () => {
  const withHouse: Product[] = [
    ...SAMPLE_PRODUCTS,
    {
      id: 'house-1',
      sellerId: 'landlord',
      adType: 'item',
      title: 'Modern Self-Contain Near LASUED Gate',
      description: 'Self-contain apartment',
      priceType: 'fixed',
      price: 180000,
      priceUnit: 'total',
      categoryId: 'accommodation',
      subcategory: 'Self-Contain',
      images: [],
      quantity: 1,
      locationName: 'Odo-Egiri Road',
      hasDelivery: false,
      viewCount: 50,
      contactCount: 10,
      whatsappNumber: '2348031234567',
      status: 'active',
      isApproved: true,
      isActive: true,
      createdAt: 999,
    },
  ];

  const filtered = applyLocalMarketplaceFiltersAndSort(withHouse, {});
  assert.ok(filtered.every((item) => item.categoryId !== 'accommodation'));
  assert.equal(filtered.length, 3);
});
