import { memo, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Share2, Wrench } from 'lucide-react';
import { getCategoryName } from '../../lib/categories';
import { getProductPriceDisplay } from '../../lib/marketplaceHelpers';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { formatSharePriceText, shareListing } from '../../lib/shareUtils';
import { warmImages } from '../../lib/imageCache';
import { primeProductIntoCache } from '../../lib/syncCache';
import { MixedFeedItem } from '../../lib/trendingHelpers';
import { Service } from '../../types';
import { Card } from '../ui/Card';
import { UserAvatar } from '../ui/UserAvatar';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { AccommodationCard } from './AccommodationCard';
import { ProductCard } from './ProductCard';
import { ProductImage } from './ProductImage';
import { StoreCard } from './StoreCard';

interface LegacyServiceCardProps {
  service: Service;
  isVerified?: boolean;
  priority?: boolean;
}

export const LegacyServiceCard = memo(function LegacyServiceCard({
  service,
  isVerified,
  priority = false,
}: LegacyServiceCardProps) {
  const categoryLabel = service.subcategory || getCategoryName(service.categoryId);
  const sellerName = service.sellerSnapshot?.fullName;
  const verified = Boolean(isVerified ?? service.sellerSnapshot?.isVerified);
  const priceText = service.priceRange || getProductPriceDisplay(service).text;

  const handleWarmEntity = () => {
    if (service.id) {
      primeProductIntoCache(
        {
          id: service.id,
          sellerId: service.providerId,
          adType: 'service',
          title: service.title,
          description: service.description,
          categoryId: service.categoryId,
          subcategory: service.subcategory,
          images: service.images || [],
          priceType: service.priceType || 'contact',
          price: service.price,
          priceUnit: service.priceUnit,
          whatsappNumber: service.whatsappNumber || '',
          locationName: service.locationName,
          shopName: service.shopName,
          viewCount: service.viewCount || 0,
          contactCount: service.contactCount || 0,
          status: service.status || 'available',
          isApproved: service.isApproved ?? true,
          isActive: service.isActive ?? true,
          createdAt: service.createdAt,
          sellerSnapshot: service.sellerSnapshot,
        },
        { idbOnly: true }
      );
    }
    warmImages(service.images, 4);
  };

  const handleTrackClick = () => {
    handleWarmEntity();
    if (!service.id) return;
    saveRecentlyViewed({
      id: service.id,
      _type: 'service',
      title: service.title,
      subtitle: categoryLabel || sellerName || 'Campus Service',
      priceLabel: priceText,
      imageUrl: service.images?.[0],
      href: `/marketplace/${service.id}`,
      isVerified: verified,
    });
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? service.id
        ? `${window.location.origin}/marketplace/${service.id}`
        : `${window.location.origin}/services`
      : `/marketplace/${service.id || ''}`;
  const sharePriceText =
    service.priceRange?.trim() ||
    formatSharePriceText({
      priceType: service.priceType || 'contact',
      price: service.price,
      adType: 'service',
    });

  const handleShareClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void shareListing(service.title, sharePriceText, 'Service', shareUrl);
  };

  return (
    <div className="relative group h-full">
      <Link
        to={`/marketplace/${service.id}`}
        onClick={handleTrackClick}
        onMouseEnter={handleWarmEntity}
        onTouchStart={handleWarmEntity}
        onFocus={handleWarmEntity}
        className="block h-full focus:outline-none"
      >
        <Card
          padded={false}
          className="h-full overflow-hidden flex flex-col group-focus-visible:ring-2 group-focus-visible:ring-blue-500"
        >
        <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
          <ProductImage
            src={service.images?.[0]}
            alt={service.title}
            priority={priority}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-600/95 text-white border border-blue-500 shadow-sm backdrop-blur-sm">
            <Wrench className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Service</span>
          </span>
        </div>

        <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
          <div className="space-y-1 min-w-0">
            {categoryLabel && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {categoryLabel}
              </p>
            )}
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {service.title}
            </h3>
            {(sellerName || verified || service.sellerSnapshot?.profilePic) && (
              <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 min-w-0">
                <UserAvatar
                  uid={service.providerId}
                  src={service.sellerSnapshot?.profilePic}
                  name={sellerName || 'Service Provider'}
                  size="2xs"
                />
                <span className="truncate">{sellerName || 'Service Provider'}</span>
                {verified && (
                  <VerifiedBadge
                    size="xs"
                    accountType={service.sellerSnapshot?.accountType}
                  />
                )}
              </p>
            )}
            {service.locationName && (
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                <span className="truncate">{service.locationName}</span>
              </p>
            )}
          </div>

          <p className="text-sm sm:text-base font-semibold text-blue-600 dark:text-blue-400 tabular-nums truncate">
            {priceText}
          </p>
        </div>
      </Card>
    </Link>

      <button
        type="button"
        onClick={handleShareClick}
        aria-label={`Share ${service.title}`}
        title="Share service"
        className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/90 dark:border-slate-700 shadow-sm backdrop-blur-sm flex items-center justify-center transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
});

interface MixedFeedCardProps {
  item: MixedFeedItem;
  priority?: boolean;
}

export const MixedFeedCard = memo(function MixedFeedCard({
  item,
  priority = false,
}: MixedFeedCardProps) {
  if (item._type === 'store' && item.store) {
    return (
      <StoreCard
        store={item.store}
        isVerifiedOwner={item.isVerified}
        priority={priority}
      />
    );
  }
  if (item._type === 'accommodation' && item.accommodation) {
    return (
      <AccommodationCard
        accommodation={item.accommodation}
        isVerifiedOwner={item.isVerified}
        priority={priority}
      />
    );
  }
  if (item.product) {
    return <ProductCard product={item.product} priority={priority} />;
  }
  if (item.service) {
    return (
      <LegacyServiceCard
        service={item.service}
        isVerified={item.isVerified}
        priority={priority}
      />
    );
  }
  return null;
});
