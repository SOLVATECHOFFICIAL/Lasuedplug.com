import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Store as StoreIcon } from 'lucide-react';
import { Store } from '../../types';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { Card } from '../ui/Card';
import { StarRating } from '../ui/StarRating';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { ProductImage } from './ProductImage';

interface StoreCardProps {
  store: Store;
  isVerifiedOwner?: boolean;
  className?: string;
}

export const StoreCard = memo(function StoreCard({
  store,
  isVerifiedOwner,
  className = '',
}: StoreCardProps) {
  const storeHref = store.id ? `/store/${store.id}` : '/marketplace?tab=stores';
  const verified = Boolean(isVerifiedOwner ?? store.ownerSnapshot?.isVerified);

  const handleTrackClick = () => {
    if (!store.id) return;
    saveRecentlyViewed({
      id: store.id,
      _type: 'store',
      title: store.name,
      subtitle: store.category || 'Campus Store',
      priceLabel: store.openingHours?.trim() || store.locationName || 'Storefront',
      imageUrl: store.logoUrl,
      href: `/store/${store.id}`,
      isVerified: verified,
    });
  };

  return (
    <Link
      to={storeHref}
      onClick={handleTrackClick}
      className={`group block h-full focus:outline-none ${className}`.trim()}
    >
      <Card
        padded={false}
        className="h-full overflow-hidden flex flex-col justify-between group-focus-visible:ring-2 group-focus-visible:ring-blue-500"
      >
        <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
          <ProductImage
            src={store.logoUrl}
            alt={store.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            iconClassName="w-10 h-10 text-slate-400"
          />
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/95 text-slate-800 border border-slate-200 shadow-sm backdrop-blur-sm">
            <StoreIcon className="w-3 h-3 text-primary-600 shrink-0" aria-hidden="true" />
            <span>Store</span>
          </span>
        </div>

        <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">
              {store.category || 'Campus Store'}
            </p>
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                {store.name}
              </h3>
              {verified && <VerifiedBadge size="xs" />}
            </div>

            <StarRating
              rating={store.trustScore ?? 0}
              reviewCount={store.reviewCount ?? 0}
              size="xs"
            />

            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
              {store.description}
            </p>

            {store.openingHours?.trim() && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5 truncate">
                <Clock className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate">{store.openingHours.trim()}</span>
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 min-w-0 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{store.locationName || 'Campus'}</span>
            </span>
            <span className="text-xs font-semibold text-blue-600 shrink-0">
              Visit store →
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
});
