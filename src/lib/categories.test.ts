import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_MARKETPLACE_CATEGORIES,
  getCategoriesForAdType,
  getCategoryById,
  getCategoryName,
  getSubcategoriesForCategory,
  PRODUCT_CATEGORIES,
  SERVICE_CATEGORIES,
} from './categories';

test('PRODUCT_CATEGORIES and SERVICE_CATEGORIES contain strict split categories with subcategories', () => {
  assert.equal(PRODUCT_CATEGORIES.length, 5);
  assert.deepEqual(
    PRODUCT_CATEGORIES.map((c) => c.id),
    ['electronics', 'fashion', 'books', 'hostel', 'food']
  );

  assert.equal(SERVICE_CATEGORIES.length, 6);
  assert.deepEqual(
    SERVICE_CATEGORIES.map((c) => c.id),
    ['tech_repairs', 'beauty', 'cyber', 'creative', 'everyday', 'academics']
  );

  assert.equal(ALL_MARKETPLACE_CATEGORIES.length, 11);
  assert.ok(ALL_MARKETPLACE_CATEGORIES.every((c) => c.id !== 'accommodation'));

  for (const cat of ALL_MARKETPLACE_CATEGORIES) {
    assert.ok(cat.name.length > 0);
    assert.ok(cat.subs.length > 0);
  }
});

test('getCategoriesForAdType and category lookup helpers return expected values', () => {
  assert.equal(getCategoriesForAdType('item'), PRODUCT_CATEGORIES);
  assert.equal(getCategoriesForAdType('service'), SERVICE_CATEGORIES);
  assert.equal(getCategoryById('electronics')?.name, 'Electronics & Gadgets');
  assert.equal(getCategoryName('tech_repairs'), 'Tech & Repairs');
  assert.equal(getCategoryName('unknown_id'), 'unknown_id');
  assert.ok(
    getSubcategoriesForCategory('electronics').includes('Laptops & Computers')
  );
  assert.deepEqual(getSubcategoriesForCategory('missing'), []);
});
