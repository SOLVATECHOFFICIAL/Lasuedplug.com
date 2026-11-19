import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  ChevronRight,
  Info,
  Loader2,
  PackageOpen,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  fetchAllApprovedActiveProducts,
  fetchMarketplaceProducts,
  fetchTrendingProducts,
  MARKETPLACE_PAGE_SIZE,
} from '../../lib/marketplaceService';
import {
  buildCatalogSummaryForAi,
  expandSearchQuery,
  findBestAndRelatedProducts,
} from '../../lib/aiSearchService';
import {
  getSubcategoriesForCategory,
  MASTER_CATEGORIES,
} from '../../lib/categories';
import {
  hasActiveMarketplaceFilters,
  MarketplaceFilters,
  MarketplaceSortOption,
} from '../../lib/marketplaceHelpers';
import { Product } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductCard } from '../../components/marketplace/ProductCard';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'most_contacted', label: 'Most Contacted' },
] as const;

export function MarketplaceIndex() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialSub = searchParams.get('sub') || '';
  const initialSort =
    (searchParams.get('sort') as MarketplaceSortOption) || 'newest';

  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [lastVisibleDoc, setLastVisibleDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialSub);
  const [sortBy, setSortBy] = useState<MarketplaceSortOption>(
    initialSort === 'price_asc' ||
      initialSort === 'price_desc' ||
      initialSort === 'most_contacted'
      ? initialSort
      : 'newest'
  );

  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiCorrectedQuery, setAiCorrectedQuery] = useState<string | null>(null);
  const [usedRelatedFallback, setUsedRelatedFallback] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiSearching, setAiSearching] = useState(false);

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  const isTypingSearch = searchQuery.trim().length > 0;
  const isSearchActive = debouncedSearch.trim().length > 0;

  // Debounce search input so AI search waits briefly after user pauses typing
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Close mobile filter drawer automatically when searching starts
  useEffect(() => {
    if (isTypingSearch && mobileFilterOpen) {
      setMobileFilterOpen(false);
    }
  }, [isTypingSearch, mobileFilterOpen]);

  // Sync URL params cleanly
  useEffect(() => {
    const nextParams: Record<string, string> = {};
    if (debouncedSearch.trim()) nextParams.q = debouncedSearch.trim();
    if (!debouncedSearch.trim()) {
      if (selectedCategory) nextParams.category = selectedCategory;
      if (selectedSubcategory) nextParams.sub = selectedSubcategory;
      if (sortBy !== 'newest') nextParams.sort = sortBy;
    }
    setSearchParams(nextParams, { replace: true });
  }, [
    debouncedSearch,
    selectedCategory,
    selectedSubcategory,
    sortBy,
    setSearchParams,
  ]);

  const activeFilters: MarketplaceFilters = useMemo(
    () => ({
      categoryId: selectedCategory || undefined,
      subcategory: selectedSubcategory || undefined,
      searchQuery: debouncedSearch || undefined,
      sortBy,
    }),
    [selectedCategory, selectedSubcategory, debouncedSearch, sortBy]
  );

  const filtersActive = useMemo(
    () =>
      hasActiveMarketplaceFilters({
        categoryId: selectedCategory,
        subcategory: selectedSubcategory,
        searchQuery,
        sortBy,
      }),
    [selectedCategory, selectedSubcategory, searchQuery, sortBy]
  );

  const activeFilterBadgeCount = useMemo(() => {
    let count = 0;
    if (selectedCategory) count += 1;
    if (selectedSubcategory) count += 1;
    if (sortBy !== 'newest') count += 1;
    return count;
  }, [selectedCategory, selectedSubcategory, sortBy]);

  const categoryOptions = useMemo(
    () => MASTER_CATEGORIES.map((c) => ({ value: c.id, label: c.name })),
    []
  );

  const subcategoryOptions = useMemo(
    () => getSubcategoriesForCategory(selectedCategory),
    [selectedCategory]
  );

  // Fetch Trending Carousel (Top 8 sorted by viewCount) once on mount
  useEffect(() => {
    let cancelled = false;
    async function loadTrending() {
      setTrendingLoading(true);
      try {
        const rows = await fetchTrendingProducts(8);
        if (!cancelled) {
          setTrendingProducts(rows);
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

  // Load main grid: AI Search mode when query is non-empty, otherwise paginated browse mode
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

    if (trimmedQuery) {
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setAiSearching(true);
      setAiKeywords([]);
      setAiAnswer(null);
      setAiCorrectedQuery(null);
      setUsedRelatedFallback(false);
      setAiNotice(null);

      try {
        const allProducts = await fetchAllApprovedActiveProducts();
        if (reqId !== requestIdRef.current) return;

        // Phase 1: Instant client-side typo-tolerant, compound-word & related results (<50ms)
        const instantResult = findBestAndRelatedProducts(allProducts, trimmedQuery);
        setProducts(instantResult.products);
        setUsedRelatedFallback(instantResult.usedRelatedFallback);
        setHasMore(false);
        setLastVisibleDoc(null);
        setLoading(false);

        // Phase 2: Full-catalog Gemini AI scan for deeper semantic intent, typo interpretation, and answer
        const catalogSummary = buildCatalogSummaryForAi(allProducts);
        const aiResult = await expandSearchQuery(
          trimmedQuery,
          catalogSummary,
          controller.signal
        );
        if (reqId !== requestIdRef.current) return;

        setAiKeywords(aiResult.keywords);
        setAiAnswer(aiResult.answer || null);
        setAiCorrectedQuery(aiResult.correctedQuery || null);
        if (aiResult.error) {
          setAiNotice(aiResult.error);
        }

        const smartResult = findBestAndRelatedProducts(
          allProducts,
          trimmedQuery,
          aiResult
        );

        setProducts(smartResult.products);
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
    setAiNotice(null);

    try {
      const result = await fetchMarketplaceProducts(
        MARKETPLACE_PAGE_SIZE,
        null,
        {
          categoryId: activeFilters.categoryId,
          subcategory: activeFilters.subcategory,
          sortBy: activeFilters.sortBy,
        }
      );
      if (reqId !== requestIdRef.current) return;
      setProducts(result.products);
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
  }, [
    debouncedSearch,
    activeFilters.categoryId,
    activeFilters.subcategory,
    activeFilters.sortBy,
  ]);

  useEffect(() => {
    void loadInitialProducts();
  }, [loadInitialProducts]);

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
          categoryId: activeFilters.categoryId,
          subcategory: activeFilters.subcategory,
          sortBy: activeFilters.sortBy,
        }
      );
      if (reqId !== requestIdRef.current) return;

      setProducts((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const uniqueNext = result.products.filter((item) => !seen.has(item.id));
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
  }, [
    isSearchActive,
    loading,
    loadingMore,
    hasMore,
    lastVisibleDoc,
    activeFilters.categoryId,
    activeFilters.subcategory,
    activeFilters.sortBy,
  ]);

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

  const handleCategoryChange = (nextCategory: string) => {
    setSelectedCategory(nextCategory);
    setSelectedSubcategory('');
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setAiKeywords([]);
    setAiAnswer(null);
    setAiCorrectedQuery(null);
    setUsedRelatedFallback(false);
    setAiNotice(null);
    setSelectedCategory('');
    setSelectedSubcategory('');
    setSortBy('newest');
    setMobileFilterOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-24 md:pb-12 space-y-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Campus Marketplace
          </h1>
          <p className="text-sm text-slate-600">
            Browse verified items and campus deals from LASUED, LASU, and Epe sellers.
          </p>
        </div>

        <div className="hidden md:flex shrink-0">
          <Link to="/marketplace/create">
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Sell Something
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Section: Trending Carousel (Top 8 by viewCount) */}
      {!trendingLoading && trendingProducts.length > 0 && (
        <section aria-labelledby="trending-heading" className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-500 shrink-0" />
              <h2
                id="trending-heading"
                className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight"
              >
                Trending on Campus
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500 inline-flex items-center gap-1">
              <span>Swipe</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div
            data-testid="trending-carousel"
            className="flex overflow-x-auto snap-x snap-mandatory gap-4 hide-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {trendingProducts.map((product) => (
              <div
                key={`trending-${product.id || product.title}`}
                className="w-64 shrink-0 snap-start"
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search & Filter Bar */}
      <section aria-label="Search and filter marketplace" className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Magic Search Input */}
            <div
              className={`${
                isTypingSearch ? 'md:col-span-12' : 'md:col-span-5'
              } space-y-1.5 transition-all`}
            >
              <label
                htmlFor="marketplace-search"
                className="block text-sm font-medium text-slate-700"
              >
                Search Marketplace
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="marketplace-search"
                    type="text"
                    role="searchbox"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ask anything or search (e.g. 'eat bread', 'niky snikers', 'boil water in hostel')..."
                    aria-label="Search marketplace products"
                    className="w-full pl-9 pr-9 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setDebouncedSearch('');
                        setAiKeywords([]);
                        setAiAnswer(null);
                        setAiCorrectedQuery(null);
                        setUsedRelatedFallback(false);
                        setAiNotice(null);
                      }}
                      aria-label="Clear search"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Mobile Filter Trigger (hidden while searching) */}
                {!isTypingSearch && (
                  <button
                    type="button"
                    onClick={() => setMobileFilterOpen(true)}
                    aria-label="Open marketplace filters"
                    className="md:hidden inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium shadow-sm shrink-0 whitespace-nowrap"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                    <span>Filters</span>
                    {activeFilterBadgeCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-primary-500 text-white tabular-nums">
                        {activeFilterBadgeCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Category, Subcategory & Sort Dropdowns (Hidden while typing a search query) */}
            {!isTypingSearch && (
              <>
                <div className="hidden md:block md:col-span-3">
                  <Select
                    label="Category"
                    aria-label="Category"
                    placeholder="All Categories"
                    options={categoryOptions}
                    value={selectedCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  />
                </div>

                <div className="hidden md:block md:col-span-2">
                  <Select
                    label="Subcategory"
                    aria-label="Subcategory"
                    placeholder={
                      selectedCategory ? 'All Subcategories' : 'Select category'
                    }
                    options={subcategoryOptions}
                    value={selectedSubcategory}
                    disabled={!selectedCategory}
                    onChange={(e) => setSelectedSubcategory(e.target.value)}
                  />
                </div>

                <div className="hidden md:block md:col-span-2">
                  <div className="w-full space-y-1.5">
                    <label
                      htmlFor="marketplace-sort-desktop"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Sort By
                    </label>
                    <select
                      id="marketplace-sort-desktop"
                      aria-label="Sort By"
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as MarketplaceSortOption)
                      }
                      className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* AI Search Status & Expanded Terms */}
          {isTypingSearch && aiSearching && (
            <div
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-primary-600 pt-1"
            >
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>AI is finding the best matches...</span>
            </div>
          )}

          {isSearchActive && !aiSearching && (aiAnswer || aiCorrectedQuery || aiKeywords.length > 0) && (
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
                        Interpreted as:
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

          {isSearchActive && !aiSearching && usedRelatedFallback && !aiNotice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700"
            >
              <Info className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
              <span>
                Showing closest related campus listings for &ldquo;{debouncedSearch.trim()}&rdquo;.
              </span>
            </div>
          )}

          {isSearchActive && !aiSearching && aiNotice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900"
            >
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{aiNotice}</span>
            </div>
          )}
        </div>
      </section>

      {/* Mobile Filter Drawer Modal (Only available when NOT searching) */}
      {mobileFilterOpen && !isTypingSearch && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label="Marketplace filters"
        >
          <div className="w-full bg-white rounded-t-2xl p-5 space-y-5 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Filter & Sort
              </h2>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                aria-label="Close filters"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Select
                label="Category"
                placeholder="All Categories"
                options={categoryOptions}
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
              />

              <Select
                label="Subcategory"
                placeholder={
                  selectedCategory ? 'All Subcategories' : 'Select category first'
                }
                options={subcategoryOptions}
                value={selectedSubcategory}
                disabled={!selectedCategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
              />

              <div className="w-full space-y-1.5">
                <label
                  htmlFor="marketplace-sort-mobile"
                  className="block text-sm font-medium text-slate-700"
                >
                  Sort By
                </label>
                <select
                  id="marketplace-sort-mobile"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as MarketplaceSortOption)
                  }
                  className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={handleClearFilters}
              >
                Clear Filters
              </Button>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => setMobileFilterOpen(false)}
              >
                Show Results
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      {loading ? (
        <Loading
          variant="skeleton"
          message={
            aiSearching
              ? 'AI is finding the best matches...'
              : 'Loading campus products...'
          }
        />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadInitialProducts()} />
      ) : products.length === 0 ? (
        <Card
          hoverable={false}
          className="max-w-md mx-auto my-8 border-dashed text-center py-10 space-y-4"
        >
          {filtersActive ? (
            <>
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <SearchX className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  No results found
                </h2>
                <p className="text-sm text-slate-500">
                  Try adjusting your search or filters to find what you&apos;re
                  looking for.
                </p>
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <PackageOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  No products listed yet
                </h2>
                <p className="text-sm text-slate-500">
                  Be the first student to list an item for sale on LASUEDPLUG.
                </p>
              </div>
              <div>
                <Link to="/marketplace/create">
                  <Button variant="primary" size="sm">
                    Sell Something
                  </Button>
                </Link>
              </div>
            </>
          )}
        </Card>
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
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div
            data-testid="marketplace-grid"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
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

      {/* Mobile Floating Action Button (FAB) */}
      <Link
        to="/marketplace/create"
        aria-label="Sell Something"
        className="md:hidden fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold shadow-lg transition-transform duration-200 active:scale-95"
      >
        <Plus className="w-4 h-4" />
        <span>Sell Something</span>
      </Link>
    </div>
  );
}
