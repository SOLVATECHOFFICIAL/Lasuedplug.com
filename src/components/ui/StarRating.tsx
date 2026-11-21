import { Star } from 'lucide-react';

interface StarRatingProps {
  rating?: number | null;
  reviewCount?: number | null;
  size?: 'xs' | 'sm' | 'md';
  showText?: boolean;
  interactive?: boolean;
  onChange?: (nextRating: number) => void;
  className?: string;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

export function StarRating({
  rating = 0,
  reviewCount = 0,
  size = 'sm',
  showText = true,
  interactive = false,
  onChange,
  className = '',
}: StarRatingProps) {
  const safeRating =
    typeof rating === 'number' && Number.isFinite(rating)
      ? Math.min(5, Math.max(0, rating))
      : 0;
  const safeCount =
    typeof reviewCount === 'number' && Number.isFinite(reviewCount)
      ? Math.max(0, Math.floor(reviewCount))
      : 0;
  const starClass = SIZE_CLASSES[size];

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      aria-label={`Rated ${safeRating.toFixed(1)} out of 5 from ${safeCount} ${
        safeCount === 1 ? 'review' : 'reviews'
      }`}
    >
      <div className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const fillRatio = Math.min(
            1,
            Math.max(0, safeRating - (starIndex - 1))
          );

          if (interactive) {
            const isSelected = safeRating >= starIndex;
            return (
              <button
                key={starIndex}
                type="button"
                onClick={() => onChange?.(starIndex)}
                aria-label={`Rate ${starIndex} ${starIndex === 1 ? 'star' : 'stars'}`}
                className="p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-amber-400 transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`${starClass} ${
                    isSelected
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300 hover:text-amber-300'
                  }`}
                />
              </button>
            );
          }

          return (
            <span
              key={starIndex}
              className={`relative inline-block ${starClass}`}
              aria-hidden="true"
            >
              <Star className={`${starClass} text-slate-300`} />
              {fillRatio > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${Math.round(fillRatio * 100)}%` }}
                >
                  <Star className={`${starClass} fill-amber-400 text-amber-400`} />
                </span>
              )}
            </span>
          );
        })}
      </div>

      {showText && (
        <span
          className={`tabular-nums text-slate-600 ${
            size === 'xs' ? 'text-[11px]' : 'text-xs sm:text-sm'
          }`}
        >
          <span className="font-semibold text-slate-900">
            {safeRating.toFixed(1)}
          </span>{' '}
          <span className="text-slate-500">
            ({safeCount} {safeCount === 1 ? 'review' : 'reviews'})
          </span>
        </span>
      )}
    </div>
  );
}
