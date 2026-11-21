import { memo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Wrench } from 'lucide-react';
import { getCategoryName } from '../../lib/categories';
import { getProductPriceDisplay } from '../../lib/marketplaceHelpers';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { MixedFeedItem } from '../../lib/trendingHelpers';
import { Service } from '../../types';
import { Card } from '../ui/Card';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { AccommodationCard } from './AccommodationCard';
import { ProductCard } from './ProductCard';
import { ProductImage } from './ProductImage';
import { StoreCard } from './StoreCard';

interface LegacyServiceCardProps {
  service: Service;
  isVerified?: boolean;
}

const LegacyServiceCard = memo(function LegacyServiceCard({
  service,
  isVerified,
}: LegacyServiceCardProps) {
  const categoryLabel = service.subcategory || getCategoryName(service.categoryId);
  const sellerName = service.sellerSnapshot?.fullName;
  const verified = Boolean(isVerified ?? service.sellerSnapshot?.isVerified);
  const priceText = service.priceRange || getProductPriceDisplay(service).text;

  const handleTrackClick = () => {
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

  return (
    <Link
      to={`/marketplace/${service.id}`}
      onClick={handleTrackClick}
      className="group block h-full focus:outline-none"
    >
      <Card
        padded={false}
        className="h-full overflow-hidden flex flex-col group-focus-visible:ring-2 group-focus-visible:ring-blue-500"
      >
        <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
          <ProductImage
            src={service.images?.[0]}
            alt={service.title}
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
              <p className="text-xs font-medium text-slate-500 truncate">
                {categoryLabel}
              </p>
            )}
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {service.title}
            </h3>
            {(sellerName || verified) && (
              <p className="text-xs text-slate-600 flex items-center gap-1 min-w-0">
                <span className="truncate">{sellerName || 'Service Provider'}</span>
                {verified && <VerifiedBadge size="xs" />}
              </p>
            )}
            {service.locationName && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate">{service.locationName}</span>
              </p>
            )}
          </div>

          <p className="text-sm sm:text-base font-semibold text-blue-600 tabular-nums truncate">
            {priceText}
          </p>
        </div>
      </Card>
    </Link>
  );
});

interface MixedFeedCardProps {
  item: MixedFeedItem;
}

export const MixedFeedCard = memo(function MixedFeedCard({
  item,
}: MixedFeedCardProps) {
  if (item._type === 'store' && item.store) {
    return <StoreCard store={item.store} isVerifiedOwner={item.isVerified} />;
  }
  if (item._type === 'accommodation' && item.accommodation) {
    return (
      <AccommodationCard
        accommodation={item.accommodation}
        isVerifiedOwner={item.isVerified}
      />
    );
  }
  if (item.product) {
    return <ProductCard product={item.product} />;
  }
  if (item.service) {
    return (
      <LegacyServiceCard service={item.service} isVerified={item.isVerified} />
    );
  }
  return null;
});
