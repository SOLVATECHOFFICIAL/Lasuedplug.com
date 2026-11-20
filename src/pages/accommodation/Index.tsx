import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { fetchApprovedAccommodations } from '../../lib/accommodationService';
import {
  ACCOMMODATION_PRICE_RANGES,
  ACCOMMODATION_TYPE_OPTIONS,
  AccommodationPriceRange,
  filterAccommodations,
  getAccommodationPublicLocation,
  getAccommodationRent,
  getAccommodationTypeLabel,
} from '../../lib/accommodationHelpers';
import { formatNaira } from '../../lib/utils';
import { Accommodation } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductImage } from '../../components/marketplace/ProductImage';
import { AccommodationSubNav } from '../../components/accommodation/AccommodationSubNav';

export function AccommodationIndex() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] =
    useState<AccommodationPriceRange>('all');
  const [locationQuery, setLocationQuery] = useState<string>('');

  const loadAccommodations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchApprovedAccommodations();
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-6">
      <AccommodationSubNav
        actionSlot={
          <Link to="/accommodation/create">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4" />
              <span>List Accommodation</span>
            </Button>
          </Link>
        }
      />

      {/* Page Heading */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Off-Campus Accommodation
        </h1>
        <p className="text-sm text-slate-600">
          Verified student rooms, self-contains, and shared lodges around LASUED &amp; Epe.
        </p>
      </div>

      {/* Filters Toolbar */}
      <Card hoverable={false} className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <SlidersHorizontal className="w-4 h-4 text-primary-600" />
            <span>Filter Accommodation</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="filter-type"
              className="block text-xs font-medium text-slate-600"
            >
              Property Type
            </label>
            <select
              id="filter-type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="block w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Property Types</option>
              {ACCOMMODATION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-price"
              className="block text-xs font-medium text-slate-600"
            >
              Annual Rent Range
            </label>
            <select
              id="filter-price"
              value={selectedPriceRange}
              onChange={(e) =>
                setSelectedPriceRange(e.target.value as AccommodationPriceRange)
              }
              className="block w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ACCOMMODATION_PRICE_RANGES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-location"
              className="block text-xs font-medium text-slate-600"
            >
              Location or Keyword
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="filter-location"
                type="search"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="e.g. Gate, Igbogbo, Epe..."
                className="block w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Listings Grid */}
      {loading ? (
        <Loading variant="skeleton" message="Loading approved accommodation..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadAccommodations()} />
      ) : filteredListings.length === 0 ? (
        <Card hoverable={false} className="border-dashed text-center py-12 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-slate-900">
              {hasActiveFilters
                ? 'No lodges matched your filters'
                : 'No accommodation listed yet'}
            </h2>
            <p className="text-sm text-slate-500">
              {hasActiveFilters
                ? 'Try clearing your filters or searching a wider area around Epe campus.'
                : 'Have a vacant student room or lodge? List it for fellow LASUED students.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear Filters
              </Button>
            ) : (
              <Link to="/accommodation/create">
                <Button variant="primary" size="sm">
                  List Accommodation
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((item) => {
            const typeLabel = getAccommodationTypeLabel(item.type);
            const publicLocation = getAccommodationPublicLocation(item);
            const rent = getAccommodationRent(item);
            const amenitiesPreview = Array.isArray(item.amenities)
              ? item.amenities.slice(0, 3).join(' · ')
              : '';

            return (
              <Card
                key={item.id || item.title}
                padded={false}
                className="overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  <Link
                    to={`/accommodation/${item.id}`}
                    className="block aspect-[4/3] w-full bg-slate-100 overflow-hidden"
                  >
                    <ProductImage
                      src={item.images?.[0]}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      iconClassName="w-10 h-10 text-slate-400"
                    />
                  </Link>

                  <div className="p-5 space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {typeLabel}
                    </p>

                    <Link to={`/accommodation/${item.id}`} className="block">
                      <h2 className="text-base font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </h2>
                    </Link>

                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{publicLocation}</span>
                    </p>

                    {amenitiesPreview && (
                      <p className="text-xs text-slate-500 truncate">
                        {amenitiesPreview}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <p className="text-lg font-extrabold text-slate-900 tabular-nums">
                    {formatNaira(rent)}
                    <span className="text-xs font-normal text-slate-500">
                      {' '}
                      / year
                    </span>
                  </p>
                  <Link to={`/accommodation/${item.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
