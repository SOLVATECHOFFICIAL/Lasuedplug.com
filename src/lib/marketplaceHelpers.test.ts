import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLocalMarketplaceFiltersAndSort,
  buildAdminWhatsAppUrl,
  buildProductWhatsAppUrl,
  filterProductsByQuery,
  formatNigerianWhatsAppDigits,
  getPriceUnitLabel,
  getPriceUnitSuffix,
  getProductLocationLabel,
  getProductPriceDisplay,
  hasActiveMarketplaceFilters,
} from './marketplaceHelpers';
import { Product } from '../types';

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: '1',
    sellerId: 's1',
    title: 'HP Pavilion Laptop',
    description: 'Clean laptop',
    priceType: 'fixed',
    price: 45000,
    priceUnit: 'total',
    categoryId: 'electronics',
    subcategory: 'Laptops & Computers',
    images: [],
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
    title: 'Used Calculus Textbook',
    description: 'Clean book',
    priceType: 'negotiable',
    price: 2500,
    priceUnit: 'total',
    categoryId: 'books',
    subcategory: 'Textbooks & Handouts',
    images: [],
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
    title: 'Phone Charging Service',
    description: 'Fast charging station',
    priceType: 'contact',
    priceUnit: 'per_day',
    categoryId: 'tech_repairs',
    subcategory: 'Phone Charging Services',
    images: [],
    locationName: 'Opposite Main Gate',
    hasDelivery: false,
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

test('price unit helpers and getProductPriceDisplay format units properly', () => {
  assert.equal(getPriceUnitSuffix('total'), '');
  assert.equal(getPriceUnitSuffix('per_day'), '/ day');
  assert.equal(getPriceUnitSuffix('per_hour'), '/ hour');
  assert.equal(getPriceUnitSuffix('per_item'), '/ item');
  assert.equal(getPriceUnitLabel('per_day'), 'per day');

  const fixed = getProductPriceDisplay({
    priceType: 'fixed',
    price: 45000,
    priceUnit: 'total',
  });
  assert.equal(fixed.isContact, false);
  assert.ok(fixed.text.includes('45,000'));
  assert.ok(!fixed.text.includes('/'));

  const perDay = getProductPriceDisplay({
    priceType: 'fixed',
    price: 200,
    priceUnit: 'per_day',
  });
  assert.ok(perDay.text.includes('200'));
  assert.ok(perDay.text.endsWith('/ day'));

  const negotiable = getProductPriceDisplay({
    priceType: 'negotiable',
    price: 2500,
    priceUnit: 'total',
  });
  assert.ok(negotiable.text.includes('2,500'));
  assert.ok(negotiable.text.includes('(Negotiable)'));

  const contact = getProductPriceDisplay({
    priceType: 'contact',
    priceUnit: 'per_day',
  });
  assert.equal(contact.isContact, true);
  assert.equal(contact.text, 'Contact for Price');
  assert.equal(contact.unitSuffix, '/ day');
});

test('getProductLocationLabel falls back cleanly to Online/Delivery', () => {
  assert.equal(
    getProductLocationLabel({ locationName: 'Shop 4, LASUED Gate' }),
    'Shop 4, LASUED Gate'
  );
  assert.equal(
    getProductLocationLabel({ location: 'Epe Campus' }),
    'Epe Campus'
  );
  assert.equal(getProductLocationLabel({}), 'Online/Delivery');
});

test('filterProductsByQuery and applyLocalMarketplaceFiltersAndSort filter and sort accurately including most_contacted', () => {
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

  // Price high to low
  assert.deepEqual(
    applyLocalMarketplaceFiltersAndSort(SAMPLE_PRODUCTS, {
      sortBy: 'price_desc',
    }).map((p) => p.id),
    ['1', '2', '3']
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
