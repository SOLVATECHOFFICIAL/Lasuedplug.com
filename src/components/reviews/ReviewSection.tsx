import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquarePlus, Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getInitials } from '../../lib/authHelpers';
import { formatNotificationTime } from '../../lib/notificationHelpers';
import { submitReview } from '../../lib/reviewService';
import { Review } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StarRating } from '../ui/StarRating';
import { EmptyState } from '../feedback/EmptyState';

interface ReviewSectionProps {
  targetId: string;
  targetType: 'user' | 'store';
  targetName: string;
  ownerId?: string;
  reviews: Review[];
  trustScore: number;
  reviewCount: number;
  onReviewSubmitted: (result: {
    review: Review;
    trustScore: number;
    reviewCount: number;
  }) => void;
}

export function ReviewSection({
  targetId,
  targetType,
  targetName,
  ownerId,
  reviews,
  trustScore,
  reviewCount,
  onReviewSubmitted,
}: ReviewSectionProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isOwnTarget = Boolean(
    user?.uid && (user.uid === targetId || (ownerId && user.uid === ownerId))
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.uid || submitting) return;

    setFormError(null);
    if (comment.trim().length < 3) {
      setFormError('Please write at least 3 characters in your review.');
      return;
    }

    setSubmitting(true);
    try {
      const reviewerName =
        profile?.fullName?.trim() ||
        user.displayName?.trim() ||
        user.email?.split('@')[0] ||
        'LASUEDPLUG Student';

      const result = await submitReview(
        targetId,
        targetType,
        user.uid,
        reviewerName,
        rating,
        comment
      );

      setComment('');
      setRating(5);
      onReviewSubmitted(result);
      showToast('Review submitted! Trust score updated.', 'success');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to submit review. Please try again.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label="Reviews and Ratings" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Reviews &amp; Trust Score
          </h2>
          <p className="text-sm text-slate-600">
            Verified student feedback for {targetName}.
          </p>
        </div>
        <StarRating rating={trustScore} reviewCount={reviewCount} size="md" />
      </div>

      {/* Leave a Review Form (only visible to logged-in users) */}
      {user ? (
        isOwnTarget ? (
          <Card hoverable={false} className="bg-slate-50 border-slate-200 p-4">
            <p className="text-xs sm:text-sm text-slate-600">
              You cannot leave a review on your own{' '}
              {targetType === 'store' ? 'store' : 'profile'}.
            </p>
          </Card>
        ) : (
          <Card hoverable={false} className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-primary-600" />
              <h3 className="text-base font-bold text-slate-900">
                Leave a Review
              </h3>
            </div>

            {formError && (
              <p
                role="alert"
                className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                {formError}
              </p>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-700">
                  Your Rating
                </span>
                <div className="flex items-center gap-3">
                  <StarRating
                    rating={rating}
                    interactive
                    showText={false}
                    size="md"
                    onChange={setRating}
                  />
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    {rating} / 5
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="review-comment"
                  className="block text-sm font-medium text-slate-700"
                >
                  Your Experience
                </label>
                <textarea
                  id="review-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder={`Share how dealing with ${targetName} went...`}
                  className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Review</span>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        )
      ) : (
        <Card hoverable={false} className="bg-slate-50 border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Have you bought from {targetName}? Log in to leave a review.
          </p>
          <Link to="/login">
            <Button variant="outline" size="sm">
              Login to Review
            </Button>
          </Link>
        </Card>
      )}

      {/* Existing Reviews List */}
      {reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No reviews yet"
          description={`Be the first student to rate and review ${targetName}.`}
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const reviewerInitials = getInitials(review.reviewerName, null);
            return (
              <Card
                key={review.id || `${review.reviewerId}-${review.comment.slice(0, 12)}`}
                hoverable={false}
                className="p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {reviewerInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {review.reviewerName || 'Campus Member'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatNotificationTime(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <StarRating
                    rating={review.rating}
                    showText={false}
                    size="xs"
                    className="shrink-0"
                  />
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {review.comment}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
