import { Product } from '../types';

export type SellerTab = 'all' | 'active' | 'pending' | 'sold';

export type ListingStatusBadgeKind = 'pending' | 'active' | 'sold' | 'inactive';

export interface SellerDashboardStats {
  totalListings: number;
  activeListings: number;
  pendingApproval: number;
  totalViews: number;
}

export interface ListingStatusBadgeInfo {
  kind: ListingStatusBadgeKind;
  label: 'Pending Approval' | 'Active' | 'Sold Out' | 'Hidden';
}

export function isServiceAd(
  listing: Partial<Pick<Product, 'adType' | 'listingType'>>
): boolean {
  return listing.adType === 'service' || listing.listingType === 'service';
}

export function isListingSoldOut(
  listing: Partial<Pick<Product, 'adType' | 'listingType' | 'quantity' | 'status'>>
): boolean {
  if (listing.status === 'sold') {
    return true;
  }
  if (
    !isServiceAd(listing) &&
    typeof listing.quantity === 'number' &&
    listing.quantity <= 0
  ) {
    return true;
  }
  return false;
}

export function isListingActiveOnMarketplace(
  listing: Pick<Product, 'isActive' | 'status'>
): boolean {
  return listing.isActive === true && listing.status === 'active';
}

export function getListingStatusBadge(
  listing: Partial<
    Pick<Product, 'adType' | 'listingType' | 'quantity' | 'status'>
  > &
    Pick<Product, 'isApproved' | 'isActive' | 'status'>
): ListingStatusBadgeInfo {
  if (isListingSoldOut(listing)) {
    return { kind: 'sold', label: 'Sold Out' };
  }
  if (listing.isApproved === false) {
    return { kind: 'pending', label: 'Pending Approval' };
  }
  if (!listing.isActive || listing.status === 'unavailable') {
    return { kind: 'inactive', label: 'Hidden' };
  }
  return { kind: 'active', label: 'Active' };
}

export function calculateSellerStats(listings: Product[]): SellerDashboardStats {
  return listings.reduce<SellerDashboardStats>(
    (acc, item) => {
      acc.totalListings += 1;
      if (isListingActiveOnMarketplace(item)) {
        acc.activeListings += 1;
      }
      if (item.isApproved === false) {
        acc.pendingApproval += 1;
      }
      acc.totalViews +=
        typeof item.viewCount === 'number' && Number.isFinite(item.viewCount)
          ? Math.max(0, item.viewCount)
          : 0;
      return acc;
    },
    {
      totalListings: 0,
      activeListings: 0,
      pendingApproval: 0,
      totalViews: 0,
    }
  );
}

export function filterSellerListingsByTab(
  listings: Product[],
  tab: SellerTab
): Product[] {
  switch (tab) {
    case 'active':
      return listings.filter(
        (item) =>
          item.isApproved === true &&
          item.isActive === true &&
          item.status === 'active' &&
          !isListingSoldOut(item)
      );
    case 'pending':
      return listings.filter(
        (item) => item.isApproved === false && !isListingSoldOut(item)
      );
    case 'sold':
      return listings.filter((item) => isListingSoldOut(item));
    case 'all':
    default:
      return listings;
  }
}

export function canMarkOneAsSold(
  listing: Partial<Pick<Product, 'adType' | 'listingType' | 'quantity'>>
): boolean {
  return (
    !isServiceAd(listing) &&
    typeof listing.quantity === 'number' &&
    listing.quantity > 0
  );
}

export function computeNextSoldOneUpdate(
  listing: Pick<Product, 'quantity' | 'status' | 'isActive'>
): {
  quantity: number;
  status: Product['status'];
  isActive: boolean;
} {
  const currentQty =
    typeof listing.quantity === 'number' && Number.isFinite(listing.quantity)
      ? Math.max(0, Math.floor(listing.quantity))
      : 0;
  const nextQuantity = Math.max(0, currentQty - 1);

  if (nextQuantity === 0) {
    return {
      quantity: 0,
      status: 'sold',
      isActive: false,
    };
  }

  return {
    quantity: nextQuantity,
    status: listing.status === 'sold' ? 'active' : listing.status,
    isActive: listing.isActive,
  };
}

export function computeNextToggleActiveUpdate(
  listing: Partial<
    Pick<Product, 'adType' | 'listingType' | 'quantity' | 'status' | 'isActive'>
  > &
    Pick<Product, 'status' | 'isActive'>,
  nextActive: boolean
): {
  isActive: boolean;
  status: Product['status'];
} {
  if (
    nextActive &&
    !isServiceAd(listing) &&
    typeof listing.quantity === 'number' &&
    listing.quantity <= 0
  ) {
    throw new Error('Cannot activate a sold-out product with 0 quantity in stock.');
  }

  return {
    isActive: nextActive,
    status: nextActive
      ? 'active'
      : listing.status === 'sold'
        ? 'sold'
        : listing.status,
  };
}

export interface EditListingInput {
  adType: Product['adType'];
  title: string;
  description: string;
  categoryId: string;
  subcategory: string;
  categoryName: string;
  images: string[];
  priceType: Product['priceType'];
  price?: number;
  priceUnit?: Product['priceUnit'];
  quantity?: number;
  serviceLocation?: Product['serviceLocation'];
  whatsappNumber: string;
  locationName?: string;
  hasDelivery?: boolean;
}

/**
 * Builds the Firestore update payload for an edited listing.
 * CRITICAL SECURITY RULE: Editing a listing ALWAYS resets `isApproved` to `false`
 * so the item is hidden from the public marketplace until an Admin re-approves it.
 */
export function buildEditedListingUpdatePayload(
  input: EditListingInput
): Record<string, unknown> {
  const isService = input.adType === 'service';
  const effectivePriceType: Product['priceType'] = isService
    ? 'contact'
    : input.priceType;
  const trimmedLocation = input.locationName?.trim() || '';

  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description.trim(),
    categoryId: input.categoryId,
    subcategory: input.subcategory,
    categoryName: input.categoryName,
    images: input.images,
    priceType: effectivePriceType,
    whatsappNumber: input.whatsappNumber.trim(),
    hasDelivery: isService
      ? input.serviceLocation === 'online'
      : Boolean(input.hasDelivery),
    // CRITICAL SECURITY RULE: Auto-hide on edit
    isApproved: false,
  };

  if (isService) {
    payload.serviceLocation = input.serviceLocation || 'shop';
    payload.status = 'active';
    payload.isActive = true;
    payload.locationName =
      trimmedLocation ||
      (input.serviceLocation === 'online'
        ? 'Online / Delivery'
        : 'We come to you');
  } else {
    const qty =
      typeof input.quantity === 'number' && Number.isFinite(input.quantity)
        ? Math.max(0, Math.floor(input.quantity))
        : 1;
    payload.quantity = qty;
    payload.status = qty === 0 ? 'sold' : 'active';
    payload.isActive = qty > 0;
    if (
      (effectivePriceType === 'fixed' || effectivePriceType === 'negotiable') &&
      typeof input.price === 'number' &&
      Number.isFinite(input.price)
    ) {
      payload.price = input.price;
      payload.priceUnit = input.priceUnit || 'total';
    }
    if (trimmedLocation) {
      payload.locationName = trimmedLocation;
      payload.landmark = trimmedLocation;
    }
  }

  return payload;
}

export type SellerModuleType =
  | 'item'
  | 'service'
  | 'accommodation'
  | 'roommate'
  | 'store';

export type SellerCollectionName =
  | 'products'
  | 'accommodations'
  | 'roommate_requests'
  | 'stores';

export interface UnifiedSellerListing {
  id: string;
  _type: SellerModuleType;
  collectionName: SellerCollectionName;
  title: string;
  subtitle: string;
  locationLabel: string;
  thumbnail?: string;
  isApproved: boolean;
  isActive: boolean;
  status: 'active' | 'sold' | 'unavailable';
  quantity?: number;
  viewCount?: number;
  contactCount?: number;
  storeName?: string;
  createdAt: unknown;
  detailPath: string;
  editPath?: string;
  productRef?: Product;
}

export function getSellerModuleBadgeLabel(
  type: SellerModuleType
): 'Item' | 'Service' | 'Accommodation' | 'Roommate' | 'Store' {
  switch (type) {
    case 'item':
      return 'Item';
    case 'service':
      return 'Service';
    case 'accommodation':
      return 'Accommodation';
    case 'roommate':
      return 'Roommate';
    case 'store':
      return 'Store';
  }
}

export function getUnifiedStatusBadge(
  listing: Pick<
    UnifiedSellerListing,
    '_type' | 'quantity' | 'status' | 'isApproved' | 'isActive'
  >
): ListingStatusBadgeInfo {
  if (
    listing._type === 'item' &&
    (listing.status === 'sold' ||
      (typeof listing.quantity === 'number' && listing.quantity <= 0))
  ) {
    return { kind: 'sold', label: 'Sold Out' };
  }
  if (listing.isApproved === false) {
    return { kind: 'pending', label: 'Pending Approval' };
  }
  if (!listing.isActive || listing.status === 'unavailable') {
    return { kind: 'inactive', label: 'Hidden' };
  }
  return { kind: 'active', label: 'Active' };
}

export function isUnifiedListingSoldOut(
  listing: Pick<UnifiedSellerListing, '_type' | 'quantity' | 'status'>
): boolean {
  return (
    listing.status === 'sold' ||
    (listing._type === 'item' &&
      typeof listing.quantity === 'number' &&
      listing.quantity <= 0)
  );
}

export function calculateUnifiedSellerStats(
  listings: ReadonlyArray<UnifiedSellerListing>
): SellerDashboardStats {
  return listings.reduce<SellerDashboardStats>(
    (acc, item) => {
      acc.totalListings += 1;
      if (item.isActive === true && item.status === 'active') {
        acc.activeListings += 1;
      }
      if (item.isApproved === false) {
        acc.pendingApproval += 1;
      }
      acc.totalViews +=
        typeof item.viewCount === 'number' && Number.isFinite(item.viewCount)
          ? Math.max(0, item.viewCount)
          : 0;
      return acc;
    },
    {
      totalListings: 0,
      activeListings: 0,
      pendingApproval: 0,
      totalViews: 0,
    }
  );
}

export function filterUnifiedSellerListingsByTab(
  listings: UnifiedSellerListing[],
  tab: SellerTab
): UnifiedSellerListing[] {
  switch (tab) {
    case 'active':
      return listings.filter(
        (item) =>
          item.isApproved === true &&
          item.isActive === true &&
          item.status === 'active' &&
          !isUnifiedListingSoldOut(item)
      );
    case 'pending':
      return listings.filter(
        (item) => item.isApproved === false && !isUnifiedListingSoldOut(item)
      );
    case 'sold':
      return listings.filter((item) => isUnifiedListingSoldOut(item));
    case 'all':
    default:
      return listings;
  }
}

export function formatSimpleNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

export function productToUnifiedSellerListing(
  product: Product,
  priceDisplayText: string,
  locationLabel: string
): UnifiedSellerListing {
  const isSvc = isServiceAd(product);
  return {
    id: product.id || '',
    _type: isSvc ? 'service' : 'item',
    collectionName: 'products',
    title: product.title,
    subtitle: priceDisplayText,
    locationLabel,
    thumbnail: product.images?.[0],
    isApproved: product.isApproved === true,
    isActive: product.isActive !== false,
    status: product.status || 'active',
    quantity: product.quantity,
    viewCount: product.viewCount || 0,
    contactCount: product.contactCount || 0,
    storeName: product.storeName || product.shopName,
    createdAt: product.createdAt,
    detailPath: product.id ? `/marketplace/${product.id}` : '/marketplace',
    editPath: product.id ? `/marketplace/edit/${product.id}` : undefined,
    productRef: product,
  };
}

export function accommodationToUnifiedSellerListing(acc: {
  id?: string;
  title: string;
  rentPrice: number;
  generalLocation: string;
  images?: string[];
  isApproved: boolean;
  isActive: boolean;
  createdAt: unknown;
}): UnifiedSellerListing {
  return {
    id: acc.id || '',
    _type: 'accommodation',
    collectionName: 'accommodations',
    title: acc.title,
    subtitle: `${formatSimpleNaira(acc.rentPrice || 0)} / yr`,
    locationLabel: acc.generalLocation || 'Epe Campus Area',
    thumbnail: acc.images?.[0],
    isApproved: acc.isApproved === true,
    isActive: acc.isActive !== false,
    status: acc.isActive !== false ? 'active' : 'unavailable',
    createdAt: acc.createdAt,
    detailPath: acc.id ? `/accommodation/${acc.id}` : '/accommodation',
  };
}

export function roommateToUnifiedSellerListing(req: {
  id?: string;
  title: string;
  budget?: number;
  generalLocation: string;
  images?: string[];
  isApproved: boolean;
  isActive: boolean;
  createdAt: unknown;
}): UnifiedSellerListing {
  return {
    id: req.id || '',
    _type: 'roommate',
    collectionName: 'roommate_requests',
    title: req.title,
    subtitle:
      typeof req.budget === 'number' && req.budget > 0
        ? `Budget: ${formatSimpleNaira(req.budget)} / yr`
        : 'Roommate Request',
    locationLabel: req.generalLocation || 'Epe Campus Area',
    thumbnail: req.images?.[0],
    isApproved: req.isApproved === true,
    isActive: req.isActive !== false,
    status: req.isActive !== false ? 'active' : 'unavailable',
    createdAt: req.createdAt,
    detailPath: '/roommates',
  };
}

export function storeToUnifiedSellerListing(store: {
  id?: string;
  name: string;
  category: string;
  locationName: string;
  logoUrl?: string;
  isApproved?: boolean;
  isActive?: boolean;
  createdAt: unknown;
}): UnifiedSellerListing {
  return {
    id: store.id || '',
    _type: 'store',
    collectionName: 'stores',
    title: store.name,
    subtitle: store.category || 'Campus Store',
    locationLabel: store.locationName || 'Epe Campus',
    thumbnail: store.logoUrl,
    isApproved: store.isApproved === true,
    isActive: store.isActive !== false,
    status: store.isActive !== false ? 'active' : 'unavailable',
    createdAt: store.createdAt,
    detailPath: '/marketplace',
  };
}
