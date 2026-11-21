import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Clock,
  Flag,
  Globe,
  GraduationCap,
  MapPin,
  MessageCircle,
  PackageOpen,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getInitials } from '../../lib/authHelpers';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { formatNigerianWhatsAppDigits } from '../../lib/marketplaceHelpers';
import { fetchReviewsForTarget } from '../../lib/reviewService';
import {
  getApprovedProductsBySeller,
  getPublicUserProfile,
} from '../../lib/sellerService';
import { getApprovedStoresByOwner } from '../../lib/storeService';
import { Product, Review, Store, UserProfile } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
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

  interface CachedSellerProfile {
    seller: UserProfile;
    stores: Store[];
    products: Product[];
    reviews: Review[];
  }
  const initialCached = uid
    ? getFastCache<CachedSellerProfile>(`seller_profile:${uid}`)
    : null;

  const [seller, setSeller] = useState<UserProfile | null>(
    () => initialCached?.seller ?? null
  );
  const [stores, setStores] = useState<Store[]>(() => initialCached?.stores ?? []);
  const [products, setProducts] = useState<Product[]>(
    () => initialCached?.products ?? []
  );
  const [reviews, setReviews] = useState<Review[]>(
    () => initialCached?.reviews ?? []
  );
  const [loading, setLoading] = useState(() => Boolean(uid) && !initialCached);
  const [error, setError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const loadSellerProfile = useCallback(async () => {
    if (!uid) {
      setSeller(null);
      setLoading(false);
      return;
    }

    const cached = getFastCache<CachedSellerProfile>(`seller_profile:${uid}`);
    if (cached) {
      setSeller(cached.seller);
      setStores(cached.stores);
      setProducts(cached.products);
      setReviews(cached.reviews);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    setAvatarFailed(false);

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
        setFastCache(`seller_profile:${uid}`, {
          seller: profileData,
          stores: sellerStores,
          products: sellerProducts,
          reviews: sellerReviews,
        });
      }
    } catch (err) {
      if (!cached) {
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

  if (loading) {
    return <Loading fullScreen message="Loading seller profile..." />;
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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

  const isBusiness = seller.accountType === 'business';
  const displayName =
    (isBusiness ? seller.businessName?.trim() : '') ||
    seller.fullName?.trim() ||
    'Campus Member';
  const initials = getInitials(displayName, null);
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
          `${isBusiness ? 'Verified Campus Business' : seller.campus || 'Campus Seller'} on LASUEDPLUG (${products.length} active listings).`
        }
        type="profile"
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/marketplace');
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Seller Profile Header Card */}
      <Card hoverable={false} className="p-5 sm:p-7">
        <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
          <div className="flex flex-col sm:flex-row gap-5 items-start min-w-0 flex-1">
            {seller.avatarUrl && !avatarFailed ? (
              <img
                src={seller.avatarUrl}
                alt={displayName}
                loading="lazy"
                decoding="async"
                onError={() => setAvatarFailed(true)}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary-500 text-white text-xl sm:text-2xl font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}

            <div className="space-y-2.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isBusiness ? 'verified' : 'role'}>
                  {isBusiness ? 'Business / Landlord' : 'Student Seller'}
                </Badge>
                {seller.isVerified && (
                  <Badge variant="verified">Verified Member</Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {displayName}
                </h1>
                {seller.isVerified && <VerifiedBadge size="sm" />}
              </div>

              {isBusiness &&
                seller.businessName?.trim() &&
                seller.fullName?.trim() &&
                seller.businessName.trim() !== seller.fullName.trim() && (
                  <p className="text-xs sm:text-sm text-slate-500">
                    Managed by {seller.fullName.trim()}
                  </p>
                )}

              <StarRating
                rating={seller.trustScore ?? 0}
                reviewCount={seller.reviewCount ?? 0}
                size="md"
              />

              {seller.bio?.trim() && (
                <p className="text-sm text-slate-600 leading-relaxed max-w-2xl whitespace-pre-line">
                  {seller.bio.trim()}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs sm:text-sm text-slate-600">
                {isBusiness ? (
                  <>
                    {seller.openingHours?.trim() && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                        <Clock className="w-4 h-4 text-primary-500 shrink-0" />
                        <span>Hours: {seller.openingHours.trim()}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      {seller.isOnlineOnly ? (
                        <>
                          <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Online Only / Delivery</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>Physical Shop Available</span>
                        </>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    {seller.campus?.trim() && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{seller.campus.trim()}</span>
                      </span>
                    )}
                    {(seller.department?.trim() || seller.level?.trim()) && (
                      <span className="inline-flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          {[seller.department?.trim(), seller.level?.trim()]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
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
                className="text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Active Listings
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
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
