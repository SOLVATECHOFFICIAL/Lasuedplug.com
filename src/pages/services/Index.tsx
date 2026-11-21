import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  SearchX,
  Store as StoreIcon,
  Wrench,
  X,
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../lib/categories';
import { compactListingsForCache } from '../../lib/firestoreQueryCache';
import {
  fetchApprovedActiveServices,
  fetchMarketplaceProductsDelta,
  primeProductsListIntoCache,
} from '../../lib/marketplaceService';
import { getLatestLegacyServices } from '../../lib/homeService';
import { getTimestampMillis } from '../../lib/homeHelpers';
import { warmImages } from '../../lib/imageCache';
import { getListingAdType } from '../../lib/marketplaceHelpers';
import {
  getApprovedStores,
  getApprovedStoresDelta,
  primeStoresIntoCache,
} from '../../lib/storeService';
import {
  buildRouteKey,
  getSavedRouteViewState,
  saveRouteViewState,
} from '../../lib/feedScrollState';
import { buildMixedServicesAndStoresFeed } from '../../lib/servicesFeedHelpers';
import { reconcileServicesAndStoresSlices } from '../../lib/backgroundSync';
import {
  CACHE_HYDRATED_EVENT,
  getFastCache,
  getFastCacheEnvelope,
  setFastCache,
  touchFastCache,
} from '../../lib/fastCache';
import {
  getEntityContentSignature,
  getNewestCreatedAtMs,
  haveListsDiverged,
  mergeDeltaEntities,
  primeLegacyServiceIntoCache,
  resolveSyncStrategy,
} from '../../lib/syncCache';
import { useBackgroundSync } from '../../lib/useBackgroundSync';
import { Product, Service, Store } from '../../types';
import { Button } from '../../components/ui/Button';
import { CardSkeletonGrid } from '../../components/feedback/Loading';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LegacyServiceCard } from '../../components/marketplace/MixedFeedCard';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { StoreCard } from '../../components/marketplace/StoreCard';
import { SeoHead } from '../../components/seo/SeoHead';

interface CachedServicesFeed {
  productServices: Product[];
  legacyServices: Service[];
}

interface ServicesViewState {
  selectedCategory: string;
  searchQuery: string;
}

export function ServicesIndex() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeKey = buildRouteKey(location.pathname, location.search);

  const restoredView = useMemo(
    () =>
      navigationType === 'POP'
        ? getSavedRouteViewState<ServicesViewState>(location.key, routeKey)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.key]
  );

  const initialTabParam = searchParams.get('tab');
  const initialQueryParam = searchParams.get('q') || '';

  const initialCached = getFastCache<CachedServicesFeed>('services_feed');
  const initialCachedStores = getFastCache<Store[]>('approved_stores');

  const [productServices, setProductServices] = useState<Product[]>(
    () => initialCached?.productServices || []
  );
  const [legacyServices, setLegacyServices] = useState<Service[]>(
    () => initialCached?.legacyServices || []
  );
  const [stores, setStores] = useState<Store[]>(
    () => initialCachedStores || []
  );
  const [loading, setLoading] = useState(
    () => !initialCached && (!initialCachedStores || initialCachedStores.length === 0)
  );
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    () =>
      restoredView?.selectedCategory ??
      (initialTabParam === 'stores' ? 'stores' : '')
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    () => restoredView?.searchQuery ?? initialQueryParam
  );

  useEffect(() => {
    saveRouteViewState<ServicesViewState>(location.key, routeKey, {
      selectedCategory,
      searchQuery,
    });
  }, [location.key, routeKey, selectedCategory, searchQuery]);

  useEffect(() => {
    const nextParams: Record<string, string> = {};
    if (selectedCategory === 'stores') {
      nextParams.tab = 'stores';
    }
    if (searchQuery.trim()) {
      nextParams.q = searchQuery.trim();
    }
    const nextQs = new URLSearchParams(nextParams).toString();
    if (nextQs !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [selectedCategory, searchQuery, searchParams, setSearchParams]);

  useEffect(() => {
    const handleHydrated = () => {
      const hydrated = getFastCacheEnvelope<CachedServicesFeed>('services_feed');
      if (hydrated) {
        setProductServices((prev) =>
          hydrated.isFull !== false || prev.length === 0
            ? hydrated.data.productServices
            : prev
        );
        setLegacyServices((prev) =>
          hydrated.isFull !== false || prev.length === 0
            ? hydrated.data.legacyServices
            : prev
        );
        setLoading(false);
        primeProductsListIntoCache(
          hydrated.data.productServices,
          hydrated.isFull !== false
        );
        hydrated.data.legacyServices.forEach((s) =>
          primeLegacyServiceIntoCache(s, {
            isFull: hydrated.isFull !== false,
            idbOnly: true,
          })
        );
      }

      const hydratedStores = getFastCacheEnvelope<Store[]>('approved_stores');
      if (hydratedStores && hydratedStores.data.length > 0) {
        setStores((prev) =>
          hydratedStores.isFull !== false || prev.length === 0
            ? hydratedStores.data
            : prev
        );
        setLoading(false);
        primeStoresIntoCache(
          hydratedStores.data,
          hydratedStores.isFull !== false
        );
      }
    };

    window.addEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    return () => {
      window.removeEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    };
  }, []);

  const loadServices = useCallback(async (forceRefresh = false) => {
    const servicesEnv = getFastCacheEnvelope<CachedServicesFeed>('services_feed');
    const cachedServices = servicesEnv?.data || null;
    const hasCachedServices = Boolean(
      cachedServices &&
        (cachedServices.productServices.length > 0 ||
          cachedServices.legacyServices.length > 0)
    );

    const storesEnv = getFastCacheEnvelope<Store[]>('approved_stores');
    const cachedStores = storesEnv?.data || [];
    const hasCachedStores = cachedStores.length > 0;

    if (hasCachedServices && cachedServices) {
      primeProductsListIntoCache(
        cachedServices.productServices,
        servicesEnv?.isFull !== false
      );
      cachedServices.legacyServices.forEach((s) =>
        primeLegacyServiceIntoCache(s, {
          isFull: servicesEnv?.isFull !== false,
          idbOnly: true,
        })
      );
      warmImages(
        cachedServices.legacyServices.map((s) => s.images?.[0]),
        12
      );
    }
    if (hasCachedStores) {
      setStores(cachedStores);
      primeStoresIntoCache(cachedStores, storesEnv?.isFull !== false);
    }

    const hasAnyCached = hasCachedServices || hasCachedStores;
    if (hasAnyCached) {
      setLoading(false);
    } else {
      setLoading(true);
    }

    const servicesStrategy = resolveSyncStrategy({
      hasCached: hasCachedServices,
      lastSyncedAt: servicesEnv?.syncedAt,
      lastFullSyncAt: servicesEnv?.fullSyncAt,
      forceRefresh,
    });
    const storesStrategy = resolveSyncStrategy({
      hasCached: hasCachedStores,
      lastSyncedAt: storesEnv?.syncedAt,
      lastFullSyncAt: storesEnv?.fullSyncAt,
      forceRefresh,
    });

    if (servicesStrategy === 'fresh-skip' && storesStrategy === 'fresh-skip') {
      setLoading(false);
      setError(null);
      return;
    }

    setError(null);

    const syncServices = async () => {
      if (servicesStrategy === 'fresh-skip') return;
      if (servicesStrategy === 'delta-sync' && cachedServices) {
        const newestProductMs = getNewestCreatedAtMs(
          cachedServices.productServices
        );
        const newestLegacyMs = getNewestCreatedAtMs(
          cachedServices.legacyServices
        );
        const [newProductServices, newRawServices] = await Promise.all([
          fetchMarketplaceProductsDelta(newestProductMs, { adType: 'service' }),
          getLatestLegacyServices(30, newestLegacyMs),
        ]);

        const filteredNewProducts = newProductServices.filter(
          (item) => getListingAdType(item) === 'service'
        );

        if (filteredNewProducts.length === 0 && newRawServices.length === 0) {
          touchFastCache('services_feed');
        } else {
          const mergedProducts = mergeDeltaEntities(
            cachedServices.productServices,
            filteredNewProducts,
            (item) => item.id,
            (item) => getTimestampMillis(item.createdAt),
            80
          );
          const productIds = new Set(
            mergedProducts.map((p) => p.id).filter(Boolean)
          );
          const mergedLegacy = mergeDeltaEntities(
            cachedServices.legacyServices,
            newRawServices,
            (item) => item.id,
            (item) => getTimestampMillis(item.createdAt),
            60
          ).filter((s) => !s.id || !productIds.has(s.id));

          setProductServices(mergedProducts);
          setLegacyServices(mergedLegacy);
          setFastCache(
            'services_feed',
            {
              productServices: mergedProducts,
              legacyServices: mergedLegacy,
            },
            {
              localData: {
                productServices: compactListingsForCache(mergedProducts, 24),
                legacyServices: compactListingsForCache(mergedLegacy, 24),
              },
              isFull: true,
            }
          );
        }
      } else {
        const [serviceProducts, rawServices] = await Promise.all([
          fetchApprovedActiveServices(),
          getLatestLegacyServices(40),
        ]);
        const filteredServiceProducts = serviceProducts.filter(
          (item) => getListingAdType(item) === 'service'
        );
        const seenIds = new Set(
          filteredServiceProducts.map((p) => p.id).filter(Boolean)
        );
        const uniqueLegacy = rawServices.filter(
          (s) => !s.id || !seenIds.has(s.id)
        );

        setProductServices(filteredServiceProducts);
        setLegacyServices(uniqueLegacy);
        primeProductsListIntoCache(filteredServiceProducts, true);
        uniqueLegacy.forEach((s) =>
          primeLegacyServiceIntoCache(s, { isFull: true, idbOnly: true })
        );
        setFastCache(
          'services_feed',
          {
            productServices: filteredServiceProducts,
            legacyServices: uniqueLegacy,
          },
          {
            localData: {
              productServices: compactListingsForCache(
                filteredServiceProducts,
                24
              ),
              legacyServices: compactListingsForCache(uniqueLegacy, 24),
            },
            isFull: true,
          }
        );
      }
    };

    const syncStores = async () => {
      if (storesStrategy === 'fresh-skip') return;
      if (storesStrategy === 'delta-sync' && hasCachedStores) {
        const newestMs = getNewestCreatedAtMs(cachedStores);
        const delta = await getApprovedStoresDelta(newestMs);
        if (delta.length === 0) {
          touchFastCache('approved_stores');
        } else {
          const merged = mergeDeltaEntities(
            cachedStores,
            delta,
            (item) => item.id,
            (item) => getTimestampMillis(item.createdAt),
            60
          );
          setStores(merged);
          setFastCache('approved_stores', merged, {
            localData: compactListingsForCache(merged, 24),
            isFull: true,
          });
        }
      } else {
        const list = await getApprovedStores();
        setStores(list);
        setFastCache('approved_stores', list, {
          localData: compactListingsForCache(list, 24),
          isFull: true,
        });
      }
    };

    try {
      await Promise.all([syncServices(), syncStores()]);
    } catch (err) {
      if (!hasAnyCached) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load campus services and stores right now.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const productServicesRef = useRef(productServices);
  productServicesRef.current = productServices;
  const legacyServicesRef = useRef(legacyServices);
  legacyServicesRef.current = legacyServices;
  const storesRef = useRef(stores);
  storesRef.current = stores;

  useBackgroundSync({
    enabled: true,
    onTick: useCallback(async ({ tickIndex, reason }) => {
      const res = await reconcileServicesAndStoresSlices({
        cachedProductServices: productServicesRef.current,
        cachedLegacyServices: legacyServicesRef.current,
        cachedStores: storesRef.current,
        tickIndex,
        forceHeadCheck: reason === 'resume',
      });

      if (res.servicesChanged) {
        const prodChanged = haveListsDiverged(
          productServicesRef.current,
          res.productServices,
          getEntityContentSignature
        );
        const legacyChanged = haveListsDiverged(
          legacyServicesRef.current,
          res.legacyServices,
          getEntityContentSignature
        );
        if (prodChanged || legacyChanged) {
          setProductServices(res.productServices);
          setLegacyServices(res.legacyServices);
          setFastCache(
            'services_feed',
            {
              productServices: res.productServices,
              legacyServices: res.legacyServices,
            },
            {
              localData: {
                productServices: compactListingsForCache(res.productServices, 24),
                legacyServices: compactListingsForCache(res.legacyServices, 24),
              },
              isFull: true,
            }
          );
        }
      }

      if (
        res.storesChanged &&
        haveListsDiverged(storesRef.current, res.stores, getEntityContentSignature)
      ) {
        setStores(res.stores);
        setFastCache('approved_stores', res.stores, {
          localData: compactListingsForCache(res.stores, 24),
          isFull: true,
        });
      }
    }, []),
  });

  const mixedEntries = useMemo(
    () =>
      buildMixedServicesAndStoresFeed({
        productServices,
        legacyServices,
        stores,
        selectedCategory,
        searchQuery,
      }),
    [productServices, legacyServices, stores, selectedCategory, searchQuery]
  );

  const totalCount = mixedEntries.length;
  const hasActiveFilters = Boolean(selectedCategory || searchQuery.trim());

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSearchQuery('');
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 space-y-6">
      <SeoHead
        title="Campus Services & Stores"
        description="Find trusted student skills, repairs, printing, fashion & food shops, tutoring, and campus stores on LASUEDPLUG."
      />
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Campus Services &amp; Stores
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Find trusted student skills, repairs, printing, fashion &amp; food shops, tutoring, and campus stores.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2.5 shrink-0">
          <Link to="/store/create" className="w-full sm:w-auto">
            <Button variant="outline" size="md" fullWidth className="sm:w-auto">
              <StoreIcon className="w-4 h-4" />
              <span>Open Store</span>
            </Button>
          </Link>
          <Link to="/marketplace/create?type=service" className="w-full sm:w-auto">
            <Button variant="primary" size="md" fullWidth className="sm:w-auto">
              <Plus className="w-4 h-4" />
              <span>Post a Service</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Sticky Search Bar & Category Filter Tabs */}
      <section
        aria-label="Search and filter services and stores"
        className="sticky top-14 md:top-16 z-30 -mx-3.5 sm:mx-0 px-3.5 sm:px-0 py-1.5 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-2 sm:p-3.5 space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="services-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repairs, stores, printing, braiding, laundry..."
                aria-label="Search campus services and stores"
                className="w-full min-w-0 pl-9 pr-9 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear service search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all duration-200 self-end sm:self-auto shrink-0"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Horizontal Scrollable Service & Store Filter Tabs */}
          <div
            role="tablist"
            aria-label="Service and store category filters"
            className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5 max-w-full"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === ''}
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border transition-all duration-200 active:scale-95 ${
                selectedCategory === ''
                  ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              All Services &amp; Stores
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'stores'}
              onClick={() =>
                setSelectedCategory(selectedCategory === 'stores' ? '' : 'stores')
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border transition-all duration-200 active:scale-95 ${
                selectedCategory === 'stores'
                  ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <StoreIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Campus Stores</span>
            </button>
            {SERVICE_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(active ? '' : cat.id)}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border transition-all duration-200 active:scale-95 ${
                    active
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Mixed Grid */}
      {loading ? (
        <CardSkeletonGrid
          count={8}
          columns={4}
          label="Loading campus services and stores..."
        />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadServices()} />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={
            hasActiveFilters
              ? SearchX
              : selectedCategory === 'stores'
                ? StoreIcon
                : Wrench
          }
          title="Nothing here yet"
          description={
            hasActiveFilters
              ? 'No campus services or stores matched your search or selected category.'
              : 'Be the first to open a storefront or post your campus skill.'
          }
          actionLabel={
            hasActiveFilters
              ? 'Reset Filters'
              : selectedCategory === 'stores'
                ? 'Open a Store'
                : 'Post a Service'
          }
          actionTo={
            hasActiveFilters
              ? undefined
              : selectedCategory === 'stores'
                ? '/store/create'
                : '/marketplace/create?type=service'
          }
          onAction={hasActiveFilters ? handleResetFilters : undefined}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            Showing {totalCount}{' '}
            {selectedCategory === 'stores'
              ? totalCount === 1
                ? 'campus store'
                : 'campus stores'
              : totalCount === 1
                ? 'service & store'
                : 'services & stores'}
          </p>

          <div
            data-testid="services-mixed-grid"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6"
          >
            {mixedEntries.map((entry, index) => {
              if (entry.kind === 'store') {
                return (
                  <StoreCard
                    key={`store-${entry.id}`}
                    store={entry.store}
                    priority={index < 4}
                  />
                );
              }
              if (entry.kind === 'product_service') {
                return (
                  <ProductCard
                    key={`ps-${entry.id}`}
                    product={entry.product}
                    priority={index < 4}
                  />
                );
              }
              return (
                <LegacyServiceCard
                  key={`ls-${entry.id}`}
                  service={entry.service}
                  priority={index < 4}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
