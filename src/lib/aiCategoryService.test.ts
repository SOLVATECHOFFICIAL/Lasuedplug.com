import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CATEGORY_SUGGESTION,
  getCategoryCacheKey,
  getDefaultCategorySuggestion,
  MARKETPLACE_CATEGORIES,
  parseCategorySuggestion,
  readCachedCategorySuggestion,
  suggestCategory,
  writeCachedCategorySuggestion,
} from './aiCategoryService';
import { PRODUCT_CATEGORIES, SERVICE_CATEGORIES } from './categories';
import { dataUrlToInlinePart } from './imageUtils';

test('MARKETPLACE_CATEGORIES splits into 5 product and 6 service categories excluding accommodation', () => {
  assert.ok(MARKETPLACE_CATEGORIES.every((cat) => cat.id !== 'accommodation'));
  assert.equal(MARKETPLACE_CATEGORIES.length, 11);
  assert.equal(PRODUCT_CATEGORIES.length, 5);
  assert.equal(SERVICE_CATEGORIES.length, 6);
});

test('parseCategorySuggestion respects product vs service category lists', () => {
  const laptop = parseCategorySuggestion(
    'electronics|Laptops & Computers',
    PRODUCT_CATEGORIES
  );
  assert.deepEqual(laptop, {
    categoryId: 'electronics',
    subcategory: 'Laptops & Computers',
  });

  const wrapped = parseCategorySuggestion(
    '```\nfashion|Shoes & Sneakers\n```',
    PRODUCT_CATEGORIES
  );
  assert.deepEqual(wrapped, {
    categoryId: 'fashion',
    subcategory: 'Shoes & Sneakers',
  });

  // Service category should only match SERVICE_CATEGORIES, not PRODUCT_CATEGORIES
  assert.equal(
    parseCategorySuggestion('beauty|Hair Styling', PRODUCT_CATEGORIES),
    null
  );
  assert.deepEqual(
    parseCategorySuggestion('beauty|Hair Styling', SERVICE_CATEGORIES),
    {
      categoryId: 'beauty',
      subcategory: 'Hair Styling',
    }
  );

  // Never allows accommodation in marketplace categories
  assert.equal(
    parseCategorySuggestion('accommodation|Self-Contain', PRODUCT_CATEGORIES),
    null
  );
  assert.equal(parseCategorySuggestion('invalid_format'), null);
});

test('suggestCategory falls back cleanly to matching adType default category when API key is missing', async () => {
  const itemResult = await suggestCategory('HP Laptop', 'Core i5 8GB RAM', 'item');
  assert.deepEqual(itemResult.suggestion, DEFAULT_CATEGORY_SUGGESTION);
  assert.equal(itemResult.isFallback, true);

  const serviceResult = await suggestCategory(
    'Hair Braiding',
    'Neat knotless braids on campus',
    'service'
  );
  assert.deepEqual(serviceResult.suggestion, getDefaultCategorySuggestion('service'));
  assert.equal(serviceResult.isFallback, true);
});

test('category localStorage caching stores and reads ai_cat_<title> suggestions cleanly', async () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  assert.equal(getCategoryCacheKey('Nike Sneakers', 'Size 43'), 'ai_cat_Nike Sneakers');
  assert.equal(
    readCachedCategorySuggestion('Nike Sneakers', 'Size 43', PRODUCT_CATEGORIES, mockStorage),
    null
  );

  writeCachedCategorySuggestion(
    'Nike Sneakers',
    'Size 43',
    { categoryId: 'fashion', subcategory: 'Shoes & Sneakers' },
    mockStorage
  );

  assert.deepEqual(
    readCachedCategorySuggestion('Nike Sneakers', 'Size 43', PRODUCT_CATEGORIES, mockStorage),
    { categoryId: 'fashion', subcategory: 'Shoes & Sneakers' }
  );

  // Cross-type mismatch returns null safely if cached item category is checked against service categories
  assert.equal(
    readCachedCategorySuggestion('Nike Sneakers', 'Size 43', SERVICE_CATEGORIES, mockStorage),
    null
  );

  const prevLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: mockStorage,
  });
  try {
    const cached = await suggestCategory('Nike Sneakers', 'Size 43', 'item');
    assert.deepEqual(cached.suggestion, {
      categoryId: 'fashion',
      subcategory: 'Shoes & Sneakers',
    });
    assert.equal(cached.isFallback, false);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: prevLocalStorage,
    });
  }
});

test('dataUrlToInlinePart extracts mimeType and raw base64 data from compressed Data URL', () => {
  const part = dataUrlToInlinePart('data:image/webp;base64,UklGRh4AAABXRUJQ');
  assert.deepEqual(part, {
    mimeType: 'image/webp',
    data: 'UklGRh4AAABXRUJQ',
  });
});
