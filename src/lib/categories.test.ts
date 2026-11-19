import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCategoryById,
  getCategoryName,
  getSubcategoriesForCategory,
  MASTER_CATEGORIES,
} from './categories';

test('MASTER_CATEGORIES contains all 12 strict categories with subcategories', () => {
  assert.equal(MASTER_CATEGORIES.length, 12);
  const ids = MASTER_CATEGORIES.map((c) => c.id);
  assert.deepEqual(ids, [
    'electronics',
    'fashion',
    'books',
    'hostel',
    'food',
    'cyber',
    'tech_repairs',
    'beauty',
    'creative',
    'everyday',
    'academics',
    'accommodation',
  ]);
  for (const cat of MASTER_CATEGORIES) {
    assert.ok(cat.name.length > 0);
    assert.ok(cat.subs.length > 0);
  }
});

test('category lookup helpers return expected names and subcategories', () => {
  assert.equal(getCategoryById('electronics')?.name, 'Electronics & Gadgets');
  assert.equal(getCategoryName('tech_repairs'), 'Tech & Repairs');
  assert.equal(getCategoryName('unknown_id'), 'unknown_id');
  assert.ok(
    getSubcategoriesForCategory('electronics').includes('Laptops & Computers')
  );
  assert.deepEqual(getSubcategoriesForCategory('missing'), []);
});
