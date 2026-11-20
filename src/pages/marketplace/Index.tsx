import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  Camera,
  ChevronRight,
  Info,
  Loader2,
  PackageOpen,
  Plus,
  Search,
  SearchX,
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
import { Product } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductCard } from '../../components/marketplace/ProductCard';

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
  }, [debouncedSearch, searchPhoto, selectedCategory, sortBy, setSearchParams]);

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

      {/* Search Bar & PRODUCT_CATEGORIES Filter */}
      <section aria-label="Search marketplace" className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 sm:p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            {/* Search Input + Visual Photo Scan Button */}
            <div className="flex-1 space-y-1.5">
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
                    placeholder="Ask AI, type keywords, or scan a photo (e.g. 'eat bread', 'niky snikers')..."
                    aria-label="Search marketplace products"
                    className="w-full pl-9 pr-20 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {(searchQuery || searchPhoto || selectedCategory) && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        aria-label="Clear search and filters"
                        className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      aria-label="Search by photo"
                      title="Scan a picture to search"
                      className="p-1.5 rounded-md text-primary-600 hover:bg-primary-50 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
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
            <div className="w-full md:w-60 space-y-1.5 shrink-0">
              <label
                htmlFor="marketplace-category-filter"
                className="block text-sm font-medium text-slate-700"
              >
                Product Category
              </label>
              <select
                id="marketplace-category-filter"
                aria-label="Filter by product category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Product Categories</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Results (Search mode) */}
            {isTypingSearch && (
              <div className="w-full md:w-48 space-y-1.5 shrink-0">
                <label
                  htmlFor="marketplace-search-sort"
                  className="block text-sm font-medium text-slate-700"
                >
                  Sort Results
                </label>
                <select
                  id="marketplace-search-sort"
                  aria-label="Sort search results"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SearchSortValue)}
                  className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500"
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
          {searchPhoto && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={searchPhoto.previewUrl}
                  alt="Search photo preview"
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
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-200/70"
              >
                Remove
              </button>
            </div>
          )}

          {/* AI Search Status & Expanded Terms */}
          {isTypingSearch && aiSearching && (
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

          {isSearchActive && !aiSearching && usedRelatedFallback && (
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
                  Try adjusting your search, category filter, or photo to find
                  what you&apos;re looking for.
                </p>
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  Reset Filters
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
