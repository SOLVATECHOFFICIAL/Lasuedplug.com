import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  Camera,
  ChevronRight,
  Info,
  Loader2,
  MapPin,
  PackageOpen,
  Plus,
  Search,
  SearchX,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  fetchAllApprovedActiveProducts,
  fetchMarketplaceProducts,
  fetchTrendingProducts,
  MARKETPLACE_PAGE_SIZE,
} from '../../lib/marketplaceService';
import { getApprovedStores } from '../../lib/storeService';
import {
  buildCatalogSummaryForAi,
  expandSearchQuery,
  findBestAndRelatedProducts,
  searchByImage,
} from '../../lib/aiSearchService';
import {
  compressImageToBase64,
  dataUrlToInlinePart,
} from '../../lib/imageUtils';
import { PRODUCT_CATEGORIES } from '../../lib/categories';
import { getTimestampMillis } from '../../lib/homeHelpers';
import {
  hasActiveMarketplaceFilters,
  MarketplaceSortOption,
} from '../../lib/marketplaceHelpers';
import { Product, Store } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CardSkeletonGrid } from '../../components/feedback/Loading';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductImage } from '../../components/marketplace/ProductImage';

const SEARCH_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest to Oldest' },
  { value: 'price_asc', label: 'Price: Low to High' },
] as const;

type SearchSortValue = (typeof SEARCH_SORT_OPTIONS)[number]['value'];

interface SearchPhotoState {
  previewUrl: string;
  mimeType: string;
  data: string;
  name: string;
}

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

export function MarketplaceIndex() {
  const [searchParams, setSearchParams] = useSearchParams();
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

  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const [rawSearchProducts, setRawSearchProducts] = useState<Product[]>([]);
  const [browseProducts, setBrowseProducts] = useState<Product[]>([]);
  const [lastVisibleDoc, setLastVisibleDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchPhoto, setSearchPhoto] = useState<SearchPhotoState | null>(null);
  const [sortBy, setSortBy] = useState<SearchSortValue>(initialSort);

  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiCorrectedQuery, setAiCorrectedQuery] = useState<string | null>(null);
  const [usedRelatedFallback, setUsedRelatedFallback] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);

  const [activeBrowseTab, setActiveBrowseTab] = useState<'items' | 'stores'>(() =>
    searchParams.get('tab') === 'stores' ? 'stores' : 'items'
  );
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  const isTypingSearch =
    searchQuery.trim().length > 0 || Boolean(searchPhoto);
  const isSearchActive =
    debouncedSearch.trim().length > 0 || Boolean(searchPhoto);

  // Debounce search input so AI search waits briefly after user pauses typing
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Sync URL params cleanly
  useEffect(() => {
    const nextParams: Record<string, string> = {};
    if (activeBrowseTab === 'stores') {
      nextParams.tab = 'stores';
    }
    if (selectedCategory) {
      nextParams.category = selectedCategory;
    }
    if (debouncedSearch.trim()) {
      nextParams.q = debouncedSearch.trim();
      if (sortBy !== 'newest') nextParams.sort = sortBy;
    } else if (searchPhoto && sortBy !== 'newest') {
      nextParams.sort = sortBy;
    }
    setSearchParams(nextParams, { replace: true });
  }, [activeBrowseTab, debouncedSearch, searchPhoto, selectedCategory, sortBy, setSearchParams]);

  const loadStores = useCallback(async () => {
    setStoresLoading(true);
    setStoresError(null);
    try {
      const list = await getApprovedStores();
      setStores(list);
    } catch (err) {
      setStoresError(
        err instanceof Error ? err.message : 'Unable to load campus stores.'
      );
    } finally {
      setStoresLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeBrowseTab === 'stores' && stores.length === 0 && !storesLoading && !storesError) {
      void loadStores();
    }
  }, [activeBrowseTab, stores.length, storesLoading, storesError, loadStores]);

  const filtersActive = useMemo(
    () =>
      Boolean(searchPhoto) ||
      hasActiveMarketplaceFilters({
        categoryId: selectedCategory,
        searchQuery,
        sortBy: sortBy as MarketplaceSortOption,
      }),
    [searchPhoto, selectedCategory, searchQuery, sortBy]
  );

  // Fetch Trending Carousel (Top 8 sorted by viewCount, excluding houses) once on mount
  useEffect(() => {
    let cancelled = false;
    async function loadTrending() {
      setTrendingLoading(true);
      try {
        const rows = await fetchTrendingProducts(8);
        if (!cancelled) {
          setTrendingProducts(
            rows.filter((item) => item.categoryId !== 'accommodation')
          );
        }
      } catch {
        if (!cancelled) {
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
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setLastVisibleDoc(null);
    setHasMore(false);

    const trimmedQuery = debouncedSearch.trim();

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }

    if (trimmedQuery || searchPhoto) {
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setAiSearching(true);
      setAiKeywords([]);
      setAiAnswer(null);
      setAiCorrectedQuery(null);
      setUsedRelatedFallback(false);

      try {
        const allProducts = (await fetchAllApprovedActiveProducts()).filter(
          (item) => item.categoryId !== 'accommodation'
        );
        if (reqId !== requestIdRef.current) return;

        // Phase 1: Instant client-side typo-tolerant & compound-word results
        if (trimmedQuery) {
          const instantResult = findBestAndRelatedProducts(allProducts, trimmedQuery);
          setRawSearchProducts(instantResult.products);
          setUsedRelatedFallback(instantResult.usedRelatedFallback);
          setLoading(false);
        } else {
          setRawSearchProducts(allProducts);
          setLoading(false);
        }

        // Phase 2: Real Gemini AI scan (Visual Vision scan if photo attached, or text semantic scan)
        const catalogSummary = buildCatalogSummaryForAi(allProducts);
        const aiResult = searchPhoto
          ? await searchByImage(
              { mimeType: searchPhoto.mimeType, data: searchPhoto.data },
              catalogSummary,
              trimmedQuery,
              controller.signal
            )
          : await expandSearchQuery(
              trimmedQuery,
              catalogSummary,
              controller.signal
            );

        if (reqId !== requestIdRef.current) return;

        setAiKeywords(aiResult.keywords);
        setAiAnswer(aiResult.answer || null);
        setAiCorrectedQuery(aiResult.correctedQuery || null);

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
    setAiKeywords([]);
    setAiAnswer(null);
    setAiCorrectedQuery(null);
    setUsedRelatedFallback(false);
    setRawSearchProducts([]);

    try {
      const result = await fetchMarketplaceProducts(MARKETPLACE_PAGE_SIZE, null, {
        categoryId: selectedCategory || undefined,
        sortBy: 'newest',
      });
      if (reqId !== requestIdRef.current) return;
      setBrowseProducts(
        result.products.filter((item) => item.categoryId !== 'accommodation')
      );
      setLastVisibleDoc(result.lastVisibleDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to load marketplace listings. Please try again.';
      setError(msg);
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedSearch, searchPhoto, selectedCategory]);

  useEffect(() => {
    void loadInitialProducts();
  }, [loadInitialProducts]);

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

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      [s.name, s.description, s.category, s.locationName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [stores, searchQuery]);

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
          categoryId: selectedCategory || undefined,
          sortBy: 'newest',
        }
      );
      if (reqId !== requestIdRef.current) return;

      const cleanNext = result.products.filter(
        (item) => item.categoryId !== 'accommodation'
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

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await compressImageToBase64(file);
      const inline = dataUrlToInlinePart(dataUrl);
      setSearchPhoto({
        previewUrl: dataUrl,
        mimeType: inline.mimeType,
        data: inline.data,
        name: file.name,
      });
    } catch (err) {
      console.error('Photo compression error:', err);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedCategory('');
    setSearchPhoto(null);
    setAiKeywords([]);
    setAiAnswer(null);
    setAiCorrectedQuery(null);
    setUsedRelatedFallback(false);
    setSortBy('newest');
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Campus Marketplace
          </h1>
          <p className="text-sm text-slate-600">
            Browse verified items and campus deals from LASUED, LASU, and Epe sellers.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2.5 shrink-0">
          <Link to="/store/create" className="w-full sm:w-auto">
            <Button variant="outline" size="md" fullWidth className="sm:w-auto">
              <StoreIcon className="w-4 h-4" />
              <span>Open Store</span>
            </Button>
          </Link>
          <Link to="/marketplace/create" className="w-full sm:w-auto">
            <Button variant="primary" size="md" fullWidth className="sm:w-auto">
              <Plus className="w-4 h-4" />
              <span>Sell Something</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Section: Trending Carousel (Top 8 by viewCount) */}
      {activeBrowseTab === 'items' && !trendingLoading && trendingProducts.length > 0 && (
        <section aria-labelledby="trending-heading" className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-5 h-5 text-accent-500 shrink-0" />
              <h2
                id="trending-heading"
                className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate"
              >
                Trending on Campus
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500 inline-flex items-center gap-1 shrink-0">
              <span>Swipe</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div
            data-testid="trending-carousel"
            className="flex w-full max-w-full overflow-x-auto snap-x snap-mandatory gap-3.5 sm:gap-4 hide-scrollbar pb-2"
          >
            {trendingProducts.map((product) => (
              <div
                key={`trending-${product.id || product.title}`}
                className="w-56 sm:w-64 shrink-0 snap-start"
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sticky Search Bar & Filter Tabs */}
      <section
        aria-label="Search marketplace"
        className="sticky top-14 md:top-16 z-30 -mx-3.5 sm:mx-0 px-3.5 sm:px-0 py-1.5 bg-slate-50/95 backdrop-blur-sm"
      >
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-2 sm:p-3.5 space-y-2">
          {/* Top Mode Tabs + Category Quick Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div
              role="tablist"
              aria-label="Marketplace browse mode"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-full"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeBrowseTab === 'items'}
                onClick={() => setActiveBrowseTab('items')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-md text-xs sm:text-sm font-medium transition-all duration-200 active:scale-95 ${
                  activeBrowseTab === 'items'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span>Items</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeBrowseTab === 'stores'}
                onClick={() => setActiveBrowseTab('stores')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-md text-xs sm:text-sm font-medium transition-all duration-200 active:scale-95 ${
                  activeBrowseTab === 'stores'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <StoreIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Campus Stores</span>
              </button>
            </div>

            {activeBrowseTab === 'items' && filtersActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-all duration-200"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-2 sm:gap-3">
            {/* Search Input + Visual Photo Scan Button */}
            <div className="flex-1 min-w-0 space-y-1">
              <label
                htmlFor="marketplace-search"
                className="hidden sm:block text-xs font-medium text-slate-600"
              >
                {activeBrowseTab === 'stores' ? 'Search Campus Stores' : 'Search Marketplace'}
              </label>
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="marketplace-search"
                    type="text"
                    role="searchbox"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      activeBrowseTab === 'stores'
                        ? 'Search stores by name or category...'
                        : 'Search items, ask AI, or scan a photo...'
                    }
                    aria-label="Search marketplace products"
                    className="w-full min-w-0 pl-9 pr-20 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {(searchQuery || searchPhoto || selectedCategory) && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        aria-label="Clear search and filters"
                        className="p-2 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {activeBrowseTab === 'items' && (
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        aria-label="Search by photo"
                        title="Scan a picture to search"
                        className="p-2 rounded-md text-primary-600 hover:bg-primary-50 transition-all duration-200"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handlePhotoSelected(e)}
                    className="hidden"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {/* Category Filter (Strictly PRODUCT_CATEGORIES only) */}
            {activeBrowseTab === 'items' && (
              <div className="w-full md:w-56 space-y-1 shrink-0">
                <label
                  htmlFor="marketplace-category-filter"
                  className="hidden sm:block text-xs font-medium text-slate-600"
                >
                  Product Category
                </label>
                <select
                  id="marketplace-category-filter"
                  aria-label="Filter by product category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="block w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
                >
                  <option value="">All Categories</option>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Results (Search mode) */}
            {activeBrowseTab === 'items' && isTypingSearch && (
              <div className="w-full md:w-44 space-y-1 shrink-0">
                <label
                  htmlFor="marketplace-search-sort"
                  className="hidden sm:block text-xs font-medium text-slate-600"
                >
                  Sort Results
                </label>
                <select
                  id="marketplace-search-sort"
                  aria-label="Sort search results"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SearchSortValue)}
                  className="block w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
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

          {/* Selected Search Photo Chip */}
          {activeBrowseTab === 'items' && searchPhoto && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={searchPhoto.previewUrl}
                  alt="Search photo preview"
                  loading="lazy"
                  className="w-10 h-10 rounded-md object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    Visual AI Photo Search
                  </p>
                  <p className="text-xs text-slate-500 truncate">{searchPhoto.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSearchPhoto(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded hover:bg-slate-200/70 transition-all duration-200 shrink-0"
              >
                Remove
              </button>
            </div>
          )}

          {/* AI Search Status & Expanded Terms */}
          {activeBrowseTab === 'items' && isTypingSearch && aiSearching && (
            <div
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-primary-600 pt-1"
            >
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>
                {searchPhoto
                  ? 'AI is scanning your photo and finding matches...'
                  : 'AI is finding the best matches...'}
              </span>
            </div>
          )}

          {activeBrowseTab === 'items' &&
            isSearchActive &&
            !aiSearching &&
            (aiAnswer || aiCorrectedQuery || aiKeywords.length > 0) && (
              <div className="space-y-1.5 pt-1">
                {aiAnswer && (
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50/70 border border-blue-100 px-3 py-2 text-xs text-slate-800">
                    <Sparkles className="w-3.5 h-3.5 text-primary-600 shrink-0 mt-0.5" />
                    <span>{aiAnswer}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  {aiCorrectedQuery &&
                    aiCorrectedQuery.toLowerCase() !== debouncedSearch.trim().toLowerCase() && (
                      <span>
                        <strong className="font-semibold text-slate-700">
                          {searchPhoto ? 'Detected in photo:' : 'Interpreted as:'}
                        </strong>{' '}
                        {aiCorrectedQuery}
                      </span>
                    )}
                  {aiKeywords.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <Sparkles className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                      <span className="font-medium text-slate-700">
                        AI related terms:
                      </span>
                      <span>{aiKeywords.join(', ')}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

          {activeBrowseTab === 'items' && isSearchActive && !aiSearching && usedRelatedFallback && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700"
            >
              <Info className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
              <span>
                Showing closest related campus listings
                {debouncedSearch.trim() ? ` for "${debouncedSearch.trim()}"` : ''}.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Main Content Grid: Campus Stores OR Marketplace Products */}
      {activeBrowseTab === 'stores' ? (
        storesLoading ? (
          <CardSkeletonGrid
            count={6}
            columns={3}
            label="Loading campus stores..."
          />
        ) : storesError ? (
          <ErrorState message={storesError} onRetry={() => void loadStores()} />
        ) : filteredStores.length === 0 ? (
          <EmptyState
            icon={searchQuery.trim() ? SearchX : StoreIcon}
            title={searchQuery.trim() ? 'No stores found' : 'Nothing here yet'}
            description={
              searchQuery.trim()
                ? `No approved campus store matched "${searchQuery.trim()}".`
                : 'Be the first student entrepreneur to open a storefront on LASUEDPLUG.'
            }
            actionLabel={searchQuery.trim() ? 'Clear Search' : 'Open a Store'}
            actionTo={searchQuery.trim() ? undefined : '/store/create'}
            onAction={searchQuery.trim() ? () => setSearchQuery('') : undefined}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-medium text-slate-500 tabular-nums">
              Showing {filteredStores.length}{' '}
              {filteredStores.length === 1 ? 'campus store' : 'campus stores'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredStores.map((store) => (
                <Card
                  key={store.id || store.name}
                  padded={false}
                  className="overflow-hidden flex flex-col justify-between"
                >
                  <div className="aspect-[16/9] w-full bg-slate-100 overflow-hidden">
                    <ProductImage
                      src={store.logoUrl}
                      alt={store.name}
                      className="w-full h-full object-cover"
                      iconClassName="w-10 h-10 text-slate-400"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5 min-w-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-100">
                        {store.category || 'Campus Store'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {store.name}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {store.description}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 min-w-0 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{store.locationName || 'Campus'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBrowseTab('items');
                          setSearchQuery(store.name);
                          setDebouncedSearch(store.name);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 shrink-0 transition-all duration-200"
                      >
                        Browse items →
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      ) : loading ? (
        <CardSkeletonGrid
          count={8}
          columns={4}
          label={
            aiSearching
              ? 'AI is finding the best matches...'
              : 'Loading campus products...'
          }
        />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadInitialProducts()} />
      ) : products.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={SearchX}
            title="Nothing here yet"
            description="No listings matched your filters. Try adjusting your search, category filter, or photo."
            actionLabel="Reset Filters"
            onAction={handleClearFilters}
            secondaryActionLabel="Post a Listing"
            onSecondaryAction={() => {
              window.location.assign('/marketplace/create');
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
              className="text-xs font-medium text-slate-500 tabular-nums"
            >
              Showing {products.length}{' '}
              {products.length === 1 ? 'listing' : 'listings'}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-all duration-200"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div
            data-testid="marketplace-grid"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6"
          >
            {products.map((product) => (
              <ProductCard
                key={product.id || product.title}
                product={product}
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
                className="inline-flex items-center gap-2 text-sm text-slate-500 py-2"
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
