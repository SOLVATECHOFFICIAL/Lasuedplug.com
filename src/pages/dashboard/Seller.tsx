import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingBag,
  Store as StoreIcon,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  calculateUnifiedSellerStats,
  canMarkOneAsSold,
  computeNextSoldOneUpdate,
  computeNextToggleActiveUpdate,
  filterUnifiedSellerListingsByTab,
  getSellerModuleBadgeLabel,
  getUnifiedStatusBadge,
  isListingSoldOut,
  isServiceAd,
  isUnifiedListingSoldOut,
  SellerModuleType,
  SellerTab,
  UnifiedSellerListing,
} from '../../lib/sellerHelpers';
import { saveDashboardMode } from '../../lib/dashboardMode';
import { getUserAvatarUrl } from '../../lib/authHelpers';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import {
  deleteUnifiedSellerListing,
  getAllSellerDashboardItems,
  markSellerListingSoldOne,
  toggleSellerListingActive,
} from '../../lib/sellerService';
import { Product } from '../../types';
import { DashboardModeSwitcher } from '../../components/dashboard/DashboardModeSwitcher';
import { ProductImage } from '../../components/marketplace/ProductImage';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Button } from '../../components/ui/Button';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { SeoHead } from '../../components/seo/SeoHead';

const TAB_CONFIG: Array<{ id: SellerTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'sold', label: 'Sold Out' },
];

function StatusBadgePill({ listing }: { listing: UnifiedSellerListing }) {
  const statusInfo = getUnifiedStatusBadge(listing);

  if (statusInfo.kind === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70 whitespace-nowrap shrink-0">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Pending Approval</span>
      </span>
    );
  }

  if (statusInfo.kind === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70 whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Active</span>
      </span>
    );
  }

  if (statusInfo.kind === 'sold') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0">
        <PackageCheck className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Sold Out</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0">
      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Hidden</span>
    </span>
  );
}

function ModuleTypeBadge({ type }: { type: SellerModuleType }) {
  const label = getSellerModuleBadgeLabel(type);
  switch (type) {
    case 'service':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70">
          <Wrench className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'accommodation':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/70">
          <Building2 className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'roommate':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/70">
          <Users className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'store':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/70">
          <StoreIcon className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'item':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <ShoppingBag className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
  }
}

export function SellerDashboard() {
  const { user, profile, loading: authLoading, isProfileComplete } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const initialCached = user?.uid
    ? getFastCache<UnifiedSellerListing[]>(`seller_dash:${user.uid}`)
    : null;
  const [listings, setListings] = useState<UnifiedSellerListing[]>(
    () => initialCached ?? []
  );
  const [loading, setLoading] = useState<boolean>(
    () => Boolean(user?.uid) && !initialCached
  );
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SellerTab>('all');

  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<UnifiedSellerListing | null>(
    null
  );
  const [deleting, setDeleting] = useState<boolean>(false);

  const redirectedRef = useRef(false);

  // Defense-in-depth guard ensuring profile completeness
  useEffect(() => {
    if (!authLoading && (!user || !isProfileComplete) && !redirectedRef.current) {
      redirectedRef.current = true;
      showToast('Please complete your profile to post a listing.', 'info');
      navigate('/dashboard/profile', { replace: true });
    }
  }, [authLoading, user, isProfileComplete, navigate, showToast]);

  const loadListings = useCallback(async () => {
    if (!user?.uid) {
      setListings([]);
      setLoading(false);
      return;
    }

    const cached = getFastCache<UnifiedSellerListing[]>(`seller_dash:${user.uid}`);
    if (cached) {
      setListings(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getAllSellerDashboardItems(user.uid);
      setListings(data);
      setFastCache(`seller_dash:${user.uid}`, data);
    } catch (err) {
      if (!cached) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Unable to load your dashboard listings.';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!authLoading && user && isProfileComplete) {
      void loadListings();
    }
  }, [authLoading, user, isProfileComplete, loadListings]);

  useEffect(() => {
    if (!deleteTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) {
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, deleting]);

  const stats = useMemo(() => calculateUnifiedSellerStats(listings), [listings]);

  const tabCounts = useMemo<Record<SellerTab, number>>(
    () => ({
      all: listings.length,
      active: filterUnifiedSellerListingsByTab(listings, 'active').length,
      pending: filterUnifiedSellerListingsByTab(listings, 'pending').length,
      sold: filterUnifiedSellerListingsByTab(listings, 'sold').length,
    }),
    [listings]
  );

  const filteredListings = useMemo(
    () => filterUnifiedSellerListingsByTab(listings, activeTab),
    [listings, activeTab]
  );

  const setItemBusy = (key: string, busy: boolean) => {
    setBusyIds((prev) => {
      if (busy) {
        return { ...prev, [key]: true };
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleMarkOneSold = async (item: UnifiedSellerListing) => {
    const product = item.productRef;
    const id = item.id;
    const busyKey = `${item.collectionName}:${id}`;
    if (!product || !id || busyIds[busyKey] || !canMarkOneAsSold(product)) return;

    const previousSnapshot = item;
    const optimisticNext = computeNextSoldOneUpdate(product);

    setListings((prev) =>
      prev.map((row) =>
        row.collectionName === item.collectionName && row.id === id
          ? {
              ...row,
              quantity: optimisticNext.quantity,
              status: optimisticNext.status,
              isActive: optimisticNext.isActive,
              productRef: {
                ...product,
                quantity: optimisticNext.quantity,
                status: optimisticNext.status,
                isActive: optimisticNext.isActive,
              },
            }
          : row
      )
    );
    setItemBusy(busyKey, true);

    try {
      const committed = await markSellerListingSoldOne(product);
      setListings((prev) =>
        prev.map((row) =>
          row.collectionName === item.collectionName && row.id === id
            ? {
                ...row,
                quantity: committed.quantity,
                status: committed.status,
                isActive: committed.isActive,
                productRef: { ...product, ...committed },
              }
            : row
        )
      );
      if (committed.quantity === 0) {
        showToast('Marked as sold out. Stock is now 0.', 'success');
      } else {
        showToast(
          `Stock updated: ${committed.quantity} remaining.`,
          'success'
        );
      }
    } catch (err) {
      setListings((prev) =>
        prev.map((row) =>
          row.collectionName === item.collectionName && row.id === id
            ? previousSnapshot
            : row
        )
      );
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to update stock count.';
      showToast(message, 'error');
    } finally {
      setItemBusy(busyKey, false);
    }
  };

  const handleToggleActive = async (item: UnifiedSellerListing) => {
    const product = item.productRef;
    const id = item.id;
    const busyKey = `${item.collectionName}:${id}`;
    if (!product || !id || busyIds[busyKey]) return;

    const nextActive = !product.isActive;
    const previousSnapshot = item;

    let optimisticNext: { isActive: boolean; status: Product['status'] };
    try {
      optimisticNext = computeNextToggleActiveUpdate(product, nextActive);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Sold out products cannot be activated without stock.',
        'info'
      );
      return;
    }

    setListings((prev) =>
      prev.map((row) =>
        row.collectionName === item.collectionName && row.id === id
          ? {
              ...row,
              isActive: optimisticNext.isActive,
              status: optimisticNext.status,
              productRef: { ...product, ...optimisticNext },
            }
          : row
      )
    );
    setItemBusy(busyKey, true);

    try {
      const committed = await toggleSellerListingActive(product, nextActive);
      setListings((prev) =>
        prev.map((row) =>
          row.collectionName === item.collectionName && row.id === id
            ? {
                ...row,
                isActive: committed.isActive,
                status: committed.status,
                productRef: { ...product, ...committed },
              }
            : row
        )
      );
      showToast(
        committed.isActive
          ? 'Listing is now active on the marketplace.'
          : 'Listing is now hidden from the marketplace.',
        'info'
      );
    } catch (err) {
      setListings((prev) =>
        prev.map((row) =>
          row.collectionName === item.collectionName && row.id === id
            ? previousSnapshot
            : row
        )
      );
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to update listing visibility.';
      showToast(message, 'error');
    } finally {
      setItemBusy(busyKey, false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id || deleting) return;
    const { id, collectionName } = deleteTarget;

    setDeleting(true);
    try {
      await deleteUnifiedSellerListing(id, collectionName);
      setListings((prev) =>
        prev.filter(
          (row) => !(row.id === id && row.collectionName === collectionName)
        )
      );
      setDeleteTarget(null);
      showToast('Deleted successfully.', 'success');
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not delete this entry. Please try again.';
      showToast(message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    saveDashboardMode('seller');
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
      <SeoHead
        title="Seller Dashboard"
        description="Manage all your Items, Services, Accommodations, Roommate posts, and Campus Stores on LASUEDPLUG."
      />
      <DashboardModeSwitcher activeMode="seller" />

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
              Seller Dashboard
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage all your Items, Services, Accommodations, Roommate posts, and Campus Stores in one place.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0 w-full sm:w-auto">
          {user?.uid && (
            <Link
              to={`/seller/${user.uid}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[48px] md:min-h-[42px] rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-sm font-semibold transition-all duration-200 active:scale-95 shadow-sm whitespace-nowrap"
            >
              <ExternalLink className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span>View Public Profile</span>
            </Link>
          )}
          <Link
            to="/store/create"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[48px] md:min-h-[42px] rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-sm font-semibold transition-all duration-200 active:scale-95 shadow-sm whitespace-nowrap"
          >
            <StoreIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            <span>Open Store</span>
          </Link>
          <Link
            to="/marketplace/create"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[48px] md:min-h-[42px] rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-all duration-200 active:scale-95 shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Sell New Item</span>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      {loading ? (
        <div
          aria-label="Loading seller statistics"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 animate-pulse"
            >
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <section
          aria-label="Seller overview statistics"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Listings
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                {stats.totalListings}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                Active
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {stats.activeListings}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                Pending Approval
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {stats.pendingApproval}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Views
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                {stats.totalViews.toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      {loading ? (
        <div
          aria-label="Loading seller listings"
          className="space-y-4"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 animate-pulse"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load seller listings"
          message={error}
          onRetry={() => void loadListings()}
        />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title="Nothing here yet"
          description="Be the first to post an item, campus service, room listing, roommate request, or open a Campus Store on LASUEDPLUG."
          actionLabel="Post a Listing"
          actionTo="/marketplace/create"
        />
      ) : (
        <section className="space-y-4" aria-label="Manage your listings">
          {/* Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div
              role="tablist"
              aria-label="Filter listings by status"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto hide-scrollbar max-w-full"
            >
              {TAB_CONFIG.map((tab) => {
                const isSelected = activeTab === tab.id;
                const count = tabCounts[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1.5 min-h-[48px] md:min-h-[38px] ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`tabular-nums text-xs ${
                        isSelected
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtered Tab Empty State */}
          {filteredListings.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                No listings in &ldquo;{TAB_CONFIG.find((t) => t.id === activeTab)?.label}&rdquo;
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Switch back to view all your listings or post a new item to the marketplace.
              </p>
              <div className="pt-1 flex items-center justify-center gap-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('all')}
                >
                  View All Listings
                </Button>
                <Link
                  to="/marketplace/create"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sell New Item</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredListings.map((item) => {
                const busyKey = `${item.collectionName}:${item.id}`;
                const isBusy = Boolean(busyIds[busyKey]);
                const product = item.productRef;
                const isMarketplaceProduct = Boolean(product);
                const isService = product ? isServiceAd(product) : false;
                const soldOut = product
                  ? isListingSoldOut(product)
                  : isUnifiedListingSoldOut(item);
                const showStockButton = product ? canMarkOneAsSold(product) : false;
                const toggleDisabled =
                  isBusy || (product ? !product.isActive && !isService && soldOut : true);

                return (
                  <article
                    key={busyKey || item.title}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Left: Thumbnail + Listing Info */}
                      <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
                        <Link
                          to={item.detailPath}
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 block"
                        >
                          <ProductImage
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            iconClassName="w-7 h-7 text-slate-400"
                          />
                        </Link>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadgePill listing={item} />
                            <ModuleTypeBadge type={item._type} />
                            {item.storeName && (
                              <>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                  ·
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                  <StoreIcon className="w-3 h-3 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                                  <span>{item.storeName}</span>
                                </span>
                              </>
                            )}
                            {item._type === 'item' &&
                              typeof item.quantity === 'number' && (
                                <>
                                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                    ·
                                  </span>
                                  <span
                                    className={`text-xs font-medium tabular-nums ${
                                      item.quantity === 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : item.quantity === 1
                                        ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {item.quantity === 0
                                      ? '0 left'
                                      : `${item.quantity} in stock`}
                                  </span>
                                </>
                              )}
                          </div>

                          <div className="space-y-0.5">
                            <Link
                              to={item.detailPath}
                              className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate"
                            >
                              {item.title}
                            </Link>
                            <p className="text-sm sm:text-base font-extrabold text-primary-700 dark:text-primary-400 tabular-nums">
                              {item.subtitle}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                            {isMarketplaceProduct && (
                              <>
                                <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                                  Views: {(item.viewCount || 0).toLocaleString()} | Contacts:{' '}
                                  {(item.contactCount || 0).toLocaleString()}
                                </span>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                  ·
                                </span>
                              </>
                            )}
                            <span className="truncate max-w-[260px]">
                              {item.locationLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Action Controls */}
                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 sm:gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                        {/* Toggle Active/Inactive Switch for Marketplace Products */}
                        {product && (
                          <div className="flex items-center gap-2 pr-1">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={product.isActive}
                              aria-label={`Toggle visibility for ${item.title}`}
                              disabled={toggleDisabled}
                              title={
                                toggleDisabled && soldOut
                                  ? 'Sold out products cannot be re-enabled without stock'
                                  : product.isActive
                                  ? 'Hide listing from marketplace'
                                  : 'Show listing on marketplace'
                              }
                              onClick={() => void handleToggleActive(item)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                product.isActive ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                                  product.isActive ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {product.isActive ? 'Visible' : 'Hidden'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Stock Management (Items only) */}
                          {showStockButton && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => void handleMarkOneSold(item)}
                              className="min-h-[40px] whitespace-nowrap"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <PackageCheck className="w-3.5 h-3.5" />
                              )}
                              <span>Mark 1 as Sold</span>
                            </Button>
                          )}

                          {/* Edit Link (Marketplace Items & Services) */}
                          {item.editPath && (
                            <Link
                              to={item.editPath}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[48px] md:min-h-[40px] text-xs font-medium rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 active:scale-95 whitespace-nowrap"
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </Link>
                          )}

                          {/* Delete Button (All 4 modules) */}
                          <button
                            type="button"
                            disabled={isBusy}
                            aria-label={`Delete ${item.title}`}
                            onClick={() => setDeleteTarget(item)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[48px] md:min-h-[40px] min-w-[48px] md:min-w-[40px] text-xs font-medium rounded-lg bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all duration-200 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            <span className="sm:hidden">Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
          onClick={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="delete-modal-title"
                    className="text-lg font-bold text-slate-900 dark:text-white"
                  >
                    Are you sure?
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                aria-label="Close confirmation dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              You are about to permanently delete{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                &ldquo;{deleteTarget.title}&rdquo;
              </span>{' '}
              ({getSellerModuleBadgeLabel(deleteTarget._type)}) from LASUEDPLUG.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="md"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Entry</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
