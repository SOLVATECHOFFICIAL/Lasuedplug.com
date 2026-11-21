import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Search,
  SearchX,
  Wrench,
  X,
} from 'lucide-react';
import { SERVICE_CATEGORIES, getCategoryName } from '../../lib/categories';
import { fetchApprovedActiveServices } from '../../lib/marketplaceService';
import { getLatestServices } from '../../lib/homeService';
import { getListingAdType, getProductPriceDisplay } from '../../lib/marketplaceHelpers';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { Product, Service } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { CardSkeletonGrid } from '../../components/feedback/Loading';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductImage } from '../../components/marketplace/ProductImage';

const LegacyServiceCard = memo(function LegacyServiceCard({
  service,
}: {
  service: Service;
}) {
  const priceLabel = service.priceRange || getProductPriceDisplay(service).text;

  const handleTrackClick = () => {
    if (!service.id) return;
    saveRecentlyViewed({
      id: service.id,
      _type: 'service',
      title: service.title,
      subtitle: service.subcategory || getCategoryName(service.categoryId),
      priceLabel,
      imageUrl: service.images?.[0],
      href: `/marketplace/${service.id}`,
      isVerified: Boolean(service.sellerSnapshot?.isVerified),
    });
  };

  return (
    <Link
      to={`/marketplace/${service.id}`}
      onClick={handleTrackClick}
      className="group block h-full focus:outline-none"
    >
      <Card
        padded={false}
        className="h-full overflow-hidden flex flex-col group-focus-visible:ring-2 group-focus-visible:ring-blue-500"
      >
        <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
          <ProductImage
            src={service.images?.[0]}
            alt={service.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border shadow-sm backdrop-blur-sm bg-blue-600/95 text-white border-blue-500">
            <Wrench className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Service</span>
          </span>
        </div>
        <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">
              {service.subcategory || getCategoryName(service.categoryId)}
            </p>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {service.title}
            </h3>
            {(service.sellerSnapshot?.fullName || service.sellerSnapshot?.isVerified) && (
              <p className="text-xs text-slate-600 flex items-center gap-1 min-w-0">
                <span className="truncate">
                  {service.sellerSnapshot?.fullName || 'Service Provider'}
                </span>
                {service.sellerSnapshot?.isVerified && <VerifiedBadge size="xs" />}
              </p>
            )}
            {service.locationName && (
              <p className="text-xs text-slate-500 flex items-center gap-1 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{service.locationName}</span>
              </p>
            )}
          </div>
          <p className="text-sm font-semibold text-blue-600 truncate">
            {priceLabel}
          </p>
        </div>
      </Card>
    </Link>
  );
});

export function ServicesIndex() {
  const initialCached = getFastCache<{
    productServices: Product[];
    legacyServices: Service[];
  }>('services_feed');

  const [productServices, setProductServices] = useState<Product[]>(
    () => initialCached?.productServices || []
  );
  const [legacyServices, setLegacyServices] = useState<Service[]>(
    () => initialCached?.legacyServices || []
  );
  const [loading, setLoading] = useState(() => !initialCached);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadServices = useCallback(async () => {
    const cached = getFastCache<{
      productServices: Product[];
      legacyServices: Service[];
    }>('services_feed');
    if (!cached) {
      setLoading(true);
    }
    setError(null);
    try {
      const [serviceProducts, rawServices] = await Promise.all([
        fetchApprovedActiveServices(),
        getLatestServices(60),
      ]);
      const filteredServiceProducts = serviceProducts.filter(
        (item) => getListingAdType(item) === 'service'
      );
      const seenIds = new Set(
        filteredServiceProducts.map((p) => p.id).filter(Boolean)
      );
      const uniqueLegacy = rawServices.filter((s) => !s.id || !seenIds.has(s.id));

      setProductServices(filteredServiceProducts);
      setLegacyServices(uniqueLegacy);
      setFastCache('services_feed', {
        productServices: filteredServiceProducts,
        legacyServices: uniqueLegacy,
      });
    } catch (err) {
      if (!cached) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load campus services right now.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const filteredProductServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return productServices.filter((item) => {
      if (selectedCategory && item.categoryId !== selectedCategory) return false;
      if (!q) return true;
      return [
        item.title,
        item.description,
        getCategoryName(item.categoryId),
        item.subcategory,
        item.locationName,
        item.shopName,
        item.storeName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [productServices, selectedCategory, searchQuery]);

  const filteredLegacyServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return legacyServices.filter((item) => {
      if (selectedCategory && item.categoryId !== selectedCategory) return false;
      if (!q) return true;
      return [
        item.title,
        item.description,
        getCategoryName(item.categoryId),
        item.subcategory,
        item.locationName,
        item.shopName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [legacyServices, selectedCategory, searchQuery]);

  const totalCount = filteredProductServices.length + filteredLegacyServices.length;
  const hasActiveFilters = Boolean(selectedCategory || searchQuery.trim());

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSearchQuery('');
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Campus Services
          </h1>
          <p className="text-sm text-slate-600">
            Find trusted student skills: phone/laptop repairs, tailoring, hair styling, laundry, tutoring &amp; more.
          </p>
        </div>

        <div className="flex shrink-0">
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
        aria-label="Search and filter services"
        className="sticky top-14 md:top-16 z-30 -mx-3.5 sm:mx-0 px-3.5 sm:px-0 py-1.5 bg-slate-50/95 backdrop-blur-sm"
      >
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-2 sm:p-3.5 space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="services-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repairs, braiding, graphics, laundry..."
                aria-label="Search campus services"
                className="w-full min-w-0 pl-9 pr-9 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear service search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-all duration-200 self-end sm:self-auto shrink-0"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Horizontal Scrollable Service Category Filter Tabs */}
          <div
            role="tablist"
            aria-label="Service category filters"
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
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Services
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
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Grid */}
      {loading ? (
        <CardSkeletonGrid
          count={8}
          columns={4}
          label="Loading campus services..."
        />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadServices()} />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={hasActiveFilters ? SearchX : Wrench}
          title="Nothing here yet"
          description={
            hasActiveFilters
              ? 'No campus services matched your search or selected category.'
              : 'Be the first to post in this category and promote your campus skill.'
          }
          actionLabel={hasActiveFilters ? 'Reset Filters' : 'Post a Service'}
          actionTo={hasActiveFilters ? undefined : '/marketplace/create?type=service'}
          onAction={hasActiveFilters ? handleResetFilters : undefined}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-medium text-slate-500 tabular-nums">
            Showing {totalCount} {totalCount === 1 ? 'service' : 'services'}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6">
            {filteredProductServices.map((service) => (
              <ProductCard
                key={service.id || service.title}
                product={service}
              />
            ))}

            {filteredLegacyServices.map((service) => (
              <LegacyServiceCard
                key={service.id || service.title}
                service={service}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
