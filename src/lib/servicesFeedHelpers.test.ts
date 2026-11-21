import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMixedServicesAndStoresFeed,
  doesStoreMatchServiceCategory,
} from './servicesFeedHelpers';
import { Product, Service, Store } from '../types';

const sampleProductService: Product = {
  id: 'svc-prod-1',
  sellerId: 'u1',
  adType: 'service',
  title: 'Laptop Screen & OS Repair',
  description: 'Fast diagnosis and Windows setup',
  categoryId: 'tech_repairs',
  subcategory: 'Laptop Repairs',
  images: [],
  priceType: 'contact',
  whatsappNumber: '2348011111111',
  viewCount: 5,
  contactCount: 1,
  isApproved: true,
  isActive: true,
  createdAt: 200,
};

const sampleLegacyService: Service = {
  id: 'svc-leg-1',
  providerId: 'u2',
  title: 'Express Laundry & Ironing',
  description: 'Same-day hostel pickup',
  categoryId: 'everyday',
  subcategory: 'Laundry & Ironing',
  images: [],
  viewCount: 3,
  contactCount: 0,
  isApproved: true,
  isActive: true,
  createdAt: 100,
};

const sampleStore: Store = {
  id: 'store-1',
  ownerId: 'u3',
  name: 'Apex Print & Cyber Cafe',
  description: 'Printing, binding, and cloth tailoring',
  category: 'Cyber & Printing',
  subcategory: 'Printing & Binding',
  locationName: 'LASUED Main Gate',
  whatsappNumber: '2348033333333',
  isApproved: true,
  isActive: true,
  createdAt: 300,
};

test('buildMixedServicesAndStoresFeed mixes services and stores sorted newest first', () => {
  const mixed = buildMixedServicesAndStoresFeed({
    productServices: [sampleProductService],
    legacyServices: [sampleLegacyService],
    stores: [sampleStore],
  });

  assert.deepEqual(
    mixed.map((entry) => `${entry.kind}:${entry.id}`),
    ['store:store-1', 'product_service:svc-prod-1', 'legacy_service:svc-leg-1']
  );
});

test('buildMixedServicesAndStoresFeed supports stores-only filter, category filter, and search', () => {
  const storesOnly = buildMixedServicesAndStoresFeed({
    productServices: [sampleProductService],
    legacyServices: [sampleLegacyService],
    stores: [sampleStore],
    selectedCategory: 'stores',
  });
  assert.deepEqual(storesOnly.map((e) => e.id), ['store-1']);

  const cyberOnly = buildMixedServicesAndStoresFeed({
    productServices: [sampleProductService],
    legacyServices: [sampleLegacyService],
    stores: [sampleStore],
    selectedCategory: 'cyber',
  });
  assert.deepEqual(cyberOnly.map((e) => e.id), ['store-1']);

  const searchPrint = buildMixedServicesAndStoresFeed({
    productServices: [sampleProductService],
    legacyServices: [sampleLegacyService],
    stores: [sampleStore],
    searchQuery: 'printing',
  });
  assert.deepEqual(searchPrint.map((e) => e.id), ['store-1']);

  assert.equal(doesStoreMatchServiceCategory(sampleStore, 'cyber'), true);
  assert.equal(doesStoreMatchServiceCategory(sampleStore, 'beauty'), false);
});
