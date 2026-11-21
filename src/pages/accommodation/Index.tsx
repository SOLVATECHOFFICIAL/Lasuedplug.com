import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { fetchApprovedAccommodations } from '../../lib/accommodationService';
import {
  ACCOMMODATION_PRICE_RANGES,
  ACCOMMODATION_TYPE_OPTIONS,
  AccommodationPriceRange,
  filterAccommodations,
} from '../../lib/accommodationHelpers';
import { useLoadCap, withLoadTimeout } from '../../lib/loadTimeout';
import { Accommodation } from '../../types';
import { Button } from '../../components/ui/Button';
import { CardSkeletonGrid } from '../../components/feedback/Loading';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { AccommodationCard } from '../../components/marketplace/AccommodationCard';
import { AccommodationSubNav } from '../../components/accommodation/AccommodationSubNav';

export function AccommodationIndex() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] =
    useState<AccommodationPriceRange>('all');
  const [locationQuery, setLocationQuery] = useState<string>('');

  useLoadCap(loading, () => setLoading(false));

  const loadAccommodations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await withLoadTimeout(fetchApprovedAccommodations());
      setAccommodations(items);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load accommodation listings right now.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccommodations();
  }, [loadAccommodations]);

  const filteredListings = useMemo(
    () =>
      filterAccommodations(accommodations, {
        type: selectedType,
        priceRange: selectedPriceRange,
        locationQuery,
      }),
    [accommodations, selectedType, selectedPriceRange, locationQuery]
  );

  const hasActiveFilters =
    selectedType !== 'all' ||
    selectedPriceRange !== 'all' ||
    Boolean(locationQuery.trim());

  const handleResetFilters = () => {
    setSelectedType('all');
    setSelectedPriceRange('all');
    setLocationQuery('');
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 space-y-5 sm:space-y-6">
      <AccommodationSubNav
        actionSlot={
          <Link to="/accommodation/create" className="w-full sm:w-auto">
            <Button variant="primary" size="sm" fullWidth className="sm:w-auto">
              <Plus className="w-4 h-4" />
              <span>List Accommodation</span>
            </Button>
          </Link>
        }
      />

      {/* Page Heading */}
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Off-Campus Accommodation
        </h1>
        <p className="text-sm text-slate-600">
          Verified student rooms, self-contains, and shared lodges around LASUED &amp; Epe.
        </p>
      </div>

      {/* Sticky Filters Toolbar */}
      <section
        aria-label="Filter accommodation"
        className="sticky top-14 md:top-16 z-30 -mx-3.5 sm:mx-0 px-3.5 sm:px-0 py-2 bg-slate-50/95 backdrop-blur-sm"
      >
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-2.5 sm:p-4 space-y-2.5 sm:space-y-3">
          <div className="hidden sm:flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <SlidersHorizontal className="w-4 h-4 text-primary-600" />
              <span>Filter Accommodation</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-all duration-200"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="space-y-1 min-w-0">
              <label
                htmlFor="filter-type"
                className="hidden sm:block text-xs font-medium text-slate-600"
              >
                Property Type
              </label>
              <select
                id="filter-type"
                aria-label="Property Type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="block w-full min-w-0 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              >
                <option value="all">All Types</option>
                {ACCOMMODATION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 min-w-0">
              <label
                htmlFor="filter-price"
                className="hidden sm:block text-xs font-medium text-slate-600"
              >
                Annual Rent Range
              </label>
              <select
                id="filter-price"
                aria-label="Annual Rent Range"
                value={selectedPriceRange}
                onChange={(e) =>
                  setSelectedPriceRange(e.target.value as AccommodationPriceRange)
                }
                className="block w-full min-w-0 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              >
                {ACCOMMODATION_PRICE_RANGES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1 space-y-1 min-w-0">
              <label
                htmlFor="filter-location"
                className="hidden sm:block text-xs font-medium text-slate-600"
              >
                Location or Keyword
              </label>
              <div className="relative flex items-center gap-2 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="filter-location"
                    type="search"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    placeholder="Search location (Gate, Igbogbo, Epe)..."
                    aria-label="Location or Keyword"
                    className="block w-full min-w-0 pl-9 pr-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    aria-label="Reset filters"
                    className="sm:hidden px-2.5 py-2 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Listings Grid */}
      {loading ? (
        <CardSkeletonGrid
          count={6}
          columns={3}
          label="Loading approved accommodation..."
        />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadAccommodations()} />
      ) : filteredListings.length === 0 ? (
        <EmptyState
          icon={hasActiveFilters ? SearchX : Building2}
          title={hasActiveFilters ? 'No lodges matched' : 'Nothing here yet'}
          description={
            hasActiveFilters
              ? 'Try clearing your filters or searching a wider area around Epe campus.'
              : 'Be the first to post in this category. Have a vacant student room or lodge? List it now!'
          }
          actionLabel={hasActiveFilters ? 'Clear Filters' : 'Post a Listing'}
          actionTo={hasActiveFilters ? undefined : '/accommodation/create'}
          onAction={hasActiveFilters ? handleResetFilters : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredListings.map((item) => (
            <AccommodationCard
              key={item.id || item.title}
              accommodation={item}
            />
          ))}
        </div>
      )}
    </div>
  );
}
