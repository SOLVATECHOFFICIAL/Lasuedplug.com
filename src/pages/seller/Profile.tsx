import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Clock,
  ExternalLink,
  Flag,
  Globe,
  MapPin,
  MessageCircle,
  PackageOpen,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getUserAvatarUrl, isMarketerProfile } from '../../lib/authHelpers';
import { verifySellerProfileOnServer } from '../../lib/backgroundSync';
import {
  CACHE_HYDRATED_EVENT,
  getFastCache,
  getFastCacheEnvelope,
  setFastCache,
} from '../../lib/fastCache';
import { formatNigerianWhatsAppDigits } from '../../lib/marketplaceHelpers';
import { fetchReviewsForTarget } from '../../lib/reviewService';
import {
  getApprovedProductsBySeller,
  getPublicUserProfile,
} from '../../lib/sellerService';
import { getApprovedStoresByOwner } from '../../lib/storeService';
import {
  DETAIL_FRESH_MS,
  getEntityContentSignature,
  haveListsDiverged,
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
import { StoreCard } from '../../components/marketplace/StoreCard';
import { ReviewSection } from '../../components/reviews/ReviewSection';
import { ReportUserModal } from '../../components/reviews/ReportUserModal';
import { SeoHead } from '../../components/seo/SeoHead';

export function SellerProfile() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { canGoBack, handleGoBack } = useSafeGoBack('/marketplace');

  interface CachedSellerProfile {
    seller: UserProfile;
    stores: Store[];
    products: Product[];
    reviews: Review[];
  }
  const initialCached = uid
    ? getFastCache<CachedSellerProfile>(`seller_profile:${uid}`)
    : null;
  const initialPublicUser =
    !initialCached && uid
      ? getFastCache<UserProfile>(`seller_public_user:${uid}`)
      : null;

  const [seller, setSeller] = useState<UserProfile | null>(
    () => initialCached?.seller ?? initialPublicUser ?? null
  );
  const [stores, setStores] = useState<Store[]>(() => initialCached?.stores ?? []);
  const [products, setProducts] = useState<Product[]>(
    () => initialCached?.products ?? []
  );
  const [reviews, setReviews] = useState<Review[]>(
    () => initialCached?.reviews ?? []
  );
  const [loading, setLoading] = useState(
    () => Boolean(uid) && !initialCached && !initialPublicUser
  );
  const [error, setError] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const handleHydrated = () => {
      const hydrated = getFastCacheEnvelope<CachedSellerProfile>(
        `seller_profile:${uid}`,
        0
      );
      if (hydrated?.data) {
        setSeller(hydrated.data.seller);
        setStores(hydrated.data.stores);
        setProducts(hydrated.data.products);
        setReviews(hydrated.data.reviews);
        setLoading(false);
        return;
      }
      const hydratedUser = getFastCache<UserProfile>(`seller_public_user:${uid}`);
      if (hydratedUser) {
        setSeller((prev) => prev ?? hydratedUser);
        setLoading(false);
      }
    };

    window.addEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    return () => {
      window.removeEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    };
  }, [uid]);

  const loadSellerProfile = useCallback(async () => {
    if (!uid) {
      setSeller(null);
      setLoading(false);
      return;
    }

    const freshEnv = getFastCacheEnvelope<CachedSellerProfile>(
      `seller_profile:${uid}`,
      DETAIL_FRESH_MS
    );
    const cached =
      freshEnv?.data ||
      getFastCache<CachedSellerProfile>(`seller_profile:${uid}`);
    const fallbackUser = cached
      ? null
      : getFastCache<UserProfile>(`seller_public_user:${uid}`);

    if (cached) {
      setSeller(cached.seller);
      setStores(cached.stores);
      setProducts(cached.products);
      setReviews(cached.reviews);
      setLoading(false);
    } else if (fallbackUser) {
      setSeller(fallbackUser);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    if (freshEnv) {
      return;
    }

    try {
      const [profileData, sellerStores, sellerProducts, sellerReviews] =
        await Promise.all([
          getPublicUserProfile(uid),
          getApprovedStoresByOwner(uid),
          getApprovedProductsBySeller(uid),
          fetchReviewsForTarget(uid, 'user'),
        ]);

      setSeller(profileData);
      setStores(sellerStores);
      setProducts(sellerProducts);
      setReviews(sellerReviews);
      if (profileData) {
        setFastCache(
          `seller_profile:${uid}`,
          {
            seller: profileData,
            stores: sellerStores,
            products: sellerProducts,
            reviews: sellerReviews,
          },
          { idbOnly: true, isFull: true }
        );
      }
    } catch (err) {
      if (!cached && !fallbackUser) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load this seller profile right now.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void loadSellerProfile();
  }, [loadSellerProfile]);

  const sellerRef = useRef(seller);
  sellerRef.current = seller;
  const storesRef = useRef(stores);
  storesRef.current = stores;
  const productsRef = useRef(products);
  productsRef.current = products;
  const reviewsRef = useRef(reviews);
  reviewsRef.current = reviews;

  useBackgroundSync({
    enabled: Boolean(uid),
    onTick: useCallback(async () => {
      if (!uid) return;
      const result = await verifySellerProfileOnServer(uid, {
        currentStoreCount: storesRef.current.length,
        currentProductCount: productsRef.current.length,
        currentReviewCount: reviewsRef.current.length,
        currentStores: storesRef.current,
        currentProducts: productsRef.current,
        currentReviews: reviewsRef.current,
      });

      if (result.status === 'deleted') {
        if (sellerRef.current !== null) {
          setSeller(null);
          setStores([]);
          setProducts([]);
          setReviews([]);
        }
        setLoading(false);
        setError(null);
        return;
      }

      if (result.status === 'ok') {
        const next = result.data;
        const sellerChanged =
          JSON.stringify(sellerRef.current || null) !==
          JSON.stringify(next.seller || null);
        const storesChanged = haveListsDiverged(
          storesRef.current,
          next.stores,
          getEntityContentSignature
        );
        const productsChanged = haveListsDiverged(
          productsRef.current,
          next.products,
          getEntityContentSignature
        );
        const reviewsChanged =
          reviewsRef.current.length !== next.reviews.length;

        if (sellerChanged) setSeller(next.seller);
        if (storesChanged) setStores(next.stores);
        if (productsChanged) setProducts(next.products);
        if (reviewsChanged) setReviews(next.reviews);

        if (
          sellerChanged ||
          storesChanged ||
          productsChanged ||
          reviewsChanged
        ) {
          setFastCache(`seller_profile:${uid}`, next, {
            idbOnly: true,
            isFull: true,
          });
        }
        setLoading(false);
      }
    }, [uid]),
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center gap-1.5 py-2 pr-3 -ml-1 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{canGoBack ? 'Go Back' : 'Back to Marketplace'}</span>
        </button>
        <Loading message="Loading seller profile..." />
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
          <span>{canGoBack ? 'Go Back' : 'Back to Marketplace'}</span>
        </button>
        <ErrorState message={error} onRetry={() => void loadSellerProfile()} />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SeoHead
          title="Seller Not Found"
          ogTitle="Seller Not Found — LASUEDPLUG"
          description="This seller profile could not be found on LASUEDPLUG."
        />
        <EmptyState
          icon={UserIcon}
          title="Seller profile not found"
          description="This user profile could not be found on LASUEDPLUG."
          actionLabel="Back to Marketplace"
          actionTo="/marketplace"
        />
      </div>
    );
  }

  const isBusiness = isMarketerProfile(seller);
  const displayName =
    (isBusiness ? seller.businessName?.trim() : '') ||
    seller.fullName?.trim() ||
    'Campus Member';
  const whatsappDigits = seller.phone
    ? formatNigerianWhatsAppDigits(seller.phone)
    : '';
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
        `Hello ${displayName}, I saw your profile on LASUEDPLUG.`
      )}`
    : '';
  const isOwnProfile = Boolean(user?.uid && user.uid === seller.uid);

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
        title={displayName}
        ogTitle={displayName}
        description={
          seller.bio?.trim() ||
          `${isBusiness ? 'Campus Marketer' : seller.campus || 'Student Seller'} on LASUEDPLUG (${products.length} active listings).`
        }
        type="profile"
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center gap-1.5 py-2 pr-3 -ml-1 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{canGoBack ? 'Go Back' : 'Back to Marketplace'}</span>
        </button>
      </div>

      {/* Seller Profile Header Card */}
      <Card hoverable={false} className="p-5 sm:p-7">
        <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
          <div className="flex flex-col sm:flex-row gap-5 items-start min-w-0 flex-1">
            <UserAvatar
              uid={seller.uid}
              src={getUserAvatarUrl(seller)}
              name={displayName}
              email={seller.email}
              size="xl"
            />

            <div className="space-y-2.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isBusiness ? 'verified' : 'role'}>
                  {isBusiness ? 'Marketer' : 'Student Seller'}
                </Badge>
                {seller.isVerified && (
                  <Badge variant="verified">
                    {isBusiness ? 'Verified Marketer' : 'Verified Student'}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {displayName}
                </h1>
                {seller.isVerified && (
                  <VerifiedBadge
                    size="sm"
                    accountType={isBusiness ? 'business' : 'student'}
                    label={isBusiness ? 'Verified Marketer' : 'Verified Student'}
                  />
                )}
              </div>

              {isBusiness &&
                seller.businessName?.trim() &&
                seller.fullName?.trim() &&
                seller.businessName.trim() !== seller.fullName.trim() && (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Managed by {seller.fullName.trim()}
                  </p>
                )}

              <StarRating
                rating={seller.trustScore ?? 0}
                reviewCount={seller.reviewCount ?? 0}
                size="md"
              />

              {seller.bio?.trim() && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl whitespace-pre-line">
                  {seller.bio.trim()}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                {isBusiness ? (
                  <>
                    {!seller.isOnlineOnly && seller.openingHours?.trim() && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                        <Clock className="w-4 h-4 text-primary-500 dark:text-blue-400 shrink-0" />
                        <span>Hours: {seller.openingHours.trim()}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      {seller.isOnlineOnly ? (
                        <>
                          <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Online Only · Available anytime</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>
                            {seller.shopAddress?.trim() || 'Physical Shop Available'}
                          </span>
                        </>
                      )}
                    </span>
                    {!seller.isOnlineOnly &&
                      typeof seller.latitude === 'number' &&
                      typeof seller.longitude === 'number' && (
                        <a
                          href={`https://www.google.com/maps?q=${seller.latitude},${seller.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span>View Shop on Map</span>
                        </a>
                      )}
                  </>
                ) : (
                  <>
                    {seller.campus?.trim() && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span>{seller.campus.trim()}</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2.5 w-full md:w-auto shrink-0">
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat on WhatsApp</span>
              </a>
            )}

            {!isOwnProfile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReportClick}
                className="text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Report User</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Seller's Approved Stores */}
      {stores.length > 0 && (
        <section aria-label="Seller storefronts" className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Campus Storefronts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store) => (
              <StoreCard key={store.id || store.name} store={store} />
            ))}
          </div>
        </section>
      )}

      {/* Active Listings */}
      <section aria-label="Seller listings" className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Active Listings
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            {products.length} published {products.length === 1 ? 'listing' : 'listings'}
          </p>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No active listings"
            description={`${displayName} does not have any active marketplace listings right now.`}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews & Trust Score */}
      <ReviewSection
        targetId={seller.uid}
        targetType="user"
        targetName={displayName}
        ownerId={seller.uid}
        reviews={reviews}
        trustScore={seller.trustScore ?? 0}
        reviewCount={seller.reviewCount ?? 0}
        onReviewSubmitted={({ review, trustScore, reviewCount }) => {
          setReviews((prev) => [review, ...prev]);
          setSeller((prev) =>
            prev ? { ...prev, trustScore, reviewCount } : prev
          );
        }}
      />

      <ReportUserModal
        open={reportModalOpen}
        targetUserId={seller.uid}
        targetUserName={displayName}
        onClose={() => setReportModalOpen(false)}
      />
    </div>
  );
}
