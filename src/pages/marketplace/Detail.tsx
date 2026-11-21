import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Flag,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  PackageOpen,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import {
  getProductById,
  incrementProductContactCount,
  incrementProductViewCount,
} from '../../lib/marketplaceService';
import {
  isListingFavorited,
  logEnquiry,
  toggleFavorite,
} from '../../lib/buyerService';
import { submitReport } from '../../lib/adminService';
import { notifyWhatsAppContact } from '../../lib/notificationService';
import { getCategoryName } from '../../lib/categories';
import {
  buildProductWhatsAppUrl,
  getListingAdType,
  getPriceUnitLabel,
  getProductLocationLabel,
  getProductPriceDisplay,
  getServiceLocationLabel,
} from '../../lib/marketplaceHelpers';
import {
  CACHE_HYDRATED_EVENT,
  getFastCache,
  getFastCacheEnvelope,
} from '../../lib/fastCache';
import { warmImages } from '../../lib/imageCache';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { formatSharePriceText, shareListing } from '../../lib/shareUtils';
import {
  claimSessionViewTrack,
  primeProductIntoCache,
  shouldSkipDetailNetworkFetch,
} from '../../lib/syncCache';
import { hasInAppBackHistory } from '../../lib/feedScrollState';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Product } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductImage } from '../../components/marketplace/ProductImage';
import { SeoHead } from '../../components/seo/SeoHead';

export function MarketplaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const canGoBack = hasInAppBackHistory(
    typeof window !== 'undefined' ? window.history.state : null,
    location.key
  );

  const initialProduct = id ? getFastCache<Product>(`product:${id}`) : null;
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(() => Boolean(id) && !initialProduct);
  const [error, setError] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  const trackedViewForIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedImageIndex(0);
    setError(null);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const handleHydrated = () => {
      const hydrated = getFastCacheEnvelope<Product>(`product:${id}`, 0);
      if (hydrated?.data) {
        setProduct((prev) =>
          hydrated.isFull !== false || !prev ? hydrated.data : prev
        );
        setLoading(false);
        warmImages(hydrated.data.images, 4);
      }
    };
    window.addEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    return () => {
      window.removeEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    };
  }, [id]);

  const loadProduct = useCallback(async () => {
    if (!id) {
      setProduct(null);
      setLoading(false);
      return;
    }

    const { skip, cached } = shouldSkipDetailNetworkFetch<Product>(
      `product:${id}`
    );
    if (cached) {
      setProduct(cached);
      setLoading(false);
      warmImages(cached.images, 4);
    } else {
      setProduct(null);
      setLoading(true);
    }
    setError(null);

    if (skip) {
      return;
    }

    try {
      const row = await getProductById(id, { force: true });
      setProduct(row);
      if (row) {
        primeProductIntoCache(row, { isFull: true, idbOnly: false });
        warmImages(row.images, 4);
      }
    } catch (err) {
      if (!cached) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load product details. Please try again.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  // Save recentlyViewed and increment viewCount once per browser session
  useEffect(() => {
    const productId = product?.id;
    if (!productId || !product) {
      return;
    }

    const adType = getListingAdType(product);
    const priceInfo = getProductPriceDisplay(product);
    saveRecentlyViewed({
      id: productId,
      _type: adType === 'service' ? 'service' : 'item',
      title: product.title,
      subtitle:
        product.subcategory ||
        getCategoryName(product.categoryId) ||
        product.categoryName ||
        'Campus Listing',
      priceLabel: priceInfo.text,
      imageUrl: product.images?.[0],
      href: `/marketplace/${productId}`,
      isVerified: Boolean(product.sellerSnapshot?.isVerified),
    });

    if (trackedViewForIdRef.current === productId) {
      return;
    }
    trackedViewForIdRef.current = productId;
    if (claimSessionViewTrack(productId)) {
      setProduct((prev) =>
        prev && prev.id === productId
          ? { ...prev, viewCount: (prev.viewCount || 0) + 1 }
          : prev
      );
      void incrementProductViewCount(productId);
    }
  }, [product]);

  // Check if current listing is saved in user favorites
  useEffect(() => {
    let active = true;
    const productId = product?.id;
    const userId = user?.uid;

    if (!productId || !userId) {
      setIsFavorited(false);
      return;
    }

    isListingFavorited(userId, productId)
      .then((saved) => {
        if (active) setIsFavorited(saved);
      })
      .catch(() => {
        if (active) setIsFavorited(false);
      });

    return () => {
      active = false;
    };
  }, [user?.uid, product?.id]);

  const images = useMemo(() => product?.images || [], [product]);
  const activeImage = images[selectedImageIndex] || images[0];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Loading variant="skeleton" message="Loading listing details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <ErrorState message={error} onRetry={() => void loadProduct()} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <SeoHead
          title="Listing Not Found"
          ogTitle="Listing Not Found — LASUEDPLUG"
          description="This listing may have been removed or is no longer available on LASUEDPLUG."
        />
        <Card
          hoverable={false}
          className="border-dashed text-center py-10 space-y-4"
        >
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <PackageOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">
              Listing not found
            </h1>
            <p className="text-sm text-slate-500">
              This listing may have been removed or is no longer available.
            </p>
          </div>
          <div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() =>
                canGoBack ? navigate(-1) : navigate('/marketplace')
              }
            >
              {canGoBack ? 'Go Back' : 'Back to Marketplace'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const adType = getListingAdType(product);
  const isServiceListing = adType === 'service';
  const priceInfo = getProductPriceDisplay(product);
  const locationLabel = getProductLocationLabel(product);
  const serviceLocationText = isServiceListing
    ? getServiceLocationLabel(product.serviceLocation)
    : '';
  const landmarkName =
    product.locationName?.trim() ||
    product.landmark?.trim() ||
    product.location?.trim() ||
    '';

  const categoryLabel =
    getCategoryName(product.categoryId) || product.categoryName;
  const sellerName = product.sellerSnapshot?.fullName || 'Campus Seller';
  const sellerVerified = Boolean(product.sellerSnapshot?.isVerified);
  const storeTitle = product.storeName || product.shopName;
  const whatsappHref = buildProductWhatsAppUrl(
    product.whatsappNumber || '',
    product.title
  );

  const handleFavoriteClick = async () => {
    if (!user?.uid) {
      showToast('Please login to save favorites.', 'info');
      return;
    }
    if (!product.id || favoriteBusy) return;

    const prevFavorited = isFavorited;
    setIsFavorited(!prevFavorited);
    setFavoriteBusy(true);

    try {
      const nextState = await toggleFavorite(
        user.uid,
        product.id,
        adType,
        prevFavorited
      );
      setIsFavorited(nextState);
      showToast(
        nextState ? 'Saved to favorites.' : 'Removed from saved items.',
        nextState ? 'success' : 'info'
      );
    } catch (err) {
      setIsFavorited(prevFavorited);
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to update saved items.';
      showToast(msg, 'error');
    } finally {
      setFavoriteBusy(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (!product.id) return;
    const productId = product.id;
    setProduct((prev) =>
      prev && prev.id === productId
        ? { ...prev, contactCount: (prev.contactCount || 0) + 1 }
        : prev
    );
    void incrementProductContactCount(productId);
    if (user?.uid) {
      void logEnquiry(
        user.uid,
        product.sellerId,
        productId,
        product.title
      );
      if (product.sellerId) {
        void notifyWhatsAppContact(
          product.sellerId,
          product.title,
          '/dashboard/seller'
        );
      }
    }
  };

  const handleReportClick = () => {
    if (!user?.uid) {
      showToast('Please login to report this listing.', 'info');
      navigate('/login');
      return;
    }
    setReportReason('');
    setReportModalOpen(true);
  };

  const handleSubmitReport = async () => {
    if (!user?.uid || !id || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await submitReport({
        reporterId: user.uid,
        targetId: id,
        targetType: 'product',
        reason: reportReason,
      });
      setReportModalOpen(false);
      setReportReason('');
      const msg = 'Thank you. Your report has been sent to LASUEDPLUG Admins.';
      setReportNotice(msg);
      showToast(msg, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to submit report.',
        'error'
      );
    } finally {
      setReportSubmitting(false);
    }
  };

  const stockQuantity =
    typeof product.quantity === 'number' && Number.isFinite(product.quantity)
      ? Math.max(0, Math.floor(product.quantity))
      : 1;
  const isOnlineListing =
    product.locationType === 'online' ||
    (isServiceListing && product.serviceLocation === 'online');
  const hasGps =
    typeof product.latitude === 'number' && typeof product.longitude === 'number';

  const shareUrl =
    typeof window !== 'undefined'
      ? product.id
        ? `${window.location.origin}/marketplace/${product.id}`
        : window.location.href
      : `/marketplace/${product.id || ''}`;
  const sharePriceText = formatSharePriceText({
    priceType: product.priceType,
    price: product.price,
    adType,
  });

  const handleShareClick = () => {
    void shareListing(
      product.title,
      sharePriceText,
      isServiceListing ? 'Service' : 'Item',
      shareUrl
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-36 md:pb-12 space-y-6">
      <SeoHead
        title={product.title}
        ogTitle={product.title}
        description={
          product.description?.trim() ||
          `${priceInfo.text} · ${locationLabel} on LASUEDPLUG.`
        }
        type="product"
      />
      {/* Back link & Share */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (canGoBack) {
              navigate(-1);
            } else {
              navigate(isServiceListing ? '/services' : '/marketplace');
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {canGoBack
              ? 'Go Back'
              : isServiceListing
                ? 'Back to Services'
                : 'Back to Marketplace'}
          </span>
        </button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleShareClick}
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </Button>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Product Image + Thumbnails */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative aspect-[4/3] w-full rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
            <ProductImage
              src={activeImage}
              alt={product.title}
              priority
              className="w-full h-full object-cover"
              iconClassName="w-12 h-12 text-slate-400"
            />
            <button
              type="button"
              onClick={() => void handleFavoriteClick()}
              disabled={favoriteBusy}
              aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
              aria-pressed={isFavorited}
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-70"
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isFavorited
                    ? 'fill-red-500 text-red-500'
                    : 'text-slate-600 hover:text-red-500'
                }`}
              />
            </button>
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {images.map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  aria-label={`View image ${idx + 1}`}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                    idx === selectedImageIndex
                      ? 'border-blue-600 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`${product.title} thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    iconClassName="w-5 h-5 text-slate-400"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase / Contact Module */}
        <div className="lg:col-span-5 space-y-6">
          <Card hoverable={false} className="space-y-5">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${
                    isServiceListing
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {isServiceListing ? (
                    <Wrench className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <ShoppingBag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{isServiceListing ? 'Service' : 'Item'}</span>
                </span>

                {(categoryLabel || product.subcategory) && (
                  <p className="text-xs font-medium text-slate-500">
                    {[categoryLabel, product.subcategory].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                {product.title}
              </h1>

              <div className="flex flex-wrap items-baseline gap-2">
                <p
                  className={`text-2xl tabular-nums ${
                    priceInfo.isContact
                      ? 'font-bold text-blue-600'
                      : 'font-extrabold text-slate-900'
                  }`}
                >
                  {priceInfo.isContact && priceInfo.unitSuffix
                    ? `${priceInfo.text} (${getPriceUnitLabel(product.priceUnit)})`
                    : priceInfo.text}
                </p>
              </div>

              {/* Availability (Stock for Items, Service Available for Services) */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {isServiceListing ? (
                  <span
                    data-testid="stock-status"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border bg-blue-50 text-blue-700 border-blue-200"
                  >
                    <Wrench className="w-3.5 h-3.5 shrink-0" />
                    <span>Service Available · {serviceLocationText}</span>
                  </span>
                ) : (
                  <span
                    data-testid="stock-status"
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${
                      stockQuantity === 0
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : stockQuantity === 1
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 shrink-0" />
                    {stockQuantity === 0 ? (
                      <span>Sold Out</span>
                    ) : stockQuantity === 1 ? (
                      <span>In Stock: 1 available · Only 1 left!</span>
                    ) : (
                      <span>In Stock: {stockQuantity} available</span>
                    )}
                  </span>
                )}
              </div>

              {/* Location, Store Name, Map Link, Delivery */}
              <div className="pt-1 space-y-2">
                {isOnlineListing ? (
                  <p className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 shrink-0" />
                    <span>
                      {isServiceListing
                        ? 'Online / Mobile · Available anytime'
                        : 'Online / Delivery'}
                    </span>
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-sm text-slate-600 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        {isServiceListing
                          ? product.serviceLocation === 'shop' && landmarkName
                            ? `Come to Shop · ${landmarkName}`
                            : product.serviceLocation === 'mobile' && landmarkName
                              ? `We come to you · ${landmarkName}`
                              : serviceLocationText
                          : locationLabel}
                      </span>
                    </p>
                    {isServiceListing &&
                      product.serviceLocation === 'shop' &&
                      product.openingHours?.trim() && (
                        <p className="text-sm text-slate-600 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>Shop Hours: {product.openingHours.trim()}</span>
                        </p>
                      )}
                    {hasGps && (
                      <a
                        href={`https://www.google.com/maps?q=${product.latitude},${product.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>View on Map</span>
                      </a>
                    )}
                  </div>
                )}

                {storeTitle && (
                  <p className="text-sm text-slate-600 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-slate-400 shrink-0" />
                    {product.storeId ? (
                      <Link
                        to={`/store/${product.storeId}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {storeTitle}
                      </Link>
                    ) : (
                      <span>{storeTitle}</span>
                    )}
                  </p>
                )}

                {!isServiceListing && !isOnlineListing && product.hasDelivery && (
                  <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                    <Badge variant="verified">
                      <Truck className="w-3.5 h-3.5 mr-1" />
                      Delivery Available
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Description
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* Seller Info Card */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Seller Information
              </h2>
              <Link
                to={`/seller/${product.sellerId}`}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-slate-100/70 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    uid={product.sellerId}
                    src={product.sellerSnapshot?.profilePic}
                    name={sellerName}
                    size="md"
                    className="w-11 h-11"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 flex items-center gap-1.5 min-w-0 transition-colors">
                      <span className="truncate">{sellerName}</span>
                      {sellerVerified && (
                        <VerifiedBadge
                          size="sm"
                          accountType={product.sellerSnapshot?.accountType}
                        />
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      View seller profile, reviews &amp; listings →
                    </p>
                  </div>
                </div>
                {sellerVerified && (
                  <Badge variant="verified" className="shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Verified
                  </Badge>
                )}
              </Link>
            </div>

            {/* Desktop WhatsApp & Share Actions */}
            <div className="hidden md:flex items-center gap-2.5 pt-2">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWhatsAppClick}
                className="flex-1 min-w-0 min-h-[52px] inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 whitespace-nowrap"
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                <span>Message Seller on WhatsApp</span>
              </a>
              <Button
                type="button"
                variant="outline"
                onClick={handleShareClick}
                className="min-h-[52px] px-4 py-3.5 rounded-xl text-sm shrink-0 whitespace-nowrap"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </Button>
            </div>
          </Card>

          {/* Report Listing Action */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleReportClick}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report Listing</span>
            </button>
            {reportNotice && (
              <p
                role="status"
                className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg"
              >
                {reportNotice}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Mobile WhatsApp & Share CTA Bar (sits cleanly above MobileNav) */}
      <div className="md:hidden fixed bottom-[calc(55px+env(safe-area-inset-bottom))] left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-3.5 py-2.5 shadow-sm flex items-center gap-2.5">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWhatsAppClick}
          className="flex-1 min-w-0 min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-all duration-200 active:scale-95"
        >
          <MessageCircle className="w-5 h-5 shrink-0" />
          <span className="truncate">WhatsApp Seller</span>
        </a>
        <Button
          type="button"
          variant="outline"
          onClick={handleShareClick}
          className="min-h-[48px] px-4 py-3 rounded-xl shrink-0"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </Button>
      </div>

      {/* Report Listing Modal */}
      {reportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-listing-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => !reportSubmitting && setReportModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                  <Flag className="w-4 h-4" />
                </div>
                <h2
                  id="report-listing-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Report Listing
                </h2>
              </div>
              <button
                type="button"
                disabled={reportSubmitting}
                onClick={() => setReportModalOpen(false)}
                aria-label="Close report modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Let our Admin team know why &ldquo;{product.title}&rdquo; violates campus marketplace guidelines.
            </p>

            <textarea
              rows={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="e.g. Suspected scam, misleading price, prohibited item..."
              className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={reportSubmitting}
                onClick={() => setReportModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={reportSubmitting || reportReason.trim().length < 5}
                onClick={() => void handleSubmitReport()}
              >
                {reportSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Submit Report</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
