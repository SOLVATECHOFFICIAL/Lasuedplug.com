import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Flag,
  MapPin,
  MessageCircle,
  PackageOpen,
  Share2,
  ShieldAlert,
  Store as StoreIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getUserAvatarUrl, isMarketerProfile } from '../../lib/authHelpers';
import { formatNigerianWhatsAppDigits } from '../../lib/marketplaceHelpers';
import { verifyStoreProfileOnServer } from '../../lib/backgroundSync';
import {
  CACHE_HYDRATED_EVENT,
  getFastCache,
  getFastCacheEnvelope,
  setFastCache,
} from '../../lib/fastCache';
import { warmImages } from '../../lib/imageCache';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { fetchReviewsForTarget } from '../../lib/reviewService';
import { shareListing } from '../../lib/shareUtils';
import { getPublicUserProfile } from '../../lib/sellerService';
import {
  getApprovedProductsByStoreId,
  getStoreById,
} from '../../lib/storeService';
import {
  DETAIL_FRESH_MS,
  getEntityContentSignature,
  haveListsDiverged,
  primeStoreIntoCache,
} from '../../lib/syncCache';
import { useBackgroundSync } from '../../lib/useBackgroundSync';
import { useSafeGoBack } from '../../lib/useSafeGoBack';
import { Product, Review, Store, UserProfile } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { Loading } from '../../components/feedback/Loading';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductImage } from '../../components/marketplace/ProductImage';
import { ReviewSection } from '../../components/reviews/ReviewSection';
import { ReportUserModal } from '../../components/reviews/ReportUserModal';
import { SeoHead } from '../../components/seo/SeoHead';

export function StoreProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile: currentUserProfile } = useAuth();
  const { showToast } = useToast();
  const { canGoBack, handleGoBack } = useSafeGoBack('/services?tab=stores');

  interface CachedStoreProfile {
    store: Store;
    ownerProfile: UserProfile | null;
    products: Product[];
    reviews: Review[];
  }
  const initialProfile = id
    ? getFastCache<CachedStoreProfile>(`store_profile:${id}`)
    : null;
  const initialStoreSummary =
    !initialProfile && id ? getFastCache<Store>(`store:${id}`) : null;

  const [store, setStore] = useState<Store | null>(
    () => initialProfile?.store ?? initialStoreSummary ?? null
  );
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(
    () => initialProfile?.ownerProfile ?? null
  );
  const [products, setProducts] = useState<Product[]>(
    () => initialProfile?.products ?? []
  );
  const [reviews, setReviews] = useState<Review[]>(
    () => initialProfile?.reviews ?? []
  );
  const [loading, setLoading] = useState(
    () => Boolean(id) && !initialProfile && !initialStoreSummary
  );
  const [error, setError] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedStoreImageIndex, setSelectedStoreImageIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    const handleHydrated = () => {
      const hydrated = getFastCacheEnvelope<CachedStoreProfile>(
        `store_profile:${id}`,
        0
      );
      if (hydrated?.data) {
        setStore(hydrated.data.store);
        setOwnerProfile(hydrated.data.ownerProfile);
        setProducts(hydrated.data.products);
        setReviews(hydrated.data.reviews);
        setLoading(false);
        return;
      }
      const hydratedStore = getFastCacheEnvelope<Store>(`store:${id}`, 0);
      if (hydratedStore?.data) {
        setStore((prev) => prev ?? hydratedStore.data);
        setLoading(false);
      }
    };

    window.addEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    return () => {
      window.removeEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    };
  }, [id]);

  const loadStoreProfile = useCallback(async () => {
    if (!id) {
      setStore(null);
      setLoading(false);
      return;
    }

    const freshProfileEnv = getFastCacheEnvelope<CachedStoreProfile>(
      `store_profile:${id}`,
      DETAIL_FRESH_MS
    );
    const anyProfileCached =
      freshProfileEnv?.data ||
      getFastCache<CachedStoreProfile>(`store_profile:${id}`);
    const fallbackStore = anyProfileCached
      ? null
      : getFastCache<Store>(`store:${id}`);

    if (anyProfileCached) {
      setStore(anyProfileCached.store);
      setOwnerProfile(anyProfileCached.ownerProfile);
      setProducts(anyProfileCached.products);
      setReviews(anyProfileCached.reviews);
      setLoading(false);
      warmImages(
        anyProfileCached.store.images?.length
          ? anyProfileCached.store.images
          : [anyProfileCached.store.logoUrl],
        4
      );
    } else if (fallbackStore) {
      setStore(fallbackStore);
      setLoading(false);
      warmImages(
        fallbackStore.images?.length
          ? fallbackStore.images
          : [fallbackStore.logoUrl],
        4
      );
    } else {
      setLoading(true);
    }
    setError(null);

    if (freshProfileEnv) {
      return;
    }

    try {
      const storeRecord = await getStoreById(id, {
        force: Boolean(!fallbackStore),
      });
      if (!storeRecord) {
        setStore(null);
        setOwnerProfile(null);
        setProducts([]);
        setReviews([]);
        return;
      }

      const canViewUnapproved = Boolean(
        user?.uid &&
          (user.uid === storeRecord.ownerId || currentUserProfile?.roles?.admin)
      );
      if (!storeRecord.isApproved && !canViewUnapproved) {
        setStore(null);
        setOwnerProfile(null);
        setProducts([]);
        setReviews([]);
        return;
      }

      const [ownerData, storeProducts, storeReviews] = await Promise.all([
        getPublicUserProfile(storeRecord.ownerId).catch(() => null),
        getApprovedProductsByStoreId(id),
        fetchReviewsForTarget(id, 'store'),
      ]);

      setStore(storeRecord);
      setOwnerProfile(ownerData);
      setProducts(storeProducts);
      setReviews(storeReviews);
      if (storeRecord.isApproved) {
        primeStoreIntoCache(storeRecord, { isFull: true, idbOnly: false });
        setFastCache(
          `store_profile:${id}`,
          {
            store: storeRecord,
            ownerProfile: ownerData,
            products: storeProducts,
            reviews: storeReviews,
          },
          { idbOnly: true, isFull: true }
        );
      }
    } catch (err) {
      if (!anyProfileCached && !fallbackStore) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load this campus store right now.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [currentUserProfile?.roles?.admin, id, user?.uid]);

  useEffect(() => {
    void loadStoreProfile();
  }, [loadStoreProfile]);

  const storeRef = useRef(store);
  storeRef.current = store;
  const ownerProfileRef = useRef(ownerProfile);
  ownerProfileRef.current = ownerProfile;
  const productsRef = useRef(products);
  productsRef.current = products;
  const reviewsRef = useRef(reviews);
  reviewsRef.current = reviews;
  const viewerUidRef = useRef(user?.uid);
  viewerUidRef.current = user?.uid;
  const isAdminRef = useRef(Boolean(currentUserProfile?.roles?.admin));
  isAdminRef.current = Boolean(currentUserProfile?.roles?.admin);

  useBackgroundSync({
    enabled: Boolean(id),
    onTick: useCallback(async ({ tickIndex }) => {
      if (!id) return;
      const result = await verifyStoreProfileOnServer(id, {
        viewerUid: viewerUidRef.current,
        isAdmin: isAdminRef.current,
        currentProductCount: productsRef.current.length,
        currentReviewCount: reviewsRef.current.length,
        tickIndex,
        currentOwnerProfile: ownerProfileRef.current,
        currentProducts: productsRef.current,
        currentReviews: reviewsRef.current,
      });

      if (result.status === 'deleted') {
        if (storeRef.current !== null) {
          setStore(null);
          setOwnerProfile(null);
          setProducts([]);
          setReviews([]);
        }
        setLoading(false);
        setError(null);
        return;
      }

      if (result.status === 'ok') {
        const next = result.data;
        const storeChanged =
          !storeRef.current ||
          getEntityContentSignature(storeRef.current) !==
            getEntityContentSignature(next.store);
        const ownerChanged =
          JSON.stringify(ownerProfileRef.current || null) !==
          JSON.stringify(next.ownerProfile || null);
        const productsChanged = haveListsDiverged(
          productsRef.current,
          next.products,
          getEntityContentSignature
        );
        const reviewsChanged =
          reviewsRef.current.length !== next.reviews.length;

        if (storeChanged) setStore(next.store);
        if (ownerChanged) setOwnerProfile(next.ownerProfile);
        if (productsChanged) setProducts(next.products);
        if (reviewsChanged) setReviews(next.reviews);

        if (
          next.store.isApproved &&
          (storeChanged || ownerChanged || productsChanged || reviewsChanged)
        ) {
          setFastCache(`store_profile:${id}`, next, {
            idbOnly: true,
            isFull: true,
          });
        }
        setLoading(false);
      }
    }, [id]),
  });

  useEffect(() => {
    setSelectedStoreImageIndex(0);
    if (!store?.id || !store.isApproved) return;
    saveRecentlyViewed({
      id: store.id,
      _type: 'store',
      title: store.name,
      subtitle: store.category || 'Campus Store',
      priceLabel: store.openingHours?.trim() || store.locationName || 'Storefront',
      imageUrl: store.images?.[0] || store.logoUrl,
      href: `/store/${store.id}`,
      isVerified: Boolean(ownerProfile?.isVerified || store.ownerSnapshot?.isVerified),
    });
  }, [store, ownerProfile?.isVerified]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center gap-1.5 py-2 pr-3 -ml-1 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{canGoBack ? 'Go Back' : 'Back to Services & Stores'}</span>
        </button>
        <Loading message="Loading store profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-5">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center gap-1.5 py-2 pr-3 -ml-1 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{canGoBack ? 'Go Back' : 'Back to Services & Stores'}</span>
        </button>
        <ErrorState message={error} onRetry={() => void loadStoreProfile()} />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SeoHead
          title="Store Not Found"
          ogTitle="Store Not Found — LASUEDPLUG"
          description="This campus storefront may have been removed or is awaiting admin approval."
        />
        <EmptyState
          icon={StoreIcon}
          title="Store not found"
          description="This campus storefront may have been removed or is awaiting admin approval."
          actionLabel="Browse Services & Stores"
          actionTo="/services?tab=stores"
        />
      </div>
    );
  }

  const ownerName =
    ownerProfile?.businessName?.trim() ||
    ownerProfile?.fullName?.trim() ||
    store.ownerSnapshot?.fullName ||
    'Campus Seller';
  const isVerified = Boolean(
    ownerProfile?.isVerified || store.ownerSnapshot?.isVerified
  );
  const isMarketerOwner = isMarketerProfile(
    ownerProfile || store.ownerSnapshot
  );
  const openingHours =
    store.openingHours?.trim() || ownerProfile?.openingHours?.trim() || '';
  const hasGps =
    typeof store.latitude === 'number' && typeof store.longitude === 'number';
  const whatsappDigits = formatNigerianWhatsAppDigits(store.whatsappNumber || '');
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
        `Hello ${store.name}, I found your storefront on LASUEDPLUG.`
      )}`
    : '';
  const isOwner = Boolean(user?.uid && user.uid === store.ownerId);

  const storeImages =
    Array.isArray(store.images) && store.images.length > 0
      ? store.images
      : store.logoUrl
        ? [store.logoUrl]
        : [];
  const activeStoreImage =
    storeImages[selectedStoreImageIndex] || storeImages[0];

  const handleReportClick = () => {
    if (!user) {
      showToast('Please log in to report a user.', 'info');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setReportModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      <SeoHead
        title={store.name}
        ogTitle={store.name}
        description={
          store.description?.trim() ||
          `${store.category || 'Campus Store'} by ${ownerName} on LASUEDPLUG.`
        }
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center gap-1.5 py-2 pr-3 -ml-1 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{canGoBack ? 'Go Back' : 'Back to Services & Stores'}</span>
        </button>
      </div>

      {!store.isApproved && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            This storefront is currently pending admin approval and is not visible to other students yet.
          </span>
        </div>
      )}

      {/* Store Header Card */}
      <Card hoverable={false} className="p-5 sm:p-7">
        <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
          <div className="flex flex-col sm:flex-row gap-5 items-start min-w-0 flex-1">
            <div className="space-y-2 shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                <ProductImage
                  src={activeStoreImage}
                  alt={store.name}
                  priority
                  className="w-full h-full object-cover"
                  iconClassName="w-9 h-9 text-slate-400 dark:text-slate-500"
                />
              </div>
              {storeImages.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {storeImages.map((imgSrc, idx) => (
                    <button
                      key={`${imgSrc.slice(0, 20)}-${idx}`}
                      type="button"
                      onClick={() => setSelectedStoreImageIndex(idx)}
                      aria-label={`View store photo ${idx + 1}`}
                      className={`w-7 h-7 rounded-md overflow-hidden border transition-all ${
                        idx === selectedStoreImageIndex
                          ? 'border-blue-600 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <ProductImage
                        src={imgSrc}
                        alt={`${store.name} thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                        iconClassName="w-3 h-3 text-slate-400 dark:text-slate-500"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="role">
                  {store.category || 'Campus Store'}
                </Badge>
                {store.subcategory && (
                  <Badge variant="role">{store.subcategory}</Badge>
                )}
                {isMarketerOwner && (
                  <Badge variant="verified">Marketer Store</Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {store.name}
                </h1>
                {isVerified && (
                  <VerifiedBadge
                    size="sm"
                    accountType={
                      isMarketerOwner
                        ? 'business'
                        : ownerProfile?.accountType ||
                          store.ownerSnapshot?.accountType
                    }
                  />
                )}
              </div>

              <StarRating
                rating={store.trustScore ?? 0}
                reviewCount={store.reviewCount ?? 0}
                size="md"
              />

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl whitespace-pre-line">
                {store.description}
              </p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span>{store.locationName || 'LASUED Campus'}</span>
                </span>

                {openingHours && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                    <Clock className="w-4 h-4 text-primary-500 dark:text-blue-400 shrink-0" />
                    <span>Open: {openingHours}</span>
                  </span>
                )}

                {hasGps && (
                  <a
                    href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span>View on Map</span>
                  </a>
                )}
              </div>

              <div className="pt-1">
                <Link
                  to={`/seller/${store.ownerId}`}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-blue-400 transition-colors"
                >
                  <UserAvatar
                    uid={store.ownerId}
                    src={
                      getUserAvatarUrl(ownerProfile) ||
                      store.ownerSnapshot?.profilePic
                    }
                    name={ownerName}
                    size="xs"
                  />
                  <span>
                    Owned by{' '}
                    <span className="font-semibold text-slate-900 dark:text-white underline decoration-slate-300 dark:decoration-slate-600 underline-offset-2">
                      {ownerName}
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2.5 w-full md:w-auto shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Chat Store on WhatsApp</span>
                </a>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const storeUrl =
                    typeof window !== 'undefined'
                      ? store.id
                        ? `${window.location.origin}/store/${store.id}`
                        : window.location.href
                      : `/store/${store.id || ''}`;
                  void shareListing(store.name, 'Business', 'Store', storeUrl);
                }}
                className="min-h-[44px] px-5 py-3 rounded-xl"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </Button>
            </div>

            {!isOwner && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReportClick}
                className="text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50 self-stretch sm:self-end"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Report User</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Store Products */}
      <section aria-label="Store listings" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Listings from {store.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 tabular-nums">
              {products.length} active {products.length === 1 ? 'listing' : 'listings'}
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No active listings yet"
            description={`${store.name} has not published any active items or services yet.`}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews Section */}
      {store.id && (
        <ReviewSection
          targetId={store.id}
          targetType="store"
          targetName={store.name}
          ownerId={store.ownerId}
          reviews={reviews}
          trustScore={store.trustScore ?? 0}
          reviewCount={store.reviewCount ?? 0}
          onReviewSubmitted={({ review, trustScore, reviewCount }) => {
            setReviews((prev) => [review, ...prev]);
            setStore((prev) =>
              prev ? { ...prev, trustScore, reviewCount } : prev
            );
          }}
        />
      )}

      <ReportUserModal
        open={reportModalOpen}
        targetUserId={store.ownerId}
        targetUserName={ownerName}
        onClose={() => setReportModalOpen(false)}
      />
    </div>
  );
}
