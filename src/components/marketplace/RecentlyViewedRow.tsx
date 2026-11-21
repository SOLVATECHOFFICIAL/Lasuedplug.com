import { memo } from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { getFastCache } from '../../lib/fastCache';
import { warmImages } from '../../lib/imageCache';
import { RecentlyViewedItem } from '../../lib/recentlyViewed';
import { Card } from '../ui/Card';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { ProductImage } from './ProductImage';

interface RecentlyViewedRowProps {
  items: RecentlyViewedItem[];
}

const TYPE_LABEL_MAP: Record<RecentlyViewedItem['_type'], string> = {
  item: 'Item',
  service: 'Service',
  store: 'Store',
  accommodation: 'Room',
};

export const RecentlyViewedRow = memo(function RecentlyViewedRow({
  items,
}: RecentlyViewedRowProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Recently viewed listings"
      className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 pt-6 pb-2 space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Jump Back In
          </h2>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">Recently viewed</span>
      </div>

      <div className="flex gap-3.5 overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar">
        {items.map((item) => {
          const handleWarmItem = () => {
            if (item.imageUrl) {
              warmImages([item.imageUrl], 1);
            }
            const prefix =
              item._type === 'store'
                ? 'store'
                : item._type === 'accommodation'
                  ? 'accommodation'
                  : 'product';
            const cachedEntity = getFastCache<{ images?: string[] }>(
              `${prefix}:${item.id}`
            );
            if (cachedEntity?.images) {
              warmImages(cachedEntity.images, 4);
            }
          };

          return (
          <Link
            key={`${item._type}-${item.id}`}
            to={item.href}
            onMouseEnter={handleWarmItem}
            onTouchStart={handleWarmItem}
            onFocus={handleWarmItem}
            className="group shrink-0 w-44 sm:w-52 snap-start focus:outline-none"
          >
            <Card
              padded={false}
              className="h-full overflow-hidden flex flex-col group-focus-visible:ring-2 group-focus-visible:ring-blue-500"
            >
              <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                <ProductImage
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  iconClassName="w-7 h-7 text-slate-400 dark:text-slate-500"
                />
                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-100 shadow-sm">
                  {TYPE_LABEL_MAP[item._type] || 'Listing'}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between gap-1.5">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>
                    {item.isVerified && <VerifiedBadge size="xs" />}
                  </div>
                  {item.subtitle && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  )}
                </div>

                <p className="text-xs sm:text-sm font-bold text-primary-600 dark:text-blue-400 tabular-nums truncate">
                  {item.priceLabel}
                </p>
              </div>
            </Card>
          </Link>
          );
        })}
      </div>
    </section>
  );
});
