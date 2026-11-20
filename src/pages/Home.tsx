import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Wrench,
  Building2,
  Users,
  Search,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Database,
  X,
} from 'lucide-react';
import { SITE_TAGLINE } from '../lib/constants';
import {
  getLatestAccommodations,
  getLatestProducts,
  getLatestServices,
} from '../lib/homeService';
import { buildMarketplaceSearchUrl } from '../lib/homeHelpers';
import {
  getAccommodationPublicLocation,
  getAccommodationRent,
  getAccommodationTypeLabel,
} from '../lib/accommodationHelpers';
import { getProductPriceDisplay } from '../lib/marketplaceHelpers';
import { getCategoryName } from '../lib/categories';
import { seedDatabase } from '../lib/seedData';
import { formatNaira } from '../lib/utils';
import { Accommodation, Product, Service } from '../types';
import { useToast } from '../contexts/ToastContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/feedback/Loading';
import { ErrorState } from '../components/feedback/ErrorState';
import { ProductImage } from '../components/marketplace/ProductImage';

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

function matchesHomeQuery(fields: Array<string | undefined>, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = fields.filter(Boolean).join(' ').toLowerCase();
  if (haystack.includes(normalized)) return true;
  const tokens = normalized.split(/\s+/).filter((t) => t.length >= 2);
  return tokens.length > 0 && tokens.some((token) => haystack.includes(token));
}

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeSearch, setActiveSearch] = useState(initialQuery.trim());
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const { showToast } = useToast();
  const autoSeededRef = useRef(false);

  const isSeedMode = searchParams.get('seed') === 'true';

  const loadListings = useCallback(async (fetchFullCatalog: boolean) => {
    setLoading(true);
    setError(null);
    const limitCount = fetchFullCatalog ? 60 : 4;
    try {
      const [latestProducts, latestServices, latestAccommodations] =
        await Promise.all([
          getLatestProducts(limitCount),
          getLatestServices(limitCount),
          getLatestAccommodations(limitCount),
        ]);
      setProducts(latestProducts);
      setServices(latestServices);
      setAccommodations(latestAccommodations);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load marketplace listings. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    const result = await seedDatabase();
    setSeedMessage(result.message);
    showToast(result.message, result.ok ? 'success' : 'error');
    setSeeding(false);
    if (result.ok) {
      await loadListings(Boolean(activeSearch));
    }
  }, [loadListings, showToast, activeSearch]);

  useEffect(() => {
    void loadListings(Boolean(activeSearch));
  }, [loadListings, activeSearch]);

  useEffect(() => {
    if (isSeedMode && !autoSeededRef.current) {
      autoSeededRef.current = true;
      void handleSeed();
    }
  }, [isSeedMode, handleSeed]);

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

  // Filtered per section so Marketplace NEVER includes houses/accommodation
  const visibleProducts = useMemo(() => {
    const marketplaceOnly = products.filter(
      (p) => p.categoryId !== 'accommodation'
    );
    if (!activeSearch) return marketplaceOnly.slice(0, 4);
    return marketplaceOnly.filter((p) =>
      matchesHomeQuery(
        [
          p.title,
          p.description,
          getCategoryName(p.categoryId),
          p.categoryName,
          p.subcategory,
          p.locationName,
          p.shopName,
        ],
        activeSearch
      )
    );
  }, [products, activeSearch]);

  const visibleServices = useMemo(() => {
    if (!activeSearch) return services.slice(0, 4);
    return services.filter((s) =>
      matchesHomeQuery(
        [
          s.title,
          s.description,
          getCategoryName(s.categoryId),
          s.subcategory,
          s.locationName,
          s.shopName,
        ],
        activeSearch
      )
    );
  }, [services, activeSearch]);

  const visibleAccommodations = useMemo(() => {
    if (!activeSearch) return accommodations.slice(0, 4);
    return accommodations.filter((a) =>
      matchesHomeQuery(
        [
          a.title,
          a.description,
          getAccommodationTypeLabel(a.type),
          getAccommodationPublicLocation(a),
          ...(Array.isArray(a.amenities) ? a.amenities : []),
        ],
        activeSearch
      )
    );
  }, [accommodations, activeSearch]);

  const marketplaceSectionLink = activeSearch
    ? buildMarketplaceSearchUrl(activeSearch)
    : '/marketplace';

  return (
    <div className="flex flex-col">
      {isSeedMode && (
        <div className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary-100 shrink-0" />
              <span>
                {seedMessage ||
                  'Seed mode active (?seed=true). Populate sample Firestore data below.'}
              </span>
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={seeding}
              onClick={() => void handleSeed()}
            >
              {seeding ? 'Seeding...' : 'Seed Sample Data'}
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary-50/80 via-white to-slate-50 border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center space-y-6">
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
            aria-label="Search campus marketplace, services, and accommodation"
            className="max-w-2xl mx-auto pt-2"
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
                  placeholder="Search products, services, or off-campus lodges..."
                  aria-label="Search products, services, or accommodation"
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
                Showing results across <strong>Marketplace</strong>,{' '}
                <strong>Services</strong>, and <strong>Accommodation</strong> for &ldquo;
                {activeSearch}&rdquo;.
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

      {/* Category Grid */}
      {!activeSearch && (
        <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Browse by Category
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Everything students need across campus life in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <Link key={category.path} to={category.path} className="group block h-full">
                  <Card className="h-full flex flex-col justify-between space-y-4 group-hover:border-primary-100">
                    <div className="space-y-4">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center ${category.iconBg}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors duration-200 flex items-center justify-between">
                          <span>{category.title}</span>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all duration-200" />
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
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

      {/* Featured Products Section (Marketplace — Houses Excluded) */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {activeSearch ? 'Matching Marketplace Items' : 'Fresh in the Marketplace'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Recently approved campus products from verified community sellers.
            </p>
          </div>
          <Link
            to={marketplaceSectionLink}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 shrink-0"
          >
            View in Marketplace <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <Loading variant="skeleton" message="Loading latest products..." />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => void loadListings(Boolean(activeSearch))}
          />
        ) : visibleProducts.length === 0 ? (
          <Card hoverable={false} className="border-dashed text-center py-10 space-y-3">
            <p className="text-sm font-medium text-slate-600">
              {activeSearch
                ? `No marketplace products matched "${activeSearch}".`
                : 'No products listed yet. Be the first to sell!'}
            </p>
            <div>
              {activeSearch ? (
                <Link to={marketplaceSectionLink}>
                  <Button variant="outline" size="sm">
                    Try Smart AI Search in Marketplace
                  </Button>
                </Link>
              ) : (
                <Link to="/marketplace/create">
                  <Button variant="outline" size="sm">
                    List a Product
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {visibleProducts.map((product) => {
              const priceInfo = getProductPriceDisplay(product);
              return (
                <Link
                  key={product.id || product.title}
                  to={`/marketplace/${product.id}`}
                  className="group block h-full"
                >
                  <Card padded={false} className="h-full overflow-hidden flex flex-col">
                    <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                      <ProductImage
                        src={product.images?.[0]}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        iconClassName="w-8 h-8 text-slate-400"
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {product.title}
                      </h3>
                      <p
                        className={`text-base tabular-nums ${
                          priceInfo.isContact
                            ? 'font-semibold text-blue-600'
                            : 'font-bold text-primary-600'
                        }`}
                      >
                        {priceInfo.text}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Featured Services Section */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {activeSearch ? 'Matching Campus Services' : 'Top Services Around Campus'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Trusted student skills, tutoring, laundry, and technical help.
            </p>
          </div>
          <Link
            to="/services"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 shrink-0"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <Loading variant="skeleton" message="Loading campus services..." />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => void loadListings(Boolean(activeSearch))}
          />
        ) : visibleServices.length === 0 ? (
          <Card hoverable={false} className="border-dashed text-center py-10 space-y-3">
            <p className="text-sm font-medium text-slate-600">
              {activeSearch
                ? `No campus services matched "${activeSearch}".`
                : 'No services listed yet. Offer your skill to the campus community!'}
            </p>
            {!activeSearch && (
              <div>
                <Link to="/services/create">
                  <Button variant="outline" size="sm">
                    Post a Service
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {visibleServices.map((service) => (
              <Link
                key={service.id || service.title}
                to={`/services/${service.id}`}
                className="group block h-full"
              >
                <Card padded={false} className="h-full overflow-hidden flex flex-col">
                  <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                    <ProductImage
                      src={service.images?.[0]}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      iconClassName="w-8 h-8 text-slate-400"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-sm font-semibold text-accent-600">
                      {service.priceRange || getProductPriceDisplay(service).text}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured Accommodations Section (Houses stay strictly in Accommodation) */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {activeSearch
                ? 'Matching Off-Campus Accommodation'
                : 'Off-Campus Accommodation'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Available lodges, rooms, and hostels around Epe and campus gates.
            </p>
          </div>
          <Link
            to="/accommodation"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 shrink-0"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <Loading variant="skeleton" message="Loading accommodations..." />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => void loadListings(Boolean(activeSearch))}
          />
        ) : visibleAccommodations.length === 0 ? (
          <Card hoverable={false} className="border-dashed text-center py-10 space-y-3">
            <p className="text-sm font-medium text-slate-600">
              {activeSearch
                ? `No lodges or accommodation matched "${activeSearch}".`
                : 'No accommodation listed yet. List an available lodge or room!'}
            </p>
            {!activeSearch && (
              <div>
                <Link to="/accommodation/create">
                  <Button variant="outline" size="sm">
                    List Accommodation
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {visibleAccommodations.map((item) => (
              <Link
                key={item.id || item.title}
                to={`/accommodation/${item.id}`}
                className="group block h-full"
              >
                <Card padded={false} className="h-full overflow-hidden flex flex-col">
                  <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                    <ProductImage
                      src={item.images?.[0]}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      iconClassName="w-8 h-8 text-slate-400"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {getAccommodationPublicLocation(item)}
                        </span>
                      </p>
                    </div>
                    <p className="text-base font-bold text-primary-600">
                      {formatNaira(getAccommodationRent(item))}
                      <span className="text-xs font-normal text-slate-500"> / year</span>
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Safety & Community Rules Section */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="bg-brand-navy text-white rounded-2xl p-8 sm:p-12 shadow-md space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-100">
              <ShieldCheck className="w-4 h-4 text-accent-500" />
              <span>Safety & Community Rules</span>
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
