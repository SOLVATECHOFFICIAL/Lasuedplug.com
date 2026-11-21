import { memo, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Share2, Store as StoreIcon } from 'lucide-react';
import { Store } from '../../types';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { shareListing } from '../../lib/shareUtils';
import { warmImages } from '../../lib/imageCache';
import { primeStoreIntoCache } from '../../lib/syncCache';
import { Card } from '../ui/Card';
import { StarRating } from '../ui/StarRating';
import { UserAvatar } from '../ui/UserAvatar';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { ProductImage } from './ProductImage';

interface StoreCardProps {
  store: Store;
  isVerifiedOwner?: boolean;
  priority?: boolean;
  className?: string;
}

export const StoreCard = memo(function StoreCard({
  store,
  isVerifiedOwner,
  priority = false,
  className = '',
}: StoreCardProps) {
  const storeHref = store.id ? `/store/${store.id}` : '/services?tab=stores';
  const verified = Boolean(isVerifiedOwner ?? store.ownerSnapshot?.isVerified);

  const storePrimaryImage = store.images?.[0] || store.logoUrl;

  const handleWarmEntity = () => {
    primeStoreIntoCache(store, { idbOnly: true });
    warmImages(
      store.images && store.images.length > 0 ? store.images : [store.logoUrl],
      4
    );
  };

  const handleTrackClick = () => {
    handleWarmEntity();
    if (!store.id) return;
    saveRecentlyViewed({
      id: store.id,
      _type: 'store',
      title: store.name,
      subtitle: store.category || 'Campus Store',
      priceLabel: store.openingHours?.trim() || store.locationName || 'Storefront',
      imageUrl: storePrimaryImage,
      href: `/store/${store.id}`,
      isVerified: verified,
    });
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${storeHref}`
      : storeHref;

  const handleShareClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void shareListing(store.name, 'Business', 'Store', shareUrl);
  };

  return (
    <div className={`relative group h-full ${className}`.trim()}>
      <Link
        to={storeHref}
        onClick={handleTrackClick}
        onMouseEnter={handleWarmEntity}
        onTouchStart={handleWarmEntity}
        onFocus={handleWarmEntity}
        className="block h-full focus:outline-none"
      >
        <Card
          padded={false}
          className="h-full overflow-hidden flex flex-col justify-between group-focus-visible:ring-2 group-focus-visible:ring-blue-500"
        >
        <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
          <ProductImage
            src={storePrimaryImage}
            alt={store.name}
            priority={priority}
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
              {store.subcategory
                ? `${store.category || 'Campus Store'} · ${store.subcategory}`
                : store.category || 'Campus Store'}
            </p>
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                {store.name}
              </h3>
              {verified && (
                <VerifiedBadge
                  size="xs"
                  accountType={store.ownerSnapshot?.accountType}
                />
              )}
            </div>

            {(store.ownerSnapshot?.fullName || store.ownerId) && (
              <p className="text-xs text-slate-600 flex items-center gap-1.5 min-w-0">
                <UserAvatar
                  uid={store.ownerId}
                  src={store.ownerSnapshot?.profilePic}
                  name={store.ownerSnapshot?.fullName || store.name}
                  size="2xs"
                />
                <span className="truncate">
                  {store.ownerSnapshot?.fullName || 'Campus Store Owner'}
                </span>
              </p>
            )}

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

      <button
        type="button"
        onClick={handleShareClick}
        aria-label={`Share ${store.name}`}
        title="Share store"
        className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 border border-slate-200/90 shadow-sm backdrop-blur-sm flex items-center justify-center transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
});
