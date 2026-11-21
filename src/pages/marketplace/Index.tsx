import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  ChevronRight,
  Info,
  Loader2,
  PackageOpen,
  Plus,
  Search,
  SearchX,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  fetchAllApprovedActiveProducts,
  fetchMarketplaceProducts,
  fetchMarketplaceProductsDelta,
  fetchTrendingProducts,
  MARKETPLACE_PAGE_SIZE,
  primeProductsListIntoCache,
} from '../../lib/marketplaceService';
import {
  buildRouteKey,
  getSavedRouteViewState,
  saveRouteViewState,
} from '../../lib/feedScrollState';
import {
  buildCatalogSummaryForAi,
  expandSearchQuery,
  findBestAndRelatedProducts,
} from '../../lib/aiSearchService';
import { PRODUCT_CATEGORIES } from '../../lib/categories';
import { getTimestampMillis } from '../../lib/homeHelpers';
import { compactListingsForCache } from '../../lib/firestoreQueryCache';
import {
  fetchAllApprovedActiveItemsFromServer,
  fetchTrendingProductsFromServer,
  reconcileMarketplaceBrowseSlice,
} from '../../lib/backgroundSync';
import {
  CACHE_HYDRATED_EVENT,
  getFastCache,
  getFastCacheEnvelope,
  setFastCache,
  touchFastCache,
} from '../../lib/fastCache';
import {
  FEED_FRESH_MS,
  getEntityContentSignature,
  getNewestCreatedAtMs,
  haveListsDiverged,
  mergeDeltaEntities,
  resolveSyncStrategy,
} from '../../lib/syncCache';
import { useBackgroundSync } from '../../lib/useBackgroundSync';
import {
  getListingAdType,
  hasActiveMarketplaceFilters,
  MarketplaceSortOption,
} from '../../lib/marketplaceHelpers';
import { Product } from '../../types';
import { Button } from '../../components/ui/Button';
import { CardSkeletonGrid } from '../../components/feedback/Loading';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { SeoHead } from '../../components/seo/SeoHead';

function getBrowseCacheKey(category: string): string {
  return category ? `mkt_browse_cat:${category}` : 'mkt_browse_default';
}

const SEARCH_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest to Oldest' },
  { value: 'price_asc', label: 'Price: Low to High' },
] as const;

type SearchSortValue = (typeof SEARCH_SORT_OPTIONS)[number]['value'];

function sortSearchResults(
  items: Product[],
  sortBy: SearchSortValue
): Product[] {
  const sorted = [...items];
  if (sortBy === 'price_asc') {
    sorted.sort((a, b) => {
      const aHasPrice = typeof a.price === 'number' && Number.isFinite(a.price);
      const bHasPrice = typeof b.price === 'number' && Number.isFinite(b.price);
      if (aHasPrice && bHasPrice) return (a.price as number) - (b.price as number);
      if (aHasPrice) return -1;
      if (bHasPrice) return 1;
      return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
    });
  } else {
    sorted.sort(
      (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
    );
  }
  return sorted;
}

interface MarketplaceViewState {
  browseProducts: Product[];
  rawSearchProducts: Product[];
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  selectedCategory: string;
  searchQuery: string;
  sortBy: SearchSortValue;
}

export function MarketplaceIndex() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeKey = buildRouteKey(location.pathname, location.search);

  const isLegacyStoresTab = searchParams.get('tab') === 'stores';
  const legacyStoreQuery = searchParams.get('q') || '';

  const restoredView = useMemo(
    () =>
      navigationType === 'POP'
        ? getSavedRouteViewState<MarketplaceViewState>(location.key, routeKey)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.key]
  );

  const initialQuery = searchParams.get('q') || '';
  const initialCategoryParam = searchParams.get('category') || '';
  const initialCategory = PRODUCT_CATEGORIES.some(
    (c) => c.id === initialCategoryParam
  )
    ? initialCategoryParam
    : '';
  const initialSortParam = searchParams.get('sort');
  const initialSort: SearchSortValue =
    initialSortParam === 'price_asc' ? 'price_asc' : 'newest';

  const [trendingProducts, setTrendingProducts] = useState<Product[]>(
    () => getFastCache<Product[]>('mkt_trending') || []
  );
  const [trendingLoading, setTrendingLoading] = useState(
    () => (getFastCache<Product[]>('mkt_trending') || []).length === 0
  );

  const [rawSearchProducts, setRawSearchProducts] = useState<Product[]>(
    () => restoredView?.rawSearchProducts || []
  );
  const [browseProducts, setBrowseProducts] = useState<Product[]>(() =>
    restoredView?.browseProducts?.length
      ? restoredView.browseProducts
      : !initialQuery
        ? getFastCache<Product[]>(getBrowseCacheKey(initialCategory)) || []
        : []
  );
  const [lastVisibleDoc, setLastVisibleDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(
      () => restoredView?.lastVisibleDoc ?? null
    );
  const [hasMore, setHasMore] = useState(() => restoredView?.hasMore ?? false);

  const [searchQuery, setSearchQuery] = useState(
    () => restoredView?.searchQuery ?? initialQuery
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => restoredView?.searchQuery ?? initialQuery
  );
  const [selectedCategory, setSelectedCategory] = useState(
    () => restoredView?.selectedCategory ?? initialCategory
  );
  const [sortBy, setSortBy] = useState<SearchSortValue>(
    () => restoredView?.sortBy ?? initialSort
  );

  const [usedRelatedFallback, setUsedRelatedFallback] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);

  const [loading, setLoading] = useState(() => {
    if (
      restoredView &&
      (restoredView.browseProducts.length > 0 ||
        restoredView.rawSearchProducts.length > 0)
    ) {
      return false;
    }
    return !initialQuery
      ? (getFastCache<Product[]>(getBrowseCacheKey(initialCategory)) || []).length === 0
      : true;
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restoredSliceOnMountRef = useRef(
    Boolean(
      restoredView &&
        (restoredView.browseProducts.length > 0 ||
          restoredView.rawSearchProducts.length > 0)
    )
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  const isTypingSearch = searchQuery.trim().length > 0;
  const isSearchActive = debouncedSearch.trim().length > 0;

  useEffect(() => {
    saveRouteViewState<MarketplaceViewState>(location.key, routeKey, {
      browseProducts,
      rawSearchProducts,
      lastVisibleDoc,
      hasMore,
      selectedCategory,
      searchQuery,
      sortBy,
    });
  }, [
    location.key,
    routeKey,
    browseProducts,
    rawSearchProducts,
    lastVisibleDoc,
    hasMore,
    selectedCategory,
    searchQuery,
    sortBy,
  ]);

  // Debounce search input so AI search waits briefly after user pauses typing
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Sync URL params cleanly only when serialized query actually changes
  useEffect(() => {
    if (isLegacyStoresTab) return;
    const nextParams: Record<string, string> = {};
    if (selectedCategory) {
      nextParams.category = selectedCategory;
    }
    if (debouncedSearch.trim()) {
      nextParams.q = debouncedSearch.trim();
      if (sortBy !== 'newest') nextParams.sort = sortBy;
    }
    const nextQueryString = new URLSearchParams(nextParams).toString();
    if (nextQueryString !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [isLegacyStoresTab, debouncedSearch, selectedCategory, sortBy, searchParams, setSearchParams]);

  useEffect(() => {
    const handleHydrated = () => {
      const hydratedTrending = getFastCacheEnvelope<Product[]>('mkt_trending');
      if (hydratedTrending && hydratedTrending.data.length > 0) {
        setTrendingProducts((prev) =>
          hydratedTrending.isFull !== false || prev.length === 0
            ? hydratedTrending.data
            : prev
        );
        setTrendingLoading(false);
        primeProductsListIntoCache(
          hydratedTrending.data,
          hydratedTrending.isFull !== false
        );
      }

      if (!debouncedSearch.trim()) {
        const hydratedBrowse = getFastCacheEnvelope<Product[]>(
          getBrowseCacheKey(selectedCategory)
        );
        if (hydratedBrowse && hydratedBrowse.data.length > 0) {
          setBrowseProducts((prev) =>
            prev.length > hydratedBrowse.data.length
              ? prev
              : hydratedBrowse.isFull !== false || prev.length === 0
                ? hydratedBrowse.data
                : prev
          );
          setLoading(false);
          primeProductsListIntoCache(
            hydratedBrowse.data,
            hydratedBrowse.isFull !== false
          );
        }
      }
    };

    window.addEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    return () => {
      window.removeEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    };
  }, [debouncedSearch, selectedCategory]);

  const filtersActive = useMemo(
    () =>
      hasActiveMarketplaceFilters({
        categoryId: selectedCategory,
        searchQuery,
        sortBy: sortBy as MarketplaceSortOption,
      }),
    [selectedCategory, searchQuery, sortBy]
  );

  // Fetch Trending Carousel (Top 8 sorted by viewCount, excluding houses) respecting freshness cooldown
  useEffect(() => {
    let cancelled = false;
    async function loadTrending() {
      const env = getFastCacheEnvelope<Product[]>('mkt_trending');
      const cached = env?.data || [];
      const hasCached = cached.length > 0;

      if (hasCached) {
        primeProductsListIntoCache(cached, env?.isFull !== false);
        setTrendingLoading(false);
      } else {
        setTrendingLoading(true);
      }

      const strategy = resolveSyncStrategy({
        hasCached,
        lastSyncedAt: env?.syncedAt,
        lastFullSyncAt: env?.fullSyncAt,
        freshWindowMs: 10 * 60_000,
        fullReconcileMs: 60 * 60_000,
      });

      if (strategy === 'fresh-skip') {
        return;
      }

      try {
        const rows = await fetchTrendingProducts(8);
        if (!cancelled) {
          const clean = rows.filter(
            (item) =>
              item.categoryId !== 'accommodation' &&
              getListingAdType(item) === 'item'
          );
          setTrendingProducts(clean);
          setFastCache('mkt_trending', clean, {
            localData: compactListingsForCache(clean, 8),
            isFull: true,
          });
        }
      } catch {
        if (!cancelled && !hasCached) {
          setTrendingProducts([]);
        }
      } finally {
        if (!cancelled) {
          setTrendingLoading(false);
        }
      }
    }
    void loadTrending();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load main grid: AI Search mode when searching, otherwise paginated browse mode (with PRODUCT_CATEGORIES filter)
  const loadInitialProducts = useCallback(async () => {
    if (isLegacyStoresTab) return;
    if (restoredSliceOnMountRef.current) {
      restoredSliceOnMountRef.current = false;
      setLoading(false);
      return;
    }
    const reqId = ++requestIdRef.current;
    const trimmedQuery = debouncedSearch.trim();
    const isDefaultBrowse = !trimmedQuery && !selectedCategory;
    const browseCacheKey = getBrowseCacheKey(selectedCategory);
    const browseEnv = !trimmedQuery
      ? getFastCacheEnvelope<Product[]>(browseCacheKey)
      : null;
    const cachedBrowse = browseEnv?.data || [];
    const hasCachedBrowse = cachedBrowse.length > 0;

    if (hasCachedBrowse) {
      setBrowseProducts(cachedBrowse);
      setLoading(false);
      primeProductsListIntoCache(cachedBrowse, browseEnv?.isFull !== false);
    } else {
      setLoading(true);
    }

    setError(null);
    setLastVisibleDoc(null);
    setHasMore(false);

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }

    if (trimmedQuery) {
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setAiSearching(true);
      setUsedRelatedFallback(false);

      try {
        const cachedAllEnv = getFastCacheEnvelope<Product[]>(
          'mkt_all_items',
          FEED_FRESH_MS
        );
        let allProducts: Product[];
        if (cachedAllEnv && cachedAllEnv.data.length > 0) {
          allProducts = cachedAllEnv.data;
        } else {
          allProducts = (await fetchAllApprovedActiveProducts('item')).filter(
            (item) =>
              item.categoryId !== 'accommodation' &&
              getListingAdType(item) === 'item'
          );
          setFastCache('mkt_all_items', allProducts, { idbOnly: true });
        }
        if (reqId !== requestIdRef.current) return;

        // Phase 1: Instant client-side typo-tolerant & compound-word results
        const instantResult = findBestAndRelatedProducts(allProducts, trimmedQuery);
        setRawSearchProducts(instantResult.products);
        setUsedRelatedFallback(instantResult.usedRelatedFallback);
        setLoading(false);

        // Phase 2: Background smart search expansion (cached in localStorage)
        const catalogSummary = buildCatalogSummaryForAi(allProducts);
        const aiResult = await expandSearchQuery(
          trimmedQuery,
          catalogSummary,
          controller.signal
        );

        if (reqId !== requestIdRef.current) return;

        const effectiveQuery =
          trimmedQuery || aiResult.correctedQuery || aiResult.keywords.join(' ');

        const smartResult = findBestAndRelatedProducts(
          allProducts,
          effectiveQuery,
          aiResult
        );

        setRawSearchProducts(smartResult.products);
        setUsedRelatedFallback(smartResult.usedRelatedFallback);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (reqId !== requestIdRef.current) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to search marketplace listings. Please try again.';
        setError(msg);
      } finally {
        if (reqId === requestIdRef.current) {
          setAiSearching(false);
          setLoading(false);
        }
      }
      return;
    }

    setAiSearching(false);
    setUsedRelatedFallback(false);
    setRawSearchProducts([]);

    const strategy = resolveSyncStrategy({
      hasCached: hasCachedBrowse,
      lastSyncedAt: browseEnv?.syncedAt,
      lastFullSyncAt: browseEnv?.fullSyncAt,
    });

    if (strategy === 'fresh-skip') {
      setLoading(false);
      return;
    }

    if (isDefaultBrowse && strategy === 'delta-sync' && hasCachedBrowse) {
      try {
        const newestMs = getNewestCreatedAtMs(cachedBrowse);
        const delta = await fetchMarketplaceProductsDelta(newestMs, {
          adType: 'item',
        });
        if (reqId !== requestIdRef.current) return;

        if (delta.length === 0) {
          touchFastCache(browseCacheKey);
        } else {
          const merged = mergeDeltaEntities(
            cachedBrowse,
            delta,
            (item) => item.id,
            (item) => getTimestampMillis(item.createdAt),
            60
          );
          setBrowseProducts(merged);
          setFastCache(browseCacheKey, merged, {
            localData: compactListingsForCache(merged, 24),
            isFull: true,
          });
        }
        setLoading(false);
        return;
      } catch {
        // Fall back to full fetch below if delta errors transiently
      }
    }

    try {
      const result = await fetchMarketplaceProducts(MARKETPLACE_PAGE_SIZE, null, {
        adType: 'item',
        categoryId: selectedCategory || undefined,
        sortBy: 'newest',
      });
      if (reqId !== requestIdRef.current) return;
      const cleanProducts = result.products.filter(
        (item) =>
          item.categoryId !== 'accommodation' &&
          getListingAdType(item) === 'item'
      );
      setBrowseProducts(cleanProducts);
      setFastCache(browseCacheKey, cleanProducts, {
        localData: compactListingsForCache(cleanProducts, 24),
        isFull: true,
      });
      setLastVisibleDoc(result.lastVisibleDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      if (!hasCachedBrowse) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to load marketplace listings. Please try again.';
        setError(msg);
      }
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedSearch, selectedCategory, isLegacyStoresTab]);

  useEffect(() => {
    void loadInitialProducts();
  }, [loadInitialProducts]);

  const browseProductsRef = useRef(browseProducts);
  browseProductsRef.current = browseProducts;
  const trendingProductsRef = useRef(trendingProducts);
  trendingProductsRef.current = trendingProducts;
  const rawSearchProductsRef = useRef(rawSearchProducts);
  rawSearchProductsRef.current = rawSearchProducts;
  const debouncedSearchRef = useRef(debouncedSearch);
  debouncedSearchRef.current = debouncedSearch;
  const selectedCategoryRef = useRef(selectedCategory);
  selectedCategoryRef.current = selectedCategory;

  useBackgroundSync({
    enabled: !isLegacyStoresTab,
    onTick: useCallback(async ({ tickIndex, reason }) => {
      const cat = selectedCategoryRef.current;
      const browseCacheKey = getBrowseCacheKey(cat);
      const currentList = browseProductsRef.current;
      const targetLimit = Math.max(
        MARKETPLACE_PAGE_SIZE,
        currentList.length || MARKETPLACE_PAGE_SIZE
      );

      const res = await reconcileMarketplaceBrowseSlice({
        cachedProducts: currentList,
        categoryId: cat || undefined,
        limitCount: targetLimit,
        tickIndex,
        forceHeadCheck: reason === 'resume',
      });

      if (!res.changed) {
        return;
      }

      if (
        haveListsDiverged(
          currentList,
          res.items,
          getEntityContentSignature
        )
      ) {
        setBrowseProducts(res.items);
        setFastCache(browseCacheKey, res.items, {
          localData: compactListingsForCache(res.items, 24),
          isFull: true,
        });
      }

      if (res.cleared && !cat) {
        if (trendingProductsRef.current.length > 0) {
          setTrendingProducts([]);
        }
        if (rawSearchProductsRef.current.length > 0) {
          setRawSearchProducts([]);
        }
        return;
      }

      const freshTrending = await fetchTrendingProductsFromServer(8);
      if (freshTrending) {
        if (
          haveListsDiverged(
            trendingProductsRef.current,
            freshTrending,
            getEntityContentSignature
          )
        ) {
          setTrendingProducts(freshTrending);
          setFastCache('mkt_trending', freshTrending, {
            localData: compactListingsForCache(freshTrending, 8),
            isFull: true,
          });
        }
      } else if (res.removedIds.length > 0) {
        const remSet = new Set(res.removedIds);
        const pruned = trendingProductsRef.current.filter(
          (item) => !item.id || !remSet.has(item.id)
        );
        setTrendingProducts(pruned);
        setFastCache('mkt_trending', pruned, {
          localData: compactListingsForCache(pruned, 8),
          isFull: true,
        });
      }

      const activeQuery = debouncedSearchRef.current.trim();
      if (activeQuery) {
        const freshAll = await fetchAllApprovedActiveItemsFromServer();
        if (freshAll) {
          setFastCache('mkt_all_items', freshAll, { idbOnly: true });
          const nextMatched = findBestAndRelatedProducts(freshAll, activeQuery);
          setRawSearchProducts(nextMatched.products);
          setUsedRelatedFallback(nextMatched.usedRelatedFallback);
        }
      }
    }, []),
  });

  // Apply category filter (if chosen) & search sort filter
  const products = useMemo(() => {
    if (!isSearchActive) {
      return browseProducts;
    }
    const categoryFiltered = selectedCategory
      ? rawSearchProducts.filter((item) => item.categoryId === selectedCategory)
      : rawSearchProducts;
    return sortSearchResults(categoryFiltered, sortBy);
  }, [isSearchActive, browseProducts, rawSearchProducts, selectedCategory, sortBy]);

  // Load next 12 items for infinite scroll (browse mode)
  const loadMoreProducts = useCallback(async () => {
    if (isSearchActive || loading || loadingMore || !hasMore || !lastVisibleDoc) {
      return;
    }

    const reqId = requestIdRef.current;
    setLoadingMore(true);

    try {
      const result = await fetchMarketplaceProducts(
        MARKETPLACE_PAGE_SIZE,
        lastVisibleDoc,
        {
          adType: 'item',
          categoryId: selectedCategory || undefined,
          sortBy: 'newest',
        }
      );
      if (reqId !== requestIdRef.current) return;

      const cleanNext = result.products.filter(
        (item) =>
          item.categoryId !== 'accommodation' &&
          getListingAdType(item) === 'item'
      );

      setBrowseProducts((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const uniqueNext = cleanNext.filter((item) => !seen.has(item.id));
        return [...prev, ...uniqueNext];
      });
      setLastVisibleDoc(result.lastVisibleDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load more products right now.';
      setError(msg);
    } finally {
      if (reqId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [isSearchActive, loading, loadingMore, hasMore, lastVisibleDoc, selectedCategory]);

  // IntersectionObserver for automatic infinite scroll
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || isSearchActive || !hasMore || loading || loadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreProducts();
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isSearchActive, hasMore, loading, loadingMore, loadMoreProducts]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedCategory('');
    setUsedRelatedFallback(false);
    setSortBy('newest');
  };

  if (isLegacyStoresTab) {
    const redirectTarget = legacyStoreQuery
      ? `/services?tab=stores&q=${encodeURIComponent(legacyStoreQuery)}`
      : '/services?tab=stores';
    return <Navigate to={redirectTarget} replace />;
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 space-y-6">
      <SeoHead
        title="Campus Marketplace"
        description="Browse verified items and campus deals from LASUED, LASU, and Epe sellers."
      />
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Campus Marketplace
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Browse verified items and campus deals from LASUED, LASU, and Epe sellers.
          </p>
        </div>

        <div className="flex shrink-0">
          <Link to="/marketplace/create" className="w-full sm:w-auto">
            <Button variant="primary" size="md" fullWidth className="sm:w-auto">
              <Plus className="w-4 h-4" />
              <span>Sell Something</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Section: Trending Carousel (Top 8 by viewCount) */}
      {!trendingLoading && trendingProducts.length > 0 && (
        <section aria-labelledby="trending-heading" className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-5 h-5 text-accent-500 shrink-0" />
              <h2
                id="trending-heading"
                className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate"
              >
                Trending on Campus
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 shrink-0">
              <span>Swipe</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div
            data-testid="trending-carousel"
            className="flex w-full max-w-full overflow-x-auto snap-x snap-mandatory gap-3.5 sm:gap-4 hide-scrollbar pb-2"
          >
            {trendingProducts.map((product, index) => (
              <div
                key={`trending-${product.id || product.title}`}
                className="w-56 sm:w-64 shrink-0 snap-start"
              >
                <ProductCard product={product} priority={index < 3} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sticky Search Bar & Category Filters */}
      <section
        aria-label="Search marketplace"
        className="sticky top-14 md:top-16 z-30 -mx-3.5 sm:mx-0 px-3.5 sm:px-0 py-1.5 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-2 sm:p-3.5 space-y-2">
          <div className="flex flex-col md:flex-row md:items-end gap-2 sm:gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="marketplace-search"
                  className="hidden sm:block text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Search Marketplace
                </label>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="hidden sm:inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all duration-200"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="marketplace-search"
                    type="text"
                    role="searchbox"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search items, food, books, electronics..."
                    aria-label="Search marketplace products"
                    className="w-full min-w-0 pl-9 pr-10 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  {(searchQuery || selectedCategory) && (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        aria-label="Clear search and filters"
                        className="p-2 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Category Filter (Strictly PRODUCT_CATEGORIES only) */}
            <div className="w-full md:w-56 space-y-1 shrink-0">
              <label
                htmlFor="marketplace-category-filter"
                className="hidden sm:block text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Product Category
              </label>
              <select
                id="marketplace-category-filter"
                aria-label="Filter by product category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="block w-full px-3 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
              >
                <option value="">All Categories</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Results (Search mode) */}
            {isTypingSearch && (
              <div className="w-full md:w-44 space-y-1 shrink-0">
                <label
                  htmlFor="marketplace-search-sort"
                  className="hidden sm:block text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Sort Results
                </label>
                <select
                  id="marketplace-search-sort"
                  aria-label="Sort search results"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SearchSortValue)}
                  className="block w-full px-3 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
                >
                  {SEARCH_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Stealth Smart Search Status */}
          {isTypingSearch && aiSearching && (
            <div
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 pt-1"
            >
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary-600 dark:text-primary-400" />
              <span>Searching marketplace...</span>
            </div>
          )}

          {isSearchActive && !aiSearching && usedRelatedFallback && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
            >
              <Info className="w-4 h-4 text-primary-500 dark:text-primary-400 shrink-0 mt-0.5" />
              <span>
                Showing closest related campus listings
                {debouncedSearch.trim() ? ` for "${debouncedSearch.trim()}"` : ''}.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Main Marketplace Products Grid */}
      {loading ? (
        <CardSkeletonGrid
          count={8}
          columns={4}
          label="Loading campus products..."
        />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadInitialProducts()} />
      ) : products.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={SearchX}
            title="Nothing here yet"
            description="No listings matched your filters. Try adjusting your search or category filter."
            actionLabel="Reset Filters"
            onAction={handleClearFilters}
            secondaryActionLabel="Post a Listing"
            onSecondaryAction={() => {
              navigate('/marketplace/create');
            }}
          />
        ) : (
          <EmptyState
            icon={PackageOpen}
            title="Nothing here yet"
            description="Be the first to post in this category on LASUEDPLUG."
            actionLabel="Post a Listing"
            actionTo="/marketplace/create"
          />
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              data-testid="marketplace-count"
              className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums"
            >
              Showing {products.length}{' '}
              {products.length === 1 ? 'listing' : 'listings'}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div
            data-testid="marketplace-grid"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6"
          >
            {products.map((product, index) => (
              <ProductCard
                key={product.id || product.title}
                product={product}
                priority={index < 4}
              />
            ))}
          </div>

          {/* Infinite Scroll Sentinel + Load More Button */}
          <div
            ref={sentinelRef}
            className="pt-4 flex flex-col items-center justify-center gap-3"
          >
            {loadingMore && (
              <div
                role="status"
                className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-2"
              >
                <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                <span>Loading more listings...</span>
              </div>
            )}
            {hasMore && !loadingMore && !isSearchActive && (
              <Button
                variant="outline"
                size="md"
                onClick={() => void loadMoreProducts()}
              >
                Load More Listings
              </Button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
