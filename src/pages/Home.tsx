import {
  FormEvent,
  TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { SITE_TAGLINE } from '../lib/constants';
import { compactMixedFeedForCache } from '../lib/firestoreQueryCache';
import { getHomeMixedFeed } from '../lib/homeService';
import { getFastCache, setFastCache } from '../lib/fastCache';
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
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CardSkeleton } from '../components/feedback/Loading';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { MixedFeedCard } from '../components/marketplace/MixedFeedCard';
import { RecentlyViewedRow } from '../components/marketplace/RecentlyViewedRow';

const PAGE_BATCH_SIZE = 12;
const PULL_REFRESH_THRESHOLD_PX = 64;

const CATEGORIES = [
  {
    title: 'Marketplace',
    description:
      'Textbooks, electronics, dorm essentials, and everyday items from students near you.',
    path: '/marketplace',
    icon: ShoppingBag,
    iconBg: 'bg-primary-50 text-primary-500',
  },
  {
    title: 'Services',
    description:
      'Tutoring, graphic design, laundry, catering, hairstyling, and device repairs on campus.',
    path: '/services',
    icon: Wrench,
    iconBg: 'bg-orange-50 text-accent-500',
  },
  {
    title: 'Accommodation',
    description:
      'Browse verified off-campus lodges, self-contained rooms, and hostels around Epe.',
    path: '/accommodation',
    icon: Building2,
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Roommates',
    description:
      'Connect with compatible LASUED and LASU students looking to share accommodation.',
    path: '/roommates',
    icon: Users,
    iconBg: 'bg-indigo-50 text-indigo-600',
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
  { id: 'store', label: 'Stores' },
  { id: 'accommodation', label: 'Rooms' },
];

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeSearch, setActiveSearch] = useState(initialQuery.trim());

  const [sortMode, setSortMode] = useState<HomeSortMode>('newest');
  const [typeFilter, setTypeFilter] = useState<MixedFeedType | 'all'>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

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
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH_SIZE);

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

  const loadFeeds = useCallback(async (isRefresh = false) => {
    const cachedMixed = getFastCache<MixedFeedItem[]>('home_mixed_feed');
    const hasCached = Boolean(cachedMixed && cachedMixed.length > 0);

    if (isRefresh) {
      setRefreshing(true);
      hasFetchedTrendingRef.current = false;
    } else if (!hasCached) {
      setLoading(true);
    }
    setError(null);

    try {
      const mixedResult = await getHomeMixedFeed(20);
      setMixedItems(mixedResult);
      setFastCache('home_mixed_feed', compactMixedFeedForCache(mixedResult, 24));

      const derivedTrending = applyTwoHourTrendingShuffle(
        mixedResult.filter(
          (item) => item._type === 'item' || item._type === 'service'
        ),
        Date.now(),
        30
      );
      if (derivedTrending.length > 0) {
        setTrendingItems((prev) => (prev.length === 0 ? derivedTrending : prev));
        if (!getFastCache<MixedFeedItem[]>('home_trending_feed')?.length) {
          setFastCache(
            'home_trending_feed',
            compactMixedFeedForCache(derivedTrending, 24)
          );
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

  const handleSortTabChange = async (nextMode: HomeSortMode) => {
    setSortMode(nextMode);
    setVisibleCount(PAGE_BATCH_SIZE);

    if (nextMode === 'trending' && !hasFetchedTrendingRef.current && !loading) {
      hasFetchedTrendingRef.current = true;
      const shouldShowSpinner = trendingItems.length === 0;
      if (shouldShowSpinner) {
        setTrendingLoading(true);
      }
      try {
        const freshTrending = await getTrendingItems();
        if (freshTrending.length > 0) {
          setTrendingItems(freshTrending);
          setFastCache(
            'home_trending_feed',
            compactMixedFeedForCache(freshTrending, 24)
          );
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

  // Reset pagination batch when filters/search change
  useEffect(() => {
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
      {/* Pull-to-Refresh Indicator */}
      {(pullDistance > 12 || refreshing) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 py-2.5 bg-primary-50 border-b border-primary-100 text-xs font-semibold text-primary-700 transition-all"
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
      <section className="bg-gradient-to-b from-primary-50/80 via-white to-slate-50 border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center space-y-5">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Discover Your Campus Marketplace
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {SITE_TAGLINE} — built for LASUED students, LASU students, and the Epe
            community.
          </p>

          <form
            onSubmit={handleSearchSubmit}
            role="search"
            aria-label="Search campus marketplace, services, stores, and accommodation"
            className="max-w-2xl mx-auto pt-1"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200">
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
                  className="w-full py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearHomeSearch}
                    aria-label="Clear search"
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600">
              <span>
                Showing matching results for &ldquo;{activeSearch}&rdquo;.
              </span>
              <button
                type="button"
                onClick={handleClearHomeSearch}
                className="font-semibold text-blue-600 hover:text-blue-700"
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
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Browse by Category
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Everything students need across campus life in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <Link key={category.path} to={category.path} className="group block h-full">
                  <Card className="h-full flex flex-col justify-between space-y-3 p-4 sm:p-5 group-hover:border-primary-100">
                    <div className="space-y-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${category.iconBg}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors duration-200 flex items-center justify-between gap-2">
                          <span>{category.title}</span>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed line-clamp-2">
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
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {sortMode === 'trending'
                ? 'Trending Around Campus'
                : sortMode === 'top_rated'
                  ? 'Top Rated Sellers & Stores'
                  : 'Campus Feed'}
            </h2>
            <p className="text-sm text-slate-600">
              {sortMode === 'trending'
                ? 'Hot items and services rotated automatically every 2 hours.'
                : 'Latest products, student services, campus stores, and rooms.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadFeeds(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
            <Link
              to="/marketplace"
              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 px-2 py-2 whitespace-nowrap shrink-0"
            >
              Explore Marketplace <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Sort Tabs, Type Filter & Verified Checkbox Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Sort Tabs */}
            <div
              role="tablist"
              aria-label="Feed sort order"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start max-w-full overflow-x-auto"
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
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        active
                          ? tab.id === 'trending'
                            ? 'text-orange-500'
                            : tab.id === 'top_rated'
                              ? 'text-amber-500'
                              : 'text-blue-600'
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
            <label className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-700 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Only show Verified Sellers</span>
              </span>
            </label>
          </div>

          {/* Content Type Filter Row */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-slate-100">
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
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {!isFeedSkeletonVisible && (
              <p className="text-xs font-medium text-slate-500 tabular-nums">
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
      </section>
    </div>
  );
}
