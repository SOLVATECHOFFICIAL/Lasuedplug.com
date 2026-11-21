import { memo, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Share2, ShoppingBag, Store, Truck, Wrench } from 'lucide-react';
import { Product } from '../../types';
import { getCategoryName } from '../../lib/categories';
import {
  getListingAdType,
  getProductLocationLabel,
  getProductPriceDisplay,
  getServiceLocationLabel,
} from '../../lib/marketplaceHelpers';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { formatSharePriceText, shareListing } from '../../lib/shareUtils';
import { Card } from '../ui/Card';
import { UserAvatar } from '../ui/UserAvatar';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export const ProductCard = memo(function ProductCard({
  product,
  className = '',
}: ProductCardProps) {
  const adType = getListingAdType(product);
  const isServiceListing = adType === 'service';
  const priceInfo = getProductPriceDisplay(product);
  const locationLabel = getProductLocationLabel(product);
  const serviceLocationText = isServiceListing
    ? getServiceLocationLabel(product.serviceLocation)
    : '';
  const isOnlineListing =
    product.locationType === 'online' ||
    (isServiceListing && product.serviceLocation === 'online');

  const categoryLabel =
    product.subcategory || getCategoryName(product.categoryId) || product.categoryName;
  const stockCount =
    typeof product.quantity === 'number' && Number.isFinite(product.quantity)
      ? Math.max(0, Math.floor(product.quantity))
      : 1;
  const storeTitle = product.storeName || product.shopName;
  const sellerName = product.sellerSnapshot?.fullName;
  const isSellerVerified = Boolean(product.sellerSnapshot?.isVerified);

  const handleTrackClick = () => {
    if (!product.id) return;
    saveRecentlyViewed({
      id: product.id,
      _type: isServiceListing ? 'service' : 'item',
      title: product.title,
      subtitle: categoryLabel || sellerName || 'Campus Listing',
      priceLabel: priceInfo.text,
      imageUrl: product.images?.[0],
      href: `/marketplace/${product.id}`,
      isVerified: isSellerVerified,
    });
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? product.id
        ? `${window.location.origin}/marketplace/${product.id}`
        : `${window.location.origin}/marketplace`
      : `/marketplace/${product.id || ''}`;
  const sharePriceText = formatSharePriceText({
    priceType: product.priceType,
    price: product.price,
    adType,
  });

  const handleShareClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void shareListing(
      product.title,
      sharePriceText,
      isServiceListing ? 'Service' : 'Item',
      shareUrl
    );
  };

  return (
    <div className={`relative group h-full ${className}`.trim()}>
      <Link
        to={`/marketplace/${product.id}`}
        onClick={handleTrackClick}
        className="block h-full focus:outline-none"
      >
        <Card
          padded={false}
          className="h-full overflow-hidden flex flex-col group-focus-visible:ring-2 group-focus-visible:ring-blue-500"
        >
        <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
          <ProductImage
            src={product.images?.[0]}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span
            className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border shadow-sm backdrop-blur-sm ${
              isServiceListing
                ? 'bg-blue-600/95 text-white border-blue-500'
                : 'bg-white/95 text-slate-800 border-slate-200'
            }`}
          >
            {isServiceListing ? (
              <Wrench className="w-3 h-3 shrink-0" aria-hidden="true" />
            ) : (
              <ShoppingBag className="w-3 h-3 shrink-0" aria-hidden="true" />
            )}
            <span>{isServiceListing ? 'Service' : 'Item'}</span>
          </span>
        </div>

        <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
          <div className="space-y-1">
            {categoryLabel && (
              <p className="text-xs font-medium text-slate-500 truncate">
                {categoryLabel}
              </p>
            )}
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {product.title}
            </h3>
            {storeTitle && (
              <p className="text-[11px] font-medium text-slate-500 truncate flex items-center gap-1">
                <Store className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate">{storeTitle}</span>
              </p>
            )}
            {(sellerName || isSellerVerified || product.sellerSnapshot?.profilePic) && (
              <p className="text-xs text-slate-600 flex items-center gap-1.5 min-w-0">
                <UserAvatar
                  uid={product.sellerId}
                  src={product.sellerSnapshot?.profilePic}
                  name={sellerName || 'Campus Seller'}
                  size="2xs"
                />
                <span className="truncate">{sellerName || 'Campus Seller'}</span>
                {isSellerVerified && <VerifiedBadge size="xs" />}
              </p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-0.5 min-w-0">
              {isOnlineListing ? (
                <span className="truncate font-medium text-emerald-700 inline-flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Online / Delivery</span>
                </span>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {isServiceListing
                      ? product.serviceLocation === 'shop' &&
                        (product.locationName || product.landmark)
                        ? `Come to Shop · ${product.locationName || product.landmark}`
                        : serviceLocationText
                      : locationLabel}
                  </span>
                  {!isServiceListing && product.hasDelivery && (
                    <>
                      <span aria-hidden="true" className="text-slate-300 shrink-0">
                        ·
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-emerald-700 font-medium shrink-0"
                        title="Delivery available"
                        aria-label="Delivery available"
                      >
                        <Truck className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">Delivery</span>
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <p
              className={`text-sm sm:text-base tabular-nums truncate ${
                priceInfo.isContact
                  ? 'font-semibold text-blue-600'
                  : 'font-bold text-slate-900'
              }`}
            >
              {priceInfo.isContact && priceInfo.unitSuffix
                ? `${priceInfo.text} ${priceInfo.unitSuffix}`
                : priceInfo.text}
            </p>
            {!isServiceListing && (
              <span
                className={`text-[11px] font-medium shrink-0 tabular-nums ${
                  stockCount === 0
                    ? 'text-red-600'
                    : stockCount === 1
                      ? 'text-amber-700'
                      : 'text-slate-500'
                }`}
              >
                {stockCount === 0
                  ? 'Sold Out'
                  : stockCount === 1
                    ? '1 left'
                    : `${stockCount} in stock`}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>

      <button
        type="button"
        onClick={handleShareClick}
        aria-label={`Share ${product.title}`}
        title="Share listing"
        className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 border border-slate-200/90 shadow-sm backdrop-blur-sm flex items-center justify-center transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
});

