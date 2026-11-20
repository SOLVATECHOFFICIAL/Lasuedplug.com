import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  ExternalLink,
  Heart,
  MapPin,
  MessageCircle,
  PackageOpen,
  Store,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatEnquiryDate } from '../../lib/buyerHelpers';
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
import { ProductImage } from '../../components/marketplace/ProductImage';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Card } from '../../components/ui/Card';

type BuyerTab = 'saved' | 'enquiries';

export function BuyerDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<BuyerTab>('saved');
  const [savedItems, setSavedItems] = useState<FavoriteWithListing[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Record<string, boolean>>({});

  const loadBuyerData = useCallback(async () => {
    if (!user?.uid) {
      setSavedItems([]);
      setEnquiries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [favoritesResult, enquiriesResult] = await Promise.all([
        getUserFavorites(user.uid),
        getUserEnquiries(user.uid),
      ]);
      setSavedItems(favoritesResult);
      setEnquiries(enquiriesResult);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to load your dashboard data right now.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            View your saved marketplace items and track sellers you have contacted.
          </p>
        </div>

        <Link
          to="/dashboard/seller"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-sm font-semibold transition-colors shadow-sm whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Store className="w-4 h-4 text-primary-600" aria-hidden="true" />
          <span>Switch to Seller Dashboard</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div
          role="tablist"
          aria-label="Buyer dashboard sections"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl max-w-full"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'saved'}
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 min-h-[38px] ${
              activeTab === 'saved'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Heart className="w-4 h-4 text-red-500" aria-hidden="true" />
            <span>Saved Items</span>
            <span
              className={`tabular-nums text-xs ${
                activeTab === 'saved' ? 'text-primary-600' : 'text-slate-400'
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
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 min-h-[38px] ${
              activeTab === 'enquiries'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>My Enquiries</span>
            <span
              className={`tabular-nums text-xs ${
                activeTab === 'enquiries' ? 'text-primary-600' : 'text-slate-400'
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
          <div
            aria-label="Loading saved items"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3.5 w-1/3 bg-slate-200 rounded" />
                  <div className="h-5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-4 w-1/2 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div aria-label="Loading enquiries" className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-2.5 animate-pulse"
              >
                <div className="h-5 w-1/2 bg-slate-200 rounded" />
                <div className="h-4 w-1/3 bg-slate-200 rounded" />
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
            title="No saved items yet"
            description="Tap the heart icon on any marketplace listing to save items you want to revisit later."
            actionLabel="Browse Marketplace"
            actionTo="/marketplace"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {savedItems.map((entry) => {
              const { favorite, listing } = entry;
              const isRemoving = Boolean(removingIds[favorite.listingId]);

              if (!listing) {
                return (
                  <Card
                    key={favorite.id || favorite.listingId}
                    padded={false}
                    className="overflow-hidden flex flex-col justify-between"
                  >
                    <div className="relative aspect-[4/3] w-full bg-slate-100 flex flex-col items-center justify-center gap-2 text-slate-400">
                      <PackageOpen className="w-8 h-8" aria-hidden="true" />
                      <span className="text-xs font-medium text-slate-500">
                        Listing unavailable
                      </span>
                      <button
                        type="button"
                        disabled={isRemoving}
                        onClick={() => void handleUnsaveItem(entry)}
                        aria-label="Remove unavailable listing from favorites"
                        className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-white/95 border border-slate-200 shadow-sm flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                      </button>
                    </div>
                    <div className="p-3.5 sm:p-4 space-y-1">
                      <p className="text-sm font-semibold text-slate-700">
                        Item no longer available
                      </p>
                      <p className="text-xs text-slate-500">
                        Saved on {formatEnquiryDate(favorite.createdAt)}
                      </p>
                    </div>
                  </Card>
                );
              }

              const priceInfo = getProductPriceDisplay(listing);
              const locationLabel = getProductLocationLabel(listing);
              const isOnlineListing =
                listing.locationType === 'online' ||
                listing.serviceLocation === 'online';
              const categoryLabel =
                listing.subcategory ||
                getCategoryName(listing.categoryId) ||
                listing.categoryName;

              return (
                <Card
                  key={favorite.id || favorite.listingId}
                  padded={false}
                  className="overflow-hidden flex flex-col group"
                >
                  <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
                    <Link
                      to={`/marketplace/${favorite.listingId}`}
                      className="block w-full h-full"
                    >
                      <ProductImage
                        src={listing.images?.[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </Link>

                    <button
                      type="button"
                      disabled={isRemoving}
                      onClick={() => void handleUnsaveItem(entry)}
                      aria-label={`Remove ${listing.title} from favorites`}
                      title="Remove from favorites"
                      className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
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
                        <p className="text-xs font-medium text-slate-500 truncate">
                          {categoryLabel}
                        </p>
                      )}
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {listing.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-0.5 min-w-0">
                        {isOnlineListing ? (
                          <span className="truncate font-medium text-emerald-700 inline-flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 shrink-0" />
                            <span>Online / Delivery</span>
                          </span>
                        ) : (
                          <>
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{locationLabel}</span>
                          </>
                        )}
                      </div>
                    </div>

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
                  </Link>
                </Card>
              );
            })}
          </div>
        )
      ) : enquiries.length === 0 ? (
        <EmptyState
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
              className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:shadow-sm transition-shadow"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageCircle
                    className="w-4 h-4 text-emerald-600 shrink-0"
                    aria-hidden="true"
                  />
                  <Link
                    to={`/marketplace/${enquiry.listingId}`}
                    className="text-base font-bold text-slate-900 hover:text-primary-600 transition-colors truncate"
                  >
                    {enquiry.listingTitle}
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>
                      Seller ID:{' '}
                      <span className="font-mono text-slate-700">
                        {enquiry.sellerId}
                      </span>
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>Contacted {formatEnquiryDate(enquiry.createdAt)}</span>
                  </span>
                </div>
              </div>

              <Link
                to={`/marketplace/${enquiry.listingId}`}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
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
