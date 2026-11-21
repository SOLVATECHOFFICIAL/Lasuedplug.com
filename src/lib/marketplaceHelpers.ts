import { AdType, PriceUnit, Product, ServiceLocation } from '../types';
import { getTimestampMillis } from './homeHelpers';
import { formatNaira } from './utils';

export type MarketplaceSortOption =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'most_contacted';

export interface MarketplaceFilters {
  adType?: AdType;
  categoryId?: string;
  subcategory?: string;
  searchQuery?: string;
  sortBy?: MarketplaceSortOption;
}

export function getListingAdType(
  product: Partial<Pick<Product, 'adType' | 'listingType'>>
): AdType {
  if (product.adType === 'service' || product.listingType === 'service') {
    return 'service';
  }
  return 'item';
}

export function getServiceLocationLabel(
  serviceLocation?: ServiceLocation
): string {
  switch (serviceLocation) {
    case 'shop':
      return 'Come to Shop';
    case 'mobile':
      return 'We come to you';
    case 'online':
      return 'Online / Delivery';
    default:
      return 'Come to Shop';
  }
}

export function formatNigerianWhatsAppDigits(rawPhone: string): string {
  const digitsOnly = rawPhone.replace(/[^\d]/g, '');
  if (!digitsOnly) {
    return '';
  }
  if (digitsOnly.startsWith('234') && digitsOnly.length >= 12) {
    return digitsOnly;
  }
  if (digitsOnly.startsWith('0')) {
    return `234${digitsOnly.slice(1)}`;
  }
  return `234${digitsOnly}`;
}

export function buildProductWhatsAppUrl(
  whatsappNumber: string,
  productTitle: string
): string {
  const intlNumber = formatNigerianWhatsAppDigits(whatsappNumber);
  const message = `Hello, I saw your listing for ${productTitle} on LASUEDPLUG. Is it still available?`;
  return `https://wa.me/${intlNumber}?text=${encodeURIComponent(message)}`;
}

export function buildAdminWhatsAppUrl(
  adminPhone: string,
  userEmail?: string | null,
  fullName?: string | null
): string {
  const intlNumber = formatNigerianWhatsAppDigits(adminPhone);
  const identity = [fullName?.trim(), userEmail?.trim()].filter(Boolean).join(' - ');
  const message = identity
    ? `Hello LASUEDPLUG Admin, I would like to request a change to my locked academic profile details (${identity}).`
    : 'Hello LASUEDPLUG Admin, I would like to request a change to my locked academic profile details.';
  return `https://wa.me/${intlNumber}?text=${encodeURIComponent(message)}`;
}

export function getPriceUnitSuffix(priceUnit?: PriceUnit): string {
  switch (priceUnit) {
    case 'per_day':
      return '/ day';
    case 'per_hour':
      return '/ hour';
    case 'per_item':
      return '/ item';
    case 'total':
    default:
      return '';
  }
}

export function getPriceUnitLabel(priceUnit?: PriceUnit): string {
  switch (priceUnit) {
    case 'per_day':
      return 'per day';
    case 'per_hour':
      return 'per hour';
    case 'per_item':
      return 'per item';
    case 'total':
    default:
      return 'total';
  }
}

export interface ProductPriceDisplay {
  text: string;
  unitSuffix: string;
  isContact: boolean;
  isNegotiable: boolean;
}

export function getProductPriceDisplay(
  product: Partial<Pick<Product, 'adType' | 'listingType' | 'price' | 'priceUnit'>> &
    Pick<Product, 'priceType'>
): ProductPriceDisplay {
  const unitSuffix = getPriceUnitSuffix(product.priceUnit);

  if (
    product.priceType === 'contact' ||
    typeof product.price !== 'number' ||
    !Number.isFinite(product.price)
  ) {
    return {
      text: 'Contact for Price',
      unitSuffix,
      isContact: true,
      isNegotiable: false,
    };
  }

  const formatted = formatNaira(product.price);
  const withUnit = unitSuffix ? `${formatted} ${unitSuffix}` : formatted;

  if (product.priceType === 'negotiable') {
    return {
      text: `${withUnit} (Negotiable)`,
      unitSuffix,
      isContact: false,
      isNegotiable: true,
    };
  }

  return {
    text: withUnit,
    unitSuffix,
    isContact: false,
    isNegotiable: false,
  };
}

export function getProductLocationLabel(
  product: Partial<
    Pick<
      Product,
      | 'adType'
      | 'listingType'
      | 'serviceLocation'
      | 'locationType'
      | 'landmark'
      | 'locationName'
      | 'location'
    >
  >
): string {
  if (product.locationType === 'online' || product.serviceLocation === 'online') {
    return 'Online / Delivery';
  }

  const adType = getListingAdType(product);
  const landmarkText =
    product.locationName?.trim() ||
    product.landmark?.trim() ||
    product.location?.trim() ||
    '';

  if (adType === 'service' && product.serviceLocation) {
    if (product.serviceLocation === 'mobile') {
      return 'We come to you';
    }
    if (product.serviceLocation === 'shop') {
      return landmarkText ? `Come to Shop · ${landmarkText}` : 'Come to Shop';
    }
  }

  return landmarkText || 'LASUED Campus';
}

export function filterProductsByQuery(
  products: Product[],
  rawQuery: string
): Product[] {
  const normalized = rawQuery.trim().toLowerCase();
  if (!normalized) {
    return products;
  }
  return products.filter((item) =>
    item.title.toLowerCase().includes(normalized)
  );
}

export function hasActiveMarketplaceFilters(filters: MarketplaceFilters): boolean {
  return Boolean(
    filters.categoryId?.trim() ||
      filters.subcategory?.trim() ||
      filters.searchQuery?.trim() ||
      (filters.sortBy && filters.sortBy !== 'newest')
  );
}

export function applyLocalMarketplaceFiltersAndSort(
  products: Product[],
  filters: MarketplaceFilters = {}
): Product[] {
  let result = products.filter(
    (item) =>
      item.isApproved === true &&
      item.isActive === true &&
      item.categoryId !== 'accommodation'
  );

  if (filters.adType) {
    result = result.filter((item) => getListingAdType(item) === filters.adType);
  }

  if (filters.categoryId?.trim()) {
    result = result.filter((item) => item.categoryId === filters.categoryId);
  }

  if (filters.subcategory?.trim()) {
    result = result.filter((item) => item.subcategory === filters.subcategory);
  }

  if (filters.searchQuery?.trim()) {
    result = filterProductsByQuery(result, filters.searchQuery);
  }

  const sortBy = filters.sortBy || 'newest';
  const sorted = [...result];

  if (sortBy === 'price_asc') {
    sorted.sort((a, b) => {
      const aHasPrice = typeof a.price === 'number' && Number.isFinite(a.price);
      const bHasPrice = typeof b.price === 'number' && Number.isFinite(b.price);
      if (aHasPrice && bHasPrice) return (a.price as number) - (b.price as number);
      if (aHasPrice) return -1;
      if (bHasPrice) return 1;
      return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
    });
  } else if (sortBy === 'price_desc') {
    sorted.sort((a, b) => {
      const aHasPrice = typeof a.price === 'number' && Number.isFinite(a.price);
      const bHasPrice = typeof b.price === 'number' && Number.isFinite(b.price);
      if (aHasPrice && bHasPrice) return (b.price as number) - (a.price as number);
      if (aHasPrice) return -1;
      if (bHasPrice) return 1;
      return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
    });
  } else if (sortBy === 'most_contacted') {
    sorted.sort((a, b) => {
      const contactDiff = (b.contactCount || 0) - (a.contactCount || 0);
      if (contactDiff !== 0) return contactDiff;
      const viewDiff = (b.viewCount || 0) - (a.viewCount || 0);
      if (viewDiff !== 0) return viewDiff;
      return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
    });
  } else {
    sorted.sort(
      (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
    );
  }

  return sorted;
}
