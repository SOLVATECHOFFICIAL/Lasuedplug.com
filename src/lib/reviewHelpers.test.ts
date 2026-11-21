import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReviewStats,
  sortReviewsNewestFirst,
  validateReviewInput,
} from './reviewHelpers';
import { Review } from '../types';

test('calculateReviewStats computes rounded average trustScore and reviewCount', () => {
  assert.deepEqual(calculateReviewStats([]), {
    trustScore: 0,
    reviewCount: 0,
  });

  assert.deepEqual(
    calculateReviewStats([{ rating: 5 }, { rating: 4 }, { rating: 4 }]),
    { trustScore: 4.3, reviewCount: 3 }
  );

  assert.deepEqual(
    calculateReviewStats([{ rating: 5 }, { rating: 4 }]),
    { trustScore: 4.5, reviewCount: 2 }
  );

  assert.deepEqual(
    calculateReviewStats([
      { rating: 5 },
      { rating: 0 },
      { rating: 6 },
      { rating: Number.NaN },
      { rating: 3 },
    ]),
    { trustScore: 4, reviewCount: 2 }
  );
});

test('validateReviewInput checks required target, reviewer, star range, and comment length', () => {
  assert.ok(
    validateReviewInput({
      targetId: '',
      reviewerId: 'u1',
      rating: 5,
      comment: 'Great seller',
    })
  );
  assert.ok(
    validateReviewInput({
      targetId: 't1',
      reviewerId: ' ',
      rating: 5,
      comment: 'Great seller',
    })
  );
  assert.ok(
    validateReviewInput({
      targetId: 't1',
      reviewerId: 'u1',
      rating: 0,
      comment: 'Great seller',
    })
  );
  assert.ok(
    validateReviewInput({
      targetId: 't1',
      reviewerId: 'u1',
      rating: 4,
      comment: 'Ok',
    })
  );
  assert.equal(
    validateReviewInput({
      targetId: 't1',
      reviewerId: 'u1',
      rating: 5,
      comment: 'Fast delivery and genuine product.',
    }),
    null
  );
});

test('sortReviewsNewestFirst orders reviews descending by createdAt', () => {
  const older: Review = {
    id: 'r1',
    targetId: 's1',
    targetType: 'store',
    reviewerId: 'u1',
    reviewerName: 'Ada',
    rating: 4,
    comment: 'Good service',
    createdAt: { seconds: 100 },
  };
  const newer: Review = {
    id: 'r2',
    targetId: 's1',
    targetType: 'store',
    reviewerId: 'u2',
    reviewerName: 'Tunde',
    rating: 5,
    comment: 'Super fast!',
    createdAt: { seconds: 300 },
  };
  const sorted = sortReviewsNewestFirst([older, newer]);
  assert.deepEqual(
    sorted.map((r) => r.id),
    ['r2', 'r1']
  );
});
