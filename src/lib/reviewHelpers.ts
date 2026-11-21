import { Review } from '../types';
import { getTimestampMillis } from './homeHelpers';

export interface ReviewStats {
  trustScore: number;
  reviewCount: number;
}

export function calculateReviewStats(
  reviews: ReadonlyArray<Pick<Review, 'rating'>>
): ReviewStats {
  const validRatings = reviews
    .map((r) => Number(r.rating))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);

  if (validRatings.length === 0) {
    return { trustScore: 0, reviewCount: 0 };
  }

  const sum = validRatings.reduce((acc, val) => acc + val, 0);
  const avg = Math.round((sum / validRatings.length) * 10) / 10;

  return {
    trustScore: avg,
    reviewCount: validRatings.length,
  };
}

export function validateReviewInput(input: {
  targetId: string;
  reviewerId: string;
  rating: number;
  comment: string;
}): string | null {
  if (!input.targetId.trim()) {
    return 'Review target is missing.';
  }
  if (!input.reviewerId.trim()) {
    return 'Please login to submit a review.';
  }
  if (
    !Number.isFinite(input.rating) ||
    input.rating < 1 ||
    input.rating > 5
  ) {
    return 'Please select a star rating between 1 and 5.';
  }
  if (!input.comment.trim() || input.comment.trim().length < 3) {
    return 'Please write a brief review comment (at least 3 characters).';
  }
  return null;
}

export function sortReviewsNewestFirst(reviews: Review[]): Review[] {
  return [...reviews].sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
  );
}
