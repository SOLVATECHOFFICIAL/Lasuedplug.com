import {
  addDoc,
  collection,
  doc,
  FirestoreError,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  getFastCacheEnvelope,
  invalidateFastCache,
  invalidateFastCachePrefix,
  setFastCache,
} from './fastCache';
import { runDeduplicatedQuery } from './firestoreQueryCache';
import { REVIEWS_FRESH_MS } from './syncCache';
import { Review } from '../types';
import {
  calculateReviewStats,
  ReviewStats,
  sortReviewsNewestFirst,
  validateReviewInput,
} from './reviewHelpers';

function mapReviewError(err: unknown, fallback: string): Error {
  const firestoreErr = err as FirestoreError;
  if (firestoreErr?.code === 'unavailable') {
    return new Error(
      'Could not reach the database. Check your internet connection and try again.'
    );
  }
  if (firestoreErr?.code === 'permission-denied') {
    return new Error(
      'Permission denied while saving review. Make sure you are signed in and Firestore rules are deployed.'
    );
  }
  if (err instanceof Error && err.message) {
    return err;
  }
  return new Error(fallback);
}

export async function fetchReviewsForTarget(
  targetId: string,
  targetType?: 'user' | 'store',
  options?: { force?: boolean }
): Promise<Review[]> {
  const cleanId = targetId.trim();
  if (!cleanId) {
    return [];
  }

  const cacheKey = `reviews:${targetType || 'all'}:${cleanId}`;
  if (!options?.force) {
    const cached = getFastCacheEnvelope<Review[]>(cacheKey, REVIEWS_FRESH_MS);
    if (cached) {
      return cached.data;
    }
  }

  if (!db) {
    return [];
  }

  return runDeduplicatedQuery(cacheKey, async () => {
    try {
      const colRef = collection(db!, 'reviews');
      const q = query(colRef, where('targetId', '==', cleanId));
      const snapshot = await getDocs(q);

      const items = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Review, 'id'>),
        }))
        .filter((r) => (targetType ? r.targetType === targetType : true));

      const sorted = sortReviewsNewestFirst(items);
      setFastCache(cacheKey, sorted, { idbOnly: true });
      return sorted;
    } catch (err) {
      const stale = getFastCacheEnvelope<Review[]>(cacheKey, 0);
      if (stale) {
        return stale.data;
      }
      throw mapReviewError(err, 'Unable to load reviews right now.');
    }
  });
}

export async function submitReview(
  targetId: string,
  targetType: 'user' | 'store',
  reviewerId: string,
  reviewerName: string,
  rating: number,
  comment: string
): Promise<{ review: Review } & ReviewStats> {
  if (!db) {
    throw new Error('Firebase is not configured. Check .env.local.');
  }

  const cleanTargetId = targetId.trim();
  const cleanReviewerId = reviewerId.trim();
  const cleanReviewerName = reviewerName.trim() || 'Campus Member';
  const cleanComment = comment.trim();
  const clampedRating = Math.min(5, Math.max(1, Math.round(rating)));

  const validationError = validateReviewInput({
    targetId: cleanTargetId,
    reviewerId: cleanReviewerId,
    rating: clampedRating,
    comment: cleanComment,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const docRef = await addDoc(collection(db, 'reviews'), {
      targetId: cleanTargetId,
      targetType,
      reviewerId: cleanReviewerId,
      reviewerName: cleanReviewerName,
      rating: clampedRating,
      comment: cleanComment,
      createdAt: serverTimestamp(),
    });

    const allReviews = await fetchReviewsForTarget(cleanTargetId, targetType, {
      force: true,
    });
    const stats = calculateReviewStats(allReviews);

    const targetCollection = targetType === 'store' ? 'stores' : 'users';
    await updateDoc(doc(db, targetCollection, cleanTargetId), {
      trustScore: stats.trustScore,
      reviewCount: stats.reviewCount,
    });
    invalidateFastCachePrefix(`store_profile:${cleanTargetId}`);
    invalidateFastCachePrefix(`seller_profile:${cleanTargetId}`);
    invalidateFastCache(`store:${cleanTargetId}`);
    invalidateFastCache(`seller_public_user:${cleanTargetId}`);
    invalidateFastCache(`user_trust:${cleanTargetId}`);
    invalidateFastCachePrefix('reviews:');
    setFastCache(`reviews:${targetType}:${cleanTargetId}`, allReviews, {
      idbOnly: true,
    });
    invalidateFastCachePrefix('home_');

    return {
      review: {
        id: docRef.id,
        targetId: cleanTargetId,
        targetType,
        reviewerId: cleanReviewerId,
        reviewerName: cleanReviewerName,
        rating: clampedRating,
        comment: cleanComment,
        createdAt: new Date(),
      },
      ...stats,
    };
  } catch (err) {
    throw mapReviewError(err, 'Failed to submit review. Please try again.');
  }
}
