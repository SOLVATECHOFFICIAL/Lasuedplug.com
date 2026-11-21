import {
  FormEvent,
  TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  Clock,
  Flame,
  Lightbulb,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { SITE_TAGLINE, UPDATES_WHATSAPP_GROUP_LINK } from '../lib/constants';
import { compactMixedFeedForCache } from '../lib/firestoreQueryCache';
import { getHomeMixedFeed, getHomeMixedFeedDelta, primeMixedFeedEntities } from '../lib/homeService';
import {
  fetchHomeTrendingProductsFromServer,
  reconcileHomeMixedFeed,
} from '../lib/backgroundSync';
import {
  CACHE_HYDRATED_EVENT,
  getFastCache,
  getFastCacheEnvelope,
  setFastCache,
  touchFastCache,
} from '../lib/fastCache';
import {
  getMixedFeedItemSignature,
  haveListsDiverged,
  resolveSyncStrategy,
} from '../lib/syncCache';
import { useBackgroundSync } from '../lib/useBackgroundSync';
import { getTrendingItems } from '../lib/trendingService';
import {
  applyTwoHourTrendingShuffle,
  filterMixedFeedItems,
  HomeSortMode,
  MixedFeedItem,
  MixedFeedType,
  sortMixedFeedItems,
} from '../lib/trendingHelpers';
import {
  getRecentlyViewed,
  RecentlyViewedItem,
} from '../lib/recentlyViewed';
import {
  buildRouteKey,
  getSavedRouteViewState,
  saveRouteViewState,
} from '../lib/feedScrollState';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CardSkeleton } from '../components/feedback/Loading';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { MixedFeedCard } from '../components/marketplace/MixedFeedCard';
import { RecentlyViewedRow } from '../components/marketplace/RecentlyViewedRow';
import { SeoHead } from '../components/seo/SeoHead';

const PAGE_BATCH_SIZE = 12;
const PULL_REFRESH_THRESHOLD_PX = 64;

const CATEGORIES = [
  {
    title: 'Marketplace',
    description:
      'Textbooks, electronics, dorm essentials, and everyday items from students near you.',
    path: '/marketplace',
    icon: ShoppingBag,
    iconBg: 'bg-primary-50 dark:bg-primary-900/40 text-primary-500 dark:text-primary-300',
  },
  {
    title: 'Services',
    description:
      'Campus stores, tutoring, repairs, printing, tailoring, catering, and student skills.',
    path: '/services',
    icon: Wrench,
    iconBg: 'bg-orange-50 dark:bg-orange-950/50 text-accent-500 dark:text-orange-400',
  },
  {
    title: 'Accommodation',
    description:
      'Browse verified off-campus lodges, self-contained rooms, and hostels around Epe.',
    path: '/accommodation',
    icon: Building2,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
  },
  {
    title: 'Roommates',
    description:
      'Connect with compatible LASUED and LASU students looking to share accommodation.',
    path: '/roommates',
    icon: Users,
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
  },
];

const TRUST_BULLETS = [
  {
    title: 'Verified Student Profiles',
    description:
      'Identity verification badges help you recognize authentic LASUED, LASU, and Epe community members.',
  },
  {
    title: 'Admin-Approved Listings',
    description:
      'Every product, service, and accommodation listing goes through moderation before appearing publicly.',
  },
  {
    title: 'Secure Campus Connections',
    description:
      'Connect directly with peers on campus and confirm every item in person before transferring funds.',
  },
];

const SORT_TABS: Array<{
  id: HomeSortMode;
  label: string;
  icon: typeof Clock;
}> = [
  { id: 'newest', label: 'Newest', icon: Clock },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'top_rated', label: 'Top Rated', icon: Award },
];

const TYPE_FILTERS: Array<{ id: MixedFeedType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'item', label: 'Items' },
  { id: 'service', label: 'Services' },
  { id: 'accommodation', label: 'Rooms' },
];

interface HomeViewState {
  sortMode: HomeSortMode;
  typeFilter: MixedFeedType | 'all';
  verifiedOnly: boolean;
  visibleCount: number;
}

export function Home() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeKey = buildRouteKey(location.pathname, location.search);

  const restoredView = useMemo(
    () =>
      navigationType === 'POP'
        ? getSavedRouteViewState<HomeViewState>(location.key, routeKey)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.key]
  );

  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeSearch, setActiveSearch] = useState(initialQuery.trim());

  const [sortMode, setSortMode] = useState<HomeSortMode>(
    () => restoredView?.sortMode ?? 'newest'
  );
  const [typeFilter, setTypeFilter] = useState<MixedFeedType | 'all'>(() => {
    if (restoredView?.typeFilter) {
      return restoredView.typeFilter === 'store'
        ? 'service'
        : restoredView.typeFilter;
    }
    return 'all';
  });
  const [verifiedOnly, setVerifiedOnly] = useState(
    () => restoredView?.verifiedOnly ?? false
  );

  const [mixedItems, setMixedItems] = useState<MixedFeedItem[]>(
    () => getFastCache<MixedFeedItem[]>('home_mixed_feed') || []
  );
  const [trendingItems, setTrendingItems] = useState<MixedFeedItem[]>(
    () => getFastCache<MixedFeedItem[]>('home_trending_feed') || []
  );
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>(() =>
    getRecentlyViewed()
  );

  const [loading, setLoading] = useState(
    () => (getFastCache<MixedFeedItem[]>('home_mixed_feed') || []).length === 0
  );
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(
    () => restoredView?.visibleCount ?? PAGE_BATCH_SIZE
  );

  const filterDepsRef = useRef({
    activeSearch,
    verifiedOnly,
    typeFilter,
    sortMode,
  });

  useEffect(() => {
    saveRouteViewState<HomeViewState>(location.key, routeKey, {
      sortMode,
      typeFilter,
      verifiedOnly,
      visibleCount,
    });
  }, [location.key, routeKey, sortMode, typeFilter, verifiedOnly, visibleCount]);

  // Pull-to-refresh & trending lazy-fetch state
  const touchStartYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const hasFetchedTrendingRef = useRef(false);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const syncRecentlyViewed = useCallback(() => {
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  useEffect(() => {
    syncRecentlyViewed();
    window.addEventListener('lasuedplug:recently-viewed', syncRecentlyViewed);
    window.addEventListener('storage', syncRecentlyViewed);
    return () => {
      window.removeEventListener(
        'lasuedplug:recently-viewed',
        syncRecentlyViewed
      );
      window.removeEventListener('storage', syncRecentlyViewed);
    };
  }, [syncRecentlyViewed]);

  useEffect(() => {
    const handleHydrated = () => {
      const hydratedMixed = getFastCacheEnvelope<MixedFeedItem[]>('home_mixed_feed');
      if (hydratedMixed && hydratedMixed.data.length > 0) {
        setMixedItems((prev) =>
          hydratedMixed.isFull !== false || prev.length === 0
            ? hydratedMixed.data
            : prev
        );
        setLoading(false);
        primeMixedFeedEntities(
          hydratedMixed.data,
          hydratedMixed.isFull !== false
        );
      }
      const hydratedTrending = getFastCacheEnvelope<MixedFeedItem[]>('home_trending_feed');
      if (hydratedTrending && hydratedTrending.data.length > 0) {
        setTrendingItems((prev) =>
          hydratedTrending.isFull !== false || prev.length === 0
            ? hydratedTrending.data
            : prev
        );
      }
    };

    window.addEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    return () => {
      window.removeEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    };
  }, []);

  const loadFeeds = useCallback(async (isRefresh = false) => {
    const env = getFastCacheEnvelope<MixedFeedItem[]>('home_mixed_feed');
    const cachedMixed = env?.data || [];
    const hasCached = cachedMixed.length > 0;

    if (hasCached) {
      primeMixedFeedEntities(cachedMixed, env?.isFull !== false);
    }

    const strategy = resolveSyncStrategy({
      hasCached,
      lastSyncedAt: env?.syncedAt,
      lastFullSyncAt: env?.fullSyncAt,
      forceRefresh: isRefresh,
    });

    if (strategy === 'fresh-skip') {
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
      hasFetchedTrendingRef.current = false;
    } else if (!hasCached) {
      setLoading(true);
    }
    setError(null);

    try {
      let nextMixed: MixedFeedItem[] = cachedMixed;

      if (strategy === 'delta-sync' && hasCached) {
        const { items, addedCount } = await getHomeMixedFeedDelta(cachedMixed, 20);
        nextMixed = items;
        if (addedCount === 0) {
          touchFastCache('home_mixed_feed');
        } else {
          setMixedItems(items);
          setFastCache('home_mixed_feed', items, {
            localData: compactMixedFeedForCache(items, 24),
            isFull: true,
          });
        }
      } else {
        const mixedResult = await getHomeMixedFeed(20);
        nextMixed = mixedResult;
        setMixedItems(mixedResult);
        setFastCache('home_mixed_feed', mixedResult, {
          localData: compactMixedFeedForCache(mixedResult, 24),
          isFull: true,
        });
      }

      const derivedTrending = applyTwoHourTrendingShuffle(
        nextMixed.filter(
          (item) => item._type === 'item' || item._type === 'service'
        ),
        Date.now(),
        30
      );
      if (nextMixed.length === 0) {
        setTrendingItems([]);
        setFastCache('home_trending_feed', [], { localData: [], isFull: true });
      } else if (derivedTrending.length > 0) {
        setTrendingItems((prev) => (prev.length === 0 ? derivedTrending : prev));
        if (!getFastCache<MixedFeedItem[]>('home_trending_feed')?.length) {
          setFastCache('home_trending_feed', derivedTrending, {
            localData: compactMixedFeedForCache(derivedTrending, 24),
            isFull: true,
          });
        }
      }
    } catch (err) {
      if (!hasCached || isRefresh) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load marketplace feed. Please try again.';
        setError(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFeeds(false);
  }, [loadFeeds]);

  const mixedItemsRef = useRef(mixedItems);
  mixedItemsRef.current = mixedItems;
  const trendingItemsRef = useRef(trendingItems);
  trendingItemsRef.current = trendingItems;

  useBackgroundSync({
    enabled: true,
    onTick: useCallback(async ({ tickIndex, reason }) => {
      const result = await reconcileHomeMixedFeed({
        cachedMixed: mixedItemsRef.current,
        tickIndex,
        forceHeadCheck: reason === 'resume',
        limitPerCollection: 20,
      });

      if (!result.changed) {
        return;
      }

      if (
        haveListsDiverged(
          mixedItemsRef.current,
          result.items,
          getMixedFeedItemSignature
        )
      ) {
        setMixedItems(result.items);
        setFastCache('home_mixed_feed', result.items, {
          localData: compactMixedFeedForCache(result.items, 24),
          isFull: true,
        });
      }

      const hasProdOrSvc = result.items.some(
        (i) => i._type === 'item' || i._type === 'service'
      );
      if (!hasProdOrSvc) {
        if (trendingItemsRef.current.length > 0) {
          setTrendingItems([]);
        }
        setFastCache('home_trending_feed', [], { localData: [], isFull: true });
        return;
      }

      const removedProdSet = new Set(result.removedProductIds);
      const prevProdMixed = mixedItemsRef.current.filter(
        (i) => i._type === 'item' || i._type === 'service'
      );
      const nextProdMixed = result.items.filter(
        (i) => i._type === 'item' || i._type === 'service'
      );
      const prodSliceChanged = haveListsDiverged(
        prevProdMixed,
        nextProdMixed,
        getMixedFeedItemSignature
      );
      const prunedTrending =
        removedProdSet.size > 0
          ? trendingItemsRef.current.filter(
              (item) => !removedProdSet.has(item.id)
            )
          : trendingItemsRef.current;

      if (
        prodSliceChanged ||
        removedProdSet.size > 0 ||
        prunedTrending.length !== trendingItemsRef.current.length ||
        trendingItemsRef.current.length === 0
      ) {
        const freshTrendingRaw = await fetchHomeTrendingProductsFromServer();
        const nextTrending = freshTrendingRaw
          ? applyTwoHourTrendingShuffle(freshTrendingRaw, Date.now(), 30)
          : applyTwoHourTrendingShuffle(
              result.items.filter(
                (i) => i._type === 'item' || i._type === 'service'
              ),
              Date.now(),
              30
            );
        setTrendingItems(nextTrending);
        setFastCache('home_trending_feed', nextTrending, {
          localData: compactMixedFeedForCache(nextTrending, 24),
          isFull: true,
        });
      }
    }, []),
  });

  const handleSortTabChange = async (nextMode: HomeSortMode) => {
    setSortMode(nextMode);
    setVisibleCount(PAGE_BATCH_SIZE);

    if (nextMode === 'trending' && !hasFetchedTrendingRef.current && !loading) {
      hasFetchedTrendingRef.current = true;
      const trendingEnv = getFastCacheEnvelope<MixedFeedItem[]>('home_trending_feed');
      const strategy = resolveSyncStrategy({
        hasCached: Boolean(trendingEnv?.data?.length),
        lastSyncedAt: trendingEnv?.syncedAt,
        lastFullSyncAt: trendingEnv?.fullSyncAt,
        freshWindowMs: 10 * 60_000,
        fullReconcileMs: 60 * 60_000,
      });

      if (strategy === 'fresh-skip' && trendingEnv?.data) {
        primeMixedFeedEntities(
          trendingEnv.data,
          trendingEnv.isFull !== false
        );
        return;
      }

      const shouldShowSpinner = trendingItems.length === 0;
      if (shouldShowSpinner) {
        setTrendingLoading(true);
      }
      try {
        const freshTrending = await getTrendingItems();
        if (freshTrending.length > 0) {
          setTrendingItems(freshTrending);
          setFastCache('home_trending_feed', freshTrending, {
            localData: compactMixedFeedForCache(freshTrending, 24),
            isFull: true,
          });
        }
      } catch {
        // Keep derived/cached trending items if refresh fails transiently
      } finally {
        if (shouldShowSpinner) {
          setTrendingLoading(false);
        }
      }
    }
  };

  // Reset pagination batch only when filters/search actually change
  useEffect(() => {
    const prev = filterDepsRef.current;
    if (
      prev.activeSearch === activeSearch &&
      prev.verifiedOnly === verifiedOnly &&
      prev.typeFilter === typeFilter &&
      prev.sortMode === sortMode
    ) {
      return;
    }
    filterDepsRef.current = {
      activeSearch,
      verifiedOnly,
      typeFilter,
      sortMode,
    };
    setVisibleCount(PAGE_BATCH_SIZE);
  }, [activeSearch, verifiedOnly, typeFilter, sortMode]);

  const activeSourceList = useMemo(() => {
    if (sortMode === 'trending') {
      return trendingItems.length > 0 ? trendingItems : mixedItems;
    }
    return mixedItems;
  }, [sortMode, trendingItems, mixedItems]);

  const processedFeed = useMemo(() => {
    const filtered = filterMixedFeedItems(activeSourceList, {
      verifiedOnly,
      searchQuery: activeSearch,
      typeFilter,
    });
    return sortMixedFeedItems(filtered, sortMode);
  }, [activeSourceList, verifiedOnly, activeSearch, typeFilter, sortMode]);

  const displayedFeed = useMemo(
    () => processedFeed.slice(0, visibleCount),
    [processedFeed, visibleCount]
  );

  const hasMore = visibleCount < processedFeed.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) =>
            Math.min(processedFeed.length, prev + PAGE_BATCH_SIZE)
          );
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, processedFeed.length]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    setActiveSearch(trimmed);
    const nextParams = new URLSearchParams(searchParams);
    if (trimmed) {
      nextParams.set('q', trimmed);
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleClearHomeSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('q');
    setSearchParams(nextParams, { replace: true });
  };

  // Touch Pull-to-Refresh Handlers
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (window.scrollY <= 2 && e.touches.length === 1 && !refreshing) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = null;
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null || refreshing) return;
    if (window.scrollY > 2) {
      touchStartYRef.current = null;
      setPullDistance(0);
      return;
    }
    const delta = e.touches[0].clientY - touchStartYRef.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 88));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartYRef.current !== null && pullDistance >= PULL_REFRESH_THRESHOLD_PX) {
      void loadFeeds(true);
    }
    touchStartYRef.current = null;
    setPullDistance(0);
  };

  const isFeedSkeletonVisible = loading || (sortMode === 'trending' && trendingLoading);

  return (
    <div
      className="flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <SeoHead
        title="LASUEDPLUG — The Official LASUED & Epe Campus Marketplace"
        description={SITE_TAGLINE}
      />
      {/* Pull-to-Refresh Indicator */}
      {(pullDistance > 12 || refreshing) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 py-2.5 bg-primary-50 dark:bg-slate-900 border-b border-primary-100 dark:border-slate-800 text-xs font-semibold text-primary-700 dark:text-primary-300 transition-all"
        >
          {refreshing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Refreshing campus feed...</span>
            </>
          ) : pullDistance >= PULL_REFRESH_THRESHOLD_PX ? (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Release to refresh</span>
            </>
          ) : (
            <>
              <ArrowDown className="w-4 h-4" />
              <span>Pull down to refresh</span>
            </>
          )}
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary-50/80 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center space-y-5">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            Discover Your Campus Marketplace
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {SITE_TAGLINE} — built for LASUED students, LASU students, and the Epe
            community.
          </p>

          <form
            onSubmit={handleSearchSubmit}
            role="search"
            aria-label="Search campus marketplace, services, stores, and accommodation"
            className="max-w-2xl mx-auto pt-1"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200">
              <div className="flex items-center gap-2.5 flex-1 px-2.5">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSearchQuery(next);
                    if (!next.trim() && activeSearch) {
                      handleClearHomeSearch();
                    }
                  }}
                  placeholder="Search products, services, stores, or lodges..."
                  aria-label="Search products, services, stores, or accommodation"
                  className="w-full py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-transparent focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearHomeSearch}
                    aria-label="Clear search"
                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button type="submit" variant="primary" size="md" className="sm:px-6">
                Search
              </Button>
            </div>
          </form>

          {activeSearch && (
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span>
                Showing matching results for &ldquo;{activeSearch}&rdquo;.
              </span>
              <button
                type="button"
                onClick={handleClearHomeSearch}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Recently Viewed Row ("Jump Back In") */}
      <RecentlyViewedRow items={recentlyViewed} />

      {/* Category Quick Browse Grid */}
      {!activeSearch && (
        <section className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 pt-8 pb-4 space-y-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Browse by Category
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Everything students need across campus life in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <Link key={category.path} to={category.path} className="group block h-full">
                  <Card className="h-full flex flex-col justify-between space-y-3 p-4 sm:p-5 group-hover:border-primary-100 dark:group-hover:border-primary-800">
                    <div className="space-y-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${category.iconBg}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 flex items-center justify-between gap-2">
                          <span>{category.title}</span>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Mixed Campus Feed with Sort Tabs, Verified Filter & Infinite Scroll */}
      <section
        aria-label="Campus mixed feed"
        className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-8 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {sortMode === 'trending'
                ? 'Trending Around Campus'
                : sortMode === 'top_rated'
                  ? 'Top Rated Sellers & Stores'
                  : 'Campus Feed'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {sortMode === 'trending'
                ? 'Hot items and services rotated automatically every 2 hours.'
                : 'Latest items, campus services, stores, and rooms.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadFeeds(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
            <Link
              to="/marketplace"
              className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1 px-2 py-2 whitespace-nowrap shrink-0"
            >
              Explore Marketplace <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Sort Tabs, Type Filter & Verified Checkbox Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Sort Tabs */}
            <div
              role="tablist"
              aria-label="Feed sort order"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start max-w-full overflow-x-auto"
            >
              {SORT_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = sortMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => void handleSortTabChange(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        active
                          ? tab.id === 'trending'
                            ? 'text-orange-500'
                            : tab.id === 'top_rated'
                              ? 'text-amber-500'
                              : 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Verified Filter Checkbox */}
            <label className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Only show Verified Sellers</span>
              </span>
            </label>
          </div>

          {/* Content Type Filter Row */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
              {TYPE_FILTERS.map((opt) => {
                const active = typeFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTypeFilter(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                      active
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {!isFeedSkeletonVisible && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                Showing {displayedFeed.length} of {processedFeed.length}{' '}
                {processedFeed.length === 1 ? 'listing' : 'listings'}
              </p>
            )}
          </div>
        </div>

        {/* Feed Content */}
        {isFeedSkeletonVisible ? (
          <div
            role="status"
            aria-label="Loading campus feed"
            className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadFeeds(false)} />
        ) : processedFeed.length === 0 ? (
          <EmptyState
            icon={activeSearch || verifiedOnly ? SearchX : ShoppingBag}
            title={
              activeSearch || verifiedOnly || typeFilter !== 'all'
                ? 'No matching listings found'
                : 'Nothing here yet'
            }
            description={
              verifiedOnly
                ? 'No listings from verified sellers matched your current filter. Try turning off the Verified filter.'
                : activeSearch
                  ? `No listings matched "${activeSearch}".`
                  : 'Be the first to post a product, service, store, or room on LASUEDPLUG.'
            }
            actionLabel={
              activeSearch || verifiedOnly || typeFilter !== 'all'
                ? 'Reset Feed Filters'
                : 'Post a Listing'
            }
            onAction={
              activeSearch || verifiedOnly || typeFilter !== 'all'
                ? () => {
                    setVerifiedOnly(false);
                    setTypeFilter('all');
                    handleClearHomeSearch();
                  }
                : undefined
            }
            actionTo={
              activeSearch || verifiedOnly || typeFilter !== 'all'
                ? undefined
                : '/marketplace/create'
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
              {displayedFeed.map((item, index) => (
                <MixedFeedCard
                  key={`${item._type}-${item.id}`}
                  item={item}
                  priority={index < 4}
                />
              ))}
            </div>

            {/* Infinite Scroll Sentinel */}
            {hasMore && (
              <div
                ref={sentinelRef}
                className="flex flex-col items-center justify-center gap-3 py-4"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setVisibleCount((prev) =>
                      Math.min(processedFeed.length, prev + PAGE_BATCH_SIZE)
                    )
                  }
                >
                  Load more ({processedFeed.length - displayedFeed.length} remaining)
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Safety & Community Rules Section */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="bg-brand-navy text-white rounded-2xl p-8 sm:p-12 shadow-md space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-100">
              <ShieldCheck className="w-4 h-4 text-accent-500" />
              <span>Safety &amp; Community Rules</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Built on Trust
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Always inspect items carefully in person and meet in public, well-lit campus
              locations such as faculty courtyards, main gates, or student lounges before
              completing any transaction.
            </p>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TRUST_BULLETS.map((bullet) => (
              <li
                key={bullet.title}
                className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-2"
              >
                <div className="flex items-center gap-2 font-semibold text-white">
                  <CheckCircle2 className="w-5 h-5 text-accent-500 shrink-0" />
                  <span>{bullet.title}</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {bullet.description}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Community Suggestions & Updates Group Callout */}
        <div
          aria-label="Suggestions and updates"
          className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5"
        >
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Help Shape What We Add Next
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Want a new feature on LASUEDPLUG? Send us a suggestion or join our
                WhatsApp group to get new app &amp; site updates first.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <Link to="/suggestions" className="w-full sm:w-auto">
              <Button variant="primary" size="md" fullWidth className="sm:w-auto">
                <Lightbulb className="w-4 h-4" />
                <span>Suggest a Feature</span>
              </Button>
            </Link>
            <a
              href={UPDATES_WHATSAPP_GROUP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Join Updates Group</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
