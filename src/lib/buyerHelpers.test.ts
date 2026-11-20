import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFavoriteDocId,
  formatEnquiryDate,
  sortByCreatedAtDesc,
} from './buyerHelpers';

test('buildFavoriteDocId builds deterministic composite doc ID', () => {
  assert.equal(buildFavoriteDocId(' user-1 ', ' item-9 '), 'user-1_item-9');
});

test('sortByCreatedAtDesc orders newer timestamps first', () => {
  const sorted = sortByCreatedAtDesc([
    { id: 'old', createdAt: 1000 },
    { id: 'newest', createdAt: { toMillis: () => 5000 } },
    { id: 'mid', createdAt: { seconds: 3 } },
  ]);
  assert.deepEqual(
    sorted.map((x) => x.id),
    ['newest', 'mid', 'old']
  );
});

test('formatEnquiryDate handles missing and valid timestamps cleanly', () => {
  assert.equal(formatEnquiryDate(null), 'Just now');
  const formatted = formatEnquiryDate(new Date('2026-11-20T10:00:00Z'));
  assert.ok(formatted.includes('2026'));
});
