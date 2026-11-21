import { Accommodation, Product, Service, Store } from '../types';
import { getTimestampMillis } from './homeHelpers';
import { getListingAdType } from './marketplaceHelpers';

export const TWO_HOURS_MS = 7200000;

export type MixedFeedType = 'item' | 'service' | 'store' | 'accommodation';

export type HomeSortMode = 'newest' | 'trending' | 'top_rated';

export interface MixedFeedItem {
  id: string;
  _type: MixedFeedType;
  title: string;
  sellerId: string;
  isVerified: boolean;
  trustScore: number;
  reviewCount: number;
  contactCount: number;
  viewCount: number;
  createdAt: unknown;
  searchHaystack: string;
  product?: Product;
  service?: Service;
  store?: Store;
  accommodation?: Accommodation;
}

export function getCurrentTwoHourSeed(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / TWO_HOURS_MS);
}

function createSeededRandom(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: ReadonlyArray<T>, seed: number): T[] {
  const result = [...items];
  const random = createSeededRandom(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export function compareByEngagement<
  T extends { contactCount?: number; viewCount?: number; createdAt?: unknown }
>(a: T, b: T): number {
  const contactDiff = (b.contactCount || 0) - (a.contactCount || 0);
  if (contactDiff !== 0) return contactDiff;
  const viewDiff = (b.viewCount || 0) - (a.viewCount || 0);
  if (viewDiff !== 0) return viewDiff;
  return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
}

export function applyTwoHourTrendingShuffle<
  T extends { contactCount?: number; viewCount?: number; createdAt?: unknown }
>(items: ReadonlyArray<T>, nowMs: number = Date.now(), maxTop = 30): T[] {
  const topCandidates = [...items].sort(compareByEngagement).slice(0, maxTop);
  const timeSeed = getCurrentTwoHourSeed(nowMs);
  return seededShuffle(topCandidates, timeSeed);
}

export function productToMixedFeedItem(
  product: Product,
  sellerStats?: { trustScore?: number; reviewCount?: number; isVerified?: boolean }
): MixedFeedItem {
  const adType = getListingAdType(product);
  const _type: MixedFeedType = adType === 'service' ? 'service' : 'item';
  return {
    id: product.id || `${product.sellerId}-${product.title}`,
    _type,
    title: product.title,
    sellerId: product.sellerId,
    isVerified: Boolean(
      sellerStats?.isVerified ?? product.sellerSnapshot?.isVerified
    ),
    trustScore:
      typeof sellerStats?.trustScore === 'number' ? sellerStats.trustScore : 0,
    reviewCount:
      typeof sellerStats?.reviewCount === 'number'
        ? sellerStats.reviewCount
        : 0,
    contactCount: product.contactCount || 0,
    viewCount: product.viewCount || 0,
    createdAt: product.createdAt,
    searchHaystack: [
      product.title,
      product.description,
      product.categoryName,
      product.categoryId,
      product.subcategory,
      product.locationName,
      product.landmark,
      product.storeName,
      product.shopName,
      product.sellerSnapshot?.fullName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    product,
  };
}

export function serviceToMixedFeedItem(
  service: Service,
  sellerStats?: { trustScore?: number; reviewCount?: number; isVerified?: boolean }
): MixedFeedItem {
  return {
    id: service.id || `${service.providerId}-${service.title}`,
    _type: 'service',
    title: service.title,
    sellerId: service.providerId,
    isVerified: Boolean(
      sellerStats?.isVerified ?? service.sellerSnapshot?.isVerified
    ),
    trustScore:
      typeof sellerStats?.trustScore === 'number' ? sellerStats.trustScore : 0,
    reviewCount:
      typeof sellerStats?.reviewCount === 'number'
        ? sellerStats.reviewCount
        : 0,
    contactCount: service.contactCount || 0,
    viewCount: service.viewCount || 0,
    createdAt: service.createdAt,
    searchHaystack: [
      service.title,
      service.description,
      service.categoryId,
      service.subcategory,
      service.locationName,
      service.landmark,
      service.shopName,
      service.sellerSnapshot?.fullName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    service,
  };
}

export function storeToMixedFeedItem(
  store: Store,
  ownerStats?: { trustScore?: number; reviewCount?: number; isVerified?: boolean }
): MixedFeedItem {
  const storeTrust =
    typeof store.trustScore === 'number' && store.trustScore > 0
      ? store.trustScore
      : typeof ownerStats?.trustScore === 'number'
        ? ownerStats.trustScore
        : 0;
  const storeReviews =
    typeof store.reviewCount === 'number' && store.reviewCount > 0
      ? store.reviewCount
      : typeof ownerStats?.reviewCount === 'number'
        ? ownerStats.reviewCount
        : 0;

  return {
    id: store.id || `${store.ownerId}-${store.name}`,
    _type: 'store',
    title: store.name,
    sellerId: store.ownerId,
    isVerified: Boolean(
      ownerStats?.isVerified ?? store.ownerSnapshot?.isVerified
    ),
    trustScore: storeTrust,
    reviewCount: storeReviews,
    contactCount: 0,
    viewCount: 0,
    createdAt: store.createdAt,
    searchHaystack: [
      store.name,
      store.description,
      store.category,
      store.locationName,
      store.openingHours,
      store.ownerSnapshot?.fullName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    store,
  };
}

export function accommodationToMixedFeedItem(
  acc: Accommodation,
  ownerStats?: { trustScore?: number; reviewCount?: number; isVerified?: boolean }
): MixedFeedItem {
  return {
    id: acc.id || `${acc.ownerId}-${acc.title}`,
    _type: 'accommodation',
    title: acc.title,
    sellerId: acc.ownerId,
    isVerified: Boolean(ownerStats?.isVerified ?? acc.ownerSnapshot?.isVerified),
    trustScore:
      typeof ownerStats?.trustScore === 'number' ? ownerStats.trustScore : 0,
    reviewCount:
      typeof ownerStats?.reviewCount === 'number' ? ownerStats.reviewCount : 0,
    contactCount: 0,
    viewCount: 0,
    createdAt: acc.createdAt,
    searchHaystack: [
      acc.title,
      acc.description,
      acc.type,
      acc.generalLocation,
      acc.location,
      ...(Array.isArray(acc.amenities) ? acc.amenities : []),
      acc.ownerSnapshot?.fullName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    accommodation: acc,
  };
}

export function filterMixedFeedItems(
  items: ReadonlyArray<MixedFeedItem>,
  options: {
    verifiedOnly?: boolean;
    searchQuery?: string;
    typeFilter?: MixedFeedType | 'all';
  }
): MixedFeedItem[] {
  const normalizedQuery = (options.searchQuery || '').trim().toLowerCase();
  const tokens = normalizedQuery
    .split(/\s+/)
    .filter((token) => token.length >= 2);

  return items.filter((item) => {
    if (options.typeFilter && options.typeFilter !== 'all') {
      if (options.typeFilter === 'service') {
        if (item._type !== 'service' && item._type !== 'store') return false;
      } else if (item._type !== options.typeFilter) {
        return false;
      }
    }
    if (options.verifiedOnly && !item.isVerified) {
      return false;
    }
    if (normalizedQuery) {
      if (item.searchHaystack.includes(normalizedQuery)) {
        return true;
      }
      if (tokens.length > 0) {
        return tokens.some((token) => item.searchHaystack.includes(token));
      }
      return false;
    }
    return true;
  });
}

export function sortMixedFeedItems(
  items: ReadonlyArray<MixedFeedItem>,
  sortMode: HomeSortMode
): MixedFeedItem[] {
  if (sortMode === 'trending') {
    return [...items];
  }
  const copy = [...items];
  if (sortMode === 'top_rated') {
    copy.sort((a, b) => {
      const scoreDiff = (b.trustScore || 0) - (a.trustScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const reviewDiff = (b.reviewCount || 0) - (a.reviewCount || 0);
      if (reviewDiff !== 0) return reviewDiff;
      return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
    });
    return copy;
  }

  copy.sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
  );
  return copy;
}
