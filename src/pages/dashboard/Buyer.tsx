import { memo, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  ExternalLink,
  Heart,
  MapPin,
  MessageCircle,
  PackageOpen,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatEnquiryDate } from '../../lib/buyerHelpers';
import { getUserAvatarUrl } from '../../lib/authHelpers';
import { saveDashboardMode } from '../../lib/dashboardMode';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import {
  FavoriteWithListing,
  getUserEnquiries,
  getUserFavorites,
  toggleFavorite,
} from '../../lib/buyerService';
import { getCategoryName } from '../../lib/categories';
import {
  getProductLocationLabel,
  getProductPriceDisplay,
} from '../../lib/marketplaceHelpers';
import { Enquiry } from '../../types';
import { DashboardModeSwitcher } from '../../components/dashboard/DashboardModeSwitcher';
import { ProductImage } from '../../components/marketplace/ProductImage';
import { CardSkeletonGrid } from '../../components/feedback/Loading';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Card } from '../../components/ui/Card';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { SeoHead } from '../../components/seo/SeoHead';

type BuyerTab = 'saved' | 'enquiries';

const SavedListingCard = memo(function SavedListingCard({
  entry,
  isRemoving,
  onUnsave,
}: {
  entry: FavoriteWithListing;
  isRemoving: boolean;
  onUnsave: (item: FavoriteWithListing) => void;
}) {
  const { favorite, listing } = entry;

  if (!listing) {
    return (
      <Card padded={false} className="overflow-hidden flex flex-col justify-between">
        <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
          <PackageOpen className="w-8 h-8" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Listing unavailable
          </span>
          <button
            type="button"
            disabled={isRemoving}
            onClick={() => onUnsave(entry)}
            aria-label="Remove unavailable listing from favorites"
            className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Heart className="w-4 h-4 fill-red-500 text-red-500" />
          </button>
        </div>
        <div className="p-3.5 sm:p-4 space-y-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Item no longer available
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saved on {formatEnquiryDate(favorite.createdAt)}
          </p>
        </div>
      </Card>
    );
  }

  const priceInfo = getProductPriceDisplay(listing);
  const locationLabel = getProductLocationLabel(listing);
  const isOnlineListing =
    listing.locationType === 'online' || listing.serviceLocation === 'online';
  const categoryLabel =
    listing.subcategory ||
    getCategoryName(listing.categoryId) ||
    listing.categoryName;

  return (
    <Card padded={false} className="overflow-hidden flex flex-col group">
      <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
        <Link to={`/marketplace/${favorite.listingId}`} className="block w-full h-full">
          <ProductImage
            src={listing.images?.[0]}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        <button
          type="button"
          disabled={isRemoving}
          onClick={() => onUnsave(entry)}
          aria-label={`Remove ${listing.title} from favorites`}
          title="Remove from favorites"
          className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
        >
          <Heart className="w-4 h-4 fill-red-500 text-red-500" />
        </button>
      </div>

      <Link
        to={`/marketplace/${favorite.listingId}`}
        className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5"
      >
        <div className="space-y-1">
          {categoryLabel && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              {categoryLabel}
            </p>
          )}
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {listing.title}
          </h3>
          {(listing.sellerSnapshot?.fullName || listing.sellerSnapshot?.isVerified) && (
            <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 min-w-0">
              <UserAvatar
                uid={listing.sellerId}
                src={listing.sellerSnapshot?.profilePic}
                name={listing.sellerSnapshot?.fullName || 'Campus Seller'}
                size="2xs"
              />
              <span className="truncate">
                {listing.sellerSnapshot?.fullName || 'Campus Seller'}
              </span>
              {listing.sellerSnapshot?.isVerified && (
                <VerifiedBadge
                  size="xs"
                  accountType={listing.sellerSnapshot?.accountType}
                />
              )}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-0.5 min-w-0">
            {isOnlineListing ? (
              <span className="truncate font-medium text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span>Online / Delivery</span>
              </span>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                <span className="truncate">{locationLabel}</span>
              </>
            )}
          </div>
        </div>

        <p
          className={`text-sm sm:text-base tabular-nums truncate ${
            priceInfo.isContact
              ? 'font-semibold text-blue-600 dark:text-blue-400'
              : 'font-bold text-slate-900 dark:text-white'
          }`}
        >
          {priceInfo.isContact && priceInfo.unitSuffix
            ? `${priceInfo.text} ${priceInfo.unitSuffix}`
            : priceInfo.text}
        </p>
      </Link>
    </Card>
  );
});

export function BuyerDashboard() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  interface CachedBuyerDash {
    savedItems: FavoriteWithListing[];
    enquiries: Enquiry[];
  }
  const initialCached = user?.uid
    ? getFastCache<CachedBuyerDash>(`buyer_dash:${user.uid}`)
    : null;

  const [activeTab, setActiveTab] = useState<BuyerTab>('saved');
  const [savedItems, setSavedItems] = useState<FavoriteWithListing[]>(
    () => initialCached?.savedItems ?? []
  );
  const [enquiries, setEnquiries] = useState<Enquiry[]>(
    () => initialCached?.enquiries ?? []
  );
  const [loading, setLoading] = useState<boolean>(
    () => Boolean(user?.uid) && !initialCached
  );
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Record<string, boolean>>({});

  const loadBuyerData = useCallback(async () => {
    if (!user?.uid) {
      setSavedItems([]);
      setEnquiries([]);
      setLoading(false);
      return;
    }

    const cached = getFastCache<CachedBuyerDash>(`buyer_dash:${user.uid}`);
    if (cached) {
      setSavedItems(cached.savedItems);
      setEnquiries(cached.enquiries);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [favoritesResult, enquiriesResult] = await Promise.all([
        getUserFavorites(user.uid),
        getUserEnquiries(user.uid),
      ]);
      setSavedItems(favoritesResult);
      setEnquiries(enquiriesResult);
      setFastCache(`buyer_dash:${user.uid}`, {
        savedItems: favoritesResult,
        enquiries: enquiriesResult,
      });
    } catch (err) {
      if (!cached) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Unable to load your dashboard data right now.';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    saveDashboardMode('buyer');
  }, []);

  useEffect(() => {
    void loadBuyerData();
  }, [loadBuyerData]);

  const handleUnsaveItem = async (item: FavoriteWithListing) => {
    if (!user?.uid) return;
    const listingId = item.favorite.listingId;
    if (removingIds[listingId]) return;

    const previous = savedItems;
    setRemovingIds((prev) => ({ ...prev, [listingId]: true }));
    setSavedItems((prev) =>
      prev.filter((entry) => entry.favorite.listingId !== listingId)
    );

    try {
      await toggleFavorite(
        user.uid,
        listingId,
        item.favorite.listingType,
        true
      );
      showToast('Removed from saved items.', 'info');
    } catch (err) {
      setSavedItems(previous);
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not remove item from favorites.';
      showToast(message, 'error');
    } finally {
      setRemovingIds((prev) => {
        const next = { ...prev };
        delete next[listingId];
        return next;
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
      <SeoHead
        title="Buyer Dashboard"
        description="View your saved marketplace items and track sellers you have contacted on LASUEDPLUG."
      />
      <DashboardModeSwitcher activeMode="buyer" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3.5 min-w-0">
          <UserAvatar
            uid={user?.uid}
            src={getUserAvatarUrl(profile)}
            name={profile?.fullName || user?.displayName}
            email={user?.email}
            size="md"
          />
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              My Dashboard
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              View your saved marketplace items and track sellers you have contacted.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div
          role="tablist"
          aria-label="Buyer dashboard sections"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-full w-full sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'saved'}
            onClick={() => setActiveTab('saved')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 active:scale-95 whitespace-nowrap shrink-0 flex items-center justify-center gap-2 min-h-[48px] md:min-h-[38px] ${
              activeTab === 'saved'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4 text-red-500" aria-hidden="true" />
            <span>Saved Items</span>
            <span
              className={`tabular-nums text-xs ${
                activeTab === 'saved'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {savedItems.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'enquiries'}
            onClick={() => setActiveTab('enquiries')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 active:scale-95 whitespace-nowrap shrink-0 flex items-center justify-center gap-2 min-h-[48px] md:min-h-[38px] ${
              activeTab === 'enquiries'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>My Enquiries</span>
            <span
              className={`tabular-nums text-xs ${
                activeTab === 'enquiries'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {enquiries.length}
            </span>
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        activeTab === 'saved' ? (
          <CardSkeletonGrid
            count={4}
            columns={4}
            label="Loading saved items"
          />
        ) : (
          <div aria-label="Loading enquiries" className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-2.5 animate-pulse"
              >
                <div className="h-5 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        )
      ) : error ? (
        <ErrorState
          title="Could not load dashboard"
          message={error}
          onRetry={() => void loadBuyerData()}
        />
      ) : activeTab === 'saved' ? (
        savedItems.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Nothing here yet"
            description="Tap the heart icon on any marketplace listing to save items you want to revisit later."
            actionLabel="Browse Marketplace"
            actionTo="/marketplace"
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {savedItems.map((entry) => (
              <SavedListingCard
                key={entry.favorite.id || entry.favorite.listingId}
                entry={entry}
                isRemoving={Boolean(removingIds[entry.favorite.listingId])}
                onUnsave={(item) => void handleUnsaveItem(item)}
              />
            ))}
          </div>
        )
      ) : enquiries.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No enquiries yet"
          description="When you message a seller on WhatsApp from a listing page, your enquiry history will appear here."
          actionLabel="Explore Marketplace"
          actionTo="/marketplace"
        />
      ) : (
        <div className="space-y-3" aria-label="WhatsApp enquiry history">
          {enquiries.map((enquiry, index) => (
            <div
              key={enquiry.id || `${enquiry.listingId}-${index}`}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:shadow-sm transition-shadow"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageCircle
                    className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                    aria-hidden="true"
                  />
                  <Link
                    to={`/marketplace/${enquiry.listingId}`}
                    className="text-base font-bold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate"
                  >
                    {enquiry.listingTitle}
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    <span>
                      Seller ID:{' '}
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {enquiry.sellerId}
                      </span>
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    <span>Contacted {formatEnquiryDate(enquiry.createdAt)}</span>
                  </span>
                </div>
              </div>

              <Link
                to={`/marketplace/${enquiry.listingId}`}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[48px] md:min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-all duration-200 active:scale-95 whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <span>View Listing</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
