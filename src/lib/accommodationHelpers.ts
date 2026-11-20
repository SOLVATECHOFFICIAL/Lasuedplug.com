import {
  Accommodation,
  AccommodationType,
  RoommateRequest,
  RoommateRequestType,
} from '../types';
import { formatNigerianWhatsAppDigits } from './marketplaceHelpers';

export const ACCOMMODATION_TYPE_OPTIONS: ReadonlyArray<{
  value: AccommodationType;
  label: string;
}> = [
  { value: 'single_room', label: 'Single Room' },
  { value: 'self_contain', label: 'Self Contain' },
  { value: 'shared_apartment', label: 'Shared Apartment' },
  { value: 'short_let', label: 'Short Let' },
];

export const ROOMMATE_TYPE_OPTIONS: ReadonlyArray<{
  value: RoommateRequestType;
  label: string;
}> = [
  { value: 'need_roommate', label: 'Looking for Roommate' },
  { value: 'room_available', label: 'Room Available' },
];

export type AccommodationPriceRange =
  | 'all'
  | 'under_150k'
  | '150k_250k'
  | 'above_250k';

export const ACCOMMODATION_PRICE_RANGES: ReadonlyArray<{
  value: AccommodationPriceRange;
  label: string;
}> = [
  { value: 'all', label: 'Any Rent' },
  { value: 'under_150k', label: 'Under ₦150,000' },
  { value: '150k_250k', label: '₦150,000 – ₦250,000' },
  { value: 'above_250k', label: 'Above ₦250,000' },
];

export const COMMON_AMENITIES: readonly string[] = [
  'Running Water',
  'Prepaid Meter',
  'Tiled Floor',
  'Fenced Compound',
  'Security Gate',
  'Solar / Inverter',
  'Private Kitchen',
  'Wardrobe',
  'Borehole',
];

export function getAccommodationTypeLabel(type: string): string {
  switch (type) {
    case 'single_room':
    case 'Single Room':
      return 'Single Room';
    case 'self_contain':
    case 'Self-Contain':
    case 'Self Contain':
      return 'Self Contain';
    case 'shared_apartment':
    case 'Shared Flat':
    case 'Shared Apartment':
      return 'Shared Apartment';
    case 'short_let':
    case 'Short Let':
      return 'Short Let';
    default:
      return type || 'Accommodation';
  }
}

export function getRoommateTypeLabel(type: RoommateRequestType): string {
  return type === 'room_available' ? 'Room Available' : 'Looking for Roommate';
}

export function getAccommodationRent(
  item: Partial<Pick<Accommodation, 'rentPrice' | 'price'>>
): number {
  if (typeof item.rentPrice === 'number' && Number.isFinite(item.rentPrice)) {
    return item.rentPrice;
  }
  if (typeof item.price === 'number' && Number.isFinite(item.price)) {
    return item.price;
  }
  return 0;
}

export function getAccommodationPublicLocation(
  item: Partial<Pick<Accommodation, 'generalLocation' | 'location'>>
): string {
  return item.generalLocation?.trim() || item.location?.trim() || 'Epe Campus Area';
}

/**
 * Removes private `exactAddress` before accommodation data is exposed to public browse/detail views.
 */
export function sanitizePublicAccommodation(
  item: Accommodation
): Omit<Accommodation, 'exactAddress'> {
  const { exactAddress: _omitted, ...publicFields } = item;
  return publicFields;
}

export interface AccommodationFilters {
  type?: string;
  priceRange?: AccommodationPriceRange;
  locationQuery?: string;
}

export function filterAccommodations(
  items: Accommodation[],
  filters: AccommodationFilters = {}
): Accommodation[] {
  let result = items.filter(
    (item) => item.isApproved === true && item.isActive === true
  );

  if (filters.type && filters.type !== 'all') {
    const targetLabel = getAccommodationTypeLabel(filters.type);
    result = result.filter(
      (item) =>
        item.type === filters.type ||
        getAccommodationTypeLabel(item.type) === targetLabel
    );
  }

  if (filters.priceRange && filters.priceRange !== 'all') {
    result = result.filter((item) => {
      const rent = getAccommodationRent(item);
      switch (filters.priceRange) {
        case 'under_150k':
          return rent > 0 && rent < 150_000;
        case '150k_250k':
          return rent >= 150_000 && rent <= 250_000;
        case 'above_250k':
          return rent > 250_000;
        default:
          return true;
      }
    });
  }

  const trimmedQuery = filters.locationQuery?.trim().toLowerCase() || '';
  if (trimmedQuery) {
    result = result.filter((item) => {
      // Deliberately NEVER searches `exactAddress` on public listings
      const publicLoc = getAccommodationPublicLocation(item).toLowerCase();
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const amenities = Array.isArray(item.amenities)
        ? item.amenities.join(' ').toLowerCase()
        : '';
      return (
        publicLoc.includes(trimmedQuery) ||
        title.includes(trimmedQuery) ||
        desc.includes(trimmedQuery) ||
        amenities.includes(trimmedQuery)
      );
    });
  }

  return result;
}

export function filterRoommateRequests(
  items: RoommateRequest[],
  typeFilter: 'all' | RoommateRequestType = 'all',
  searchQuery = ''
): RoommateRequest[] {
  let result = items.filter(
    (item) => item.isApproved === true && item.isActive === true
  );

  if (typeFilter !== 'all') {
    result = result.filter((item) => item.type === typeFilter);
  }

  const trimmed = searchQuery.trim().toLowerCase();
  if (trimmed) {
    result = result.filter((item) => {
      const haystack = [
        item.title,
        item.generalLocation,
        item.preferences,
        item.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }

  return result;
}

export function buildAccommodationWhatsAppUrl(
  whatsappNumber: string,
  title: string
): string {
  const intlNumber = formatNigerianWhatsAppDigits(whatsappNumber);
  const message = `Hello, I saw your accommodation listing for ${title} on LASUEDPLUG. Is it still available?`;
  return `https://wa.me/${intlNumber}?text=${encodeURIComponent(message)}`;
}

export function buildRoommateWhatsAppUrl(
  whatsappNumber: string,
  title: string
): string {
  const intlNumber = formatNigerianWhatsAppDigits(whatsappNumber);
  const message = `Hello, I saw your roommate request "${title}" on LASUEDPLUG. I'd like to connect!`;
  return `https://wa.me/${intlNumber}?text=${encodeURIComponent(message)}`;
}
