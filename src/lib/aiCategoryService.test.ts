import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CATEGORY_SUGGESTION,
  getDefaultCategorySuggestion,
  MARKETPLACE_CATEGORIES,
  parseCategorySuggestion,
  suggestCategory,
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
  const itemResult = await suggestCategory('HP Laptop', 'Core i5 8GB RAM', undefined, 'item');
  assert.deepEqual(itemResult.suggestion, DEFAULT_CATEGORY_SUGGESTION);
  assert.equal(itemResult.isFallback, true);

  const serviceResult = await suggestCategory(
    'Hair Braiding',
    'Neat knotless braids on campus',
    undefined,
    'service'
  );
  assert.deepEqual(serviceResult.suggestion, getDefaultCategorySuggestion('service'));
  assert.equal(serviceResult.isFallback, true);
});

test('dataUrlToInlinePart extracts mimeType and raw base64 data from compressed Data URL', () => {
  const part = dataUrlToInlinePart('data:image/webp;base64,UklGRh4AAABXRUJQ');
  assert.deepEqual(part, {
    mimeType: 'image/webp',
    data: 'UklGRh4AAABXRUJQ',
  });
});
