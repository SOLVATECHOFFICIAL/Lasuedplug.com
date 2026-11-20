import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractImageHint,
  findBestAndRelatedProducts,
  matchProductsBySearchKeywords,
  parseExpandedKeywords,
  parseSafeJsonResponse,
} from './aiSearchService';
import { Product } from '../types';

const TEST_PRODUCTS: Product[] = [
  {
    id: 'p1',
    sellerId: 's1',
    adType: 'item',
    title: 'Butter',
    description: 'Fresh table butter spread',
    categoryId: 'food',
    subcategory: 'Raw Foodstuff',
    images: [],
    quantity: 4,
    priceType: 'fixed',
    price: 1800,
    priceUnit: 'per_item',
    whatsappNumber: '2348067890123',
    locationName: 'Sub-Gate',
    hasDelivery: true,
    viewCount: 10,
    contactCount: 3,
    status: 'active',
    isApproved: true,
    isActive: true,
    createdAt: 100,
  },
  {
    id: 'p2',
    sellerId: 's1',
    adType: 'item',
    title: 'Akara and Bread',
    description: 'Hot akara with soft bread',
    categoryId: 'food',
    subcategory: 'Cooked Meals',
    images: [],
    quantity: 10,
    priceType: 'fixed',
    price: 700,
    priceUnit: 'per_item',
    whatsappNumber: '2348067890123',
    locationName: 'Main Gate',
    hasDelivery: true,
    viewCount: 5,
    contactCount: 1,
    status: 'active',
    isApproved: true,
    isActive: true,
    createdAt: 200,
  },
  {
    id: 'p3',
    sellerId: 's1',
    adType: 'item',
    title: 'Egg and Tea',
    description: 'Fried egg and hot tea',
    categoryId: 'food',
    subcategory: 'Cooked Meals',
    images: [],
    quantity: 5,
    priceType: 'fixed',
    price: 1000,
    priceUnit: 'per_item',
    whatsappNumber: '2348056789012',
    locationName: 'Block A',
    hasDelivery: true,
    viewCount: 8,
    contactCount: 2,
    status: 'active',
    isApproved: true,
    isActive: true,
    createdAt: 300,
  },
  {
    id: 'p4',
    sellerId: 's2',
    adType: 'item',
    title: 'HP Laptop',
    description: 'Core i5 laptop',
    categoryId: 'electronics',
    subcategory: 'Laptops & Computers',
    images: [],
    quantity: 1,
    priceType: 'fixed',
    price: 45000,
    priceUnit: 'total',
    whatsappNumber: '2348012345678',
    locationName: 'Shop 4',
    hasDelivery: false,
    viewCount: 20,
    contactCount: 4,
    status: 'active',
    isApproved: true,
    isActive: true,
    createdAt: 400,
  },
];

test('parseExpandedKeywords parses comma-separated Gemini responses cleanly up to 8 items', () => {
  assert.deepEqual(
    parseExpandedKeywords('butter, akara, egg, tea, jam'),
    ['butter', 'akara', 'egg', 'tea', 'jam']
  );

  assert.deepEqual(
    parseExpandedKeywords('```\n"iphone", Android, charger, case, screen protector, battery\n```'),
    ['iphone', 'Android', 'charger', 'case', 'screen protector', 'battery']
  );

  assert.deepEqual(parseExpandedKeywords(''), []);
});

test('matchProductsBySearchKeywords ranks direct and AI-expanded matches cleanly', () => {
  const results = matchProductsBySearchKeywords(TEST_PRODUCTS, 'eat bread', [
    'butter',
    'akara',
    'egg',
    'tea',
    'jam',
  ]);
  const ids = results.map((p) => p.id);
  assert.ok(ids.includes('p1')); // Butter
  assert.ok(ids.includes('p2')); // Akara and Bread
  assert.ok(ids.includes('p3')); // Egg and Tea
  assert.ok(!ids.includes('p4')); // HP Laptop excluded
});

test('matchProductsBySearchKeywords ignores substring false positives like eat inside great', () => {
  const candidates: Product[] = [
    ...TEST_PRODUCTS,
    {
      id: 'p5',
      sellerId: 's3',
      adType: 'item',
      title: 'Nike Sneakers',
      description: 'Great condition, breathable mesh for campus walks.',
      categoryId: 'fashion',
      subcategory: 'Shoes & Sneakers',
      images: [],
      quantity: 2,
      priceType: 'fixed',
      price: 22000,
      whatsappNumber: '2348012345678',
      locationName: 'Main Gate',
      hasDelivery: true,
      viewCount: 0,
      contactCount: 0,
      status: 'active',
      isApproved: true,
      isActive: true,
      createdAt: 500,
    },
  ];
  const results = matchProductsBySearchKeywords(candidates, 'eat bread', []);
  const ids = results.map((p) => p.id);
  assert.deepEqual(ids, ['p2']);
});

test('matchProductsBySearchKeywords tolerates misspelled queries and long compound words', () => {
  const candidates: Product[] = [
    ...TEST_PRODUCTS,
    {
      id: 'p5',
      sellerId: 's3',
      adType: 'item',
      title: 'Nike Sneakers',
      description: 'Clean white athletic footwear for campus.',
      categoryId: 'fashion',
      subcategory: 'Shoes & Sneakers',
      images: ['https://example.com/uploads/nike_running_shoes_v2.png'],
      quantity: 3,
      priceType: 'fixed',
      price: 22000,
      whatsappNumber: '2348012345678',
      locationName: 'Epe Market',
      hasDelivery: true,
      viewCount: 15,
      contactCount: 5,
      status: 'active',
      isApproved: true,
      isActive: true,
      createdAt: 500,
    },
  ];

  // Misspellings: "buter", "snikers", "laptpo"
  assert.equal(matchProductsBySearchKeywords(candidates, 'buter', [])[0]?.id, 'p1');
  assert.equal(matchProductsBySearchKeywords(candidates, 'snikers', [])[0]?.id, 'p5');
  assert.equal(matchProductsBySearchKeywords(candidates, 'laptpo', [])[0]?.id, 'p4');

  // Long compound word without space
  assert.equal(matchProductsBySearchKeywords(candidates, 'laptopcomputer', [])[0]?.id, 'p4');

  // Image filename hint extraction
  assert.equal(extractImageHint(candidates[4].images), 'nike running shoes');
});

test('findBestAndRelatedProducts never returns empty when catalog has listings', () => {
  const fallback = findBestAndRelatedProducts(TEST_PRODUCTS, 'quantumspaceship', {
    keywords: [],
    relatedIds: ['p2'],
  });
  assert.equal(fallback.usedRelatedFallback, true);
  assert.ok(fallback.products.length > 0);
  assert.equal(fallback.products[0].id, 'p2');
});

test('parseSafeJsonResponse returns null on HTML SPA fallback responses and parses valid JSON cleanly', async () => {
  const htmlResponse = new Response('<!doctype html><html><body>SPA</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  assert.equal(await parseSafeJsonResponse(htmlResponse), null);

  const mislabeledHtmlResponse = new Response('<!doctype html><html></html>', {
    status: 200,
  });
  assert.equal(await parseSafeJsonResponse(mislabeledHtmlResponse), null);

  const errorJsonResponse = new Response(JSON.stringify({ error: 'Upstream failure' }), {
    status: 502,
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(await parseSafeJsonResponse(errorJsonResponse), null);

  const validJsonResponse = new Response(
    JSON.stringify({ keywords: ['butter', 'bread'], correctedQuery: 'butter' }),
    {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  );
  assert.deepEqual(await parseSafeJsonResponse(validJsonResponse), {
    keywords: ['butter', 'bread'],
    correctedQuery: 'butter',
  });
});
