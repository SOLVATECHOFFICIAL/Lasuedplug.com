import {
  collection,
  doc,
  DocumentData,
  FirestoreError,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  hasKnownMissingIndex,
  markMissingIndex,
  runDeduplicatedQuery,
} from './firestoreQueryCache';
import { getTimestampMillis } from './homeHelpers';
import { warmImages } from './imageCache';
import {
  applyLocalMarketplaceFiltersAndSort,
  filterProductsByQuery,
  getListingAdType,
  MarketplaceFilters,
  MarketplaceSortOption,
} from './marketplaceHelpers';
import { matchProductsBySearchKeywords } from './aiSearchService';
import {
  primeProductIntoCache,
  shouldSkipDetailNetworkFetch,
} from './syncCache';
import { AdType, Product } from '../types';

export const MARKETPLACE_PAGE_SIZE = 12;

export function primeProductsListIntoCache(
  items: ReadonlyArray<Product>,
  isFull = true
): void {
  const coverUrls: Array<string | undefined> = [];
  for (const product of items) {
    primeProductIntoCache(product, { isFull, idbOnly: true });
    coverUrls.push(product.images?.[0]);
  }
  warmImages(coverUrls, 16);
}

export interface PaginatedProductsResult {
  products: Product[];
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

function getRequiredCompositeIndexHint(
  filters: MarketplaceFilters,
  sortBy: MarketplaceSortOption
): string {
  const fields = ['isApproved ASC', 'isActive ASC', 'adType ASC'];
  if (filters.categoryId) fields.push('categoryId ASC');
  if (filters.subcategory) fields.push('subcategory ASC');
  if (sortBy === 'price_asc') fields.push('price ASC');
  else if (sortBy === 'price_desc') fields.push('price DESC');
  else if (sortBy === 'most_contacted') fields.push('contactCount DESC');
  else fields.push('createdAt DESC');

  return `Firestore composite index required on collection "products": (${fields.join(', ')}). Check firestore.indexes.json and deploy with "firebase deploy --only firestore:indexes".`;
}

/**
 * Fetches the top 8 trending items (adType == 'item') sorted by viewCount (descending).
 */
export async function fetchTrendingProducts(limitCount = 8): Promise<Product[]> {
  if (!db) {
    return [];
  }

  return runDeduplicatedQuery(`marketplace:trending:${limitCount}`, async () => {
    const colRef = collection(db!, 'products');
    const indexKey = 'products:approved_active_item_viewCount';
    const fallbackLimit = Math.max(limitCount * 5, 40);

    const runFallback = async () => {
      const fallbackQ = query(
        colRef,
        where('isApproved', '==', true),
        limit(fallbackLimit)
      );
      const snapshot = await getDocs(fallbackQ);
      const docs = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        }))
        .filter(
          (item) =>
            item.isApproved === true &&
            item.isActive === true &&
            item.categoryId !== 'accommodation' &&
            getListingAdType(item) === 'item'
        )
        .sort((a, b) => {
          const viewDiff = (b.viewCount || 0) - (a.viewCount || 0);
          if (viewDiff !== 0) return viewDiff;
          const contactDiff = (b.contactCount || 0) - (a.contactCount || 0);
          if (contactDiff !== 0) return contactDiff;
          return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
        });
      const sliced = docs.slice(0, limitCount);
      primeProductsListIntoCache(sliced, true);
      return sliced;
    };

    if (hasKnownMissingIndex(indexKey)) {
      return runFallback();
    }

    try {
      const q = query(
        colRef,
        where('isApproved', '==', true),
        where('isActive', '==', true),
        where('adType', '==', 'item'),
        orderBy('viewCount', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const rows = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        }))
        .filter(
          (item) =>
            item.categoryId !== 'accommodation' && getListingAdType(item) === 'item'
        );
      primeProductsListIntoCache(rows, true);
      return rows;
    } catch (err) {
      const firestoreErr = err as FirestoreError;
      if (firestoreErr?.code === 'failed-precondition') {
        markMissingIndex(indexKey);
        return runFallback();
      }
      if (firestoreErr?.code === 'unavailable') {
        throw new Error(
          'Could not reach the marketplace database. Check your internet connection and try again.'
        );
      }
      throw err;
    }
  });
}

/**
 * Fetches approved & active Firestore products strictly filtered by adType (defaults to 'item')
 * so Marketplace AI search only scans physical items and Services only scans services.
 */
export async function fetchAllApprovedActiveProducts(
  targetAdType: AdType = 'item'
): Promise<Product[]> {
  if (!db) {
    return [];
  }

  return runDeduplicatedQuery(`marketplace:all:${targetAdType}`, async () => {
    const colRef = collection(db!, 'products');
    const indexKey = `products:approved_active_${targetAdType}_all`;

    const runFallback = async () => {
      const fallbackQ = query(
        colRef,
        where('isApproved', '==', true),
        limit(120)
      );
      const snapshot = await getDocs(fallbackQ);
      const rows = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        }))
        .filter(
          (item) =>
            item.isApproved === true &&
            item.isActive === true &&
            item.categoryId !== 'accommodation' &&
            getListingAdType(item) === targetAdType
        );
      primeProductsListIntoCache(rows, true);
      return rows;
    };

    if (hasKnownMissingIndex(indexKey)) {
      return runFallback();
    }

    try {
      const constraints: QueryConstraint[] = [
        where('isApproved', '==', true),
        where('isActive', '==', true),
      ];
      if (targetAdType === 'service') {
        constraints.push(where('adType', '==', 'service'));
      }
      constraints.push(limit(120));

      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);
      const rows = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        }))
        .filter(
          (item) =>
            item.categoryId !== 'accommodation' &&
            getListingAdType(item) === targetAdType
        );
      primeProductsListIntoCache(rows, true);
      return rows;
    } catch (err) {
      const firestoreErr = err as FirestoreError;
      if (firestoreErr?.code === 'failed-precondition') {
        markMissingIndex(indexKey);
        return runFallback();
      }
      if (firestoreErr?.code === 'unavailable') {
        throw new Error(
          'Could not reach the marketplace database. Check your internet connection and try again.'
        );
      }
      throw err;
    }
  });
}

export async function fetchApprovedActiveServices(): Promise<Product[]> {
  return fetchAllApprovedActiveProducts('service');
}

/**
 * Queries ONLY newly added approved & active products (`createdAt > afterCreatedAtMs`)
 * for lightweight incremental sync without re-reading unchanged items.
 */
export async function fetchMarketplaceProductsDelta(
  afterCreatedAtMs: number,
  options: { adType?: AdType; categoryId?: string; limitCount?: number } = {}
): Promise<Product[]> {
  if (!db || afterCreatedAtMs <= 0) {
    return [];
  }

  const targetAdType: AdType = options.adType || 'item';
  const trimmedCat = options.categoryId?.trim() || '';
  const limitCount = options.limitCount ?? 20;
  const indexKey = `products:delta:${targetAdType}:${trimmedCat}`;

  if (hasKnownMissingIndex(indexKey)) {
    return [];
  }

  try {
    const constraints: QueryConstraint[] = [
      where('isApproved', '==', true),
      where('isActive', '==', true),
      where('adType', '==', targetAdType),
    ];
    if (trimmedCat) {
      constraints.push(where('categoryId', '==', trimmedCat));
    }
    constraints.push(
      where('createdAt', '>', Timestamp.fromMillis(afterCreatedAtMs + 1)),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(query(collection(db, 'products'), ...constraints));
    const rows = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Product, 'id'>),
      }))
      .filter(
        (item) =>
          item.categoryId !== 'accommodation' &&
          getListingAdType(item) === targetAdType
      );
    primeProductsListIntoCache(rows, true);
    return rows;
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      markMissingIndex(indexKey);
    }
    return [];
  }
}

/**
 * Queries approved & active Firestore products (items only) and matches them against
 * the original search query plus AI-expanded keywords.
 */
export async function fetchProductsByAiKeywords(
  originalQuery: string,
  expandedKeywords: string[]
): Promise<Product[]> {
  const docs = await fetchAllApprovedActiveProducts('item');
  return matchProductsBySearchKeywords(docs, originalQuery, expandedKeywords);
}

/**
 * Fetches paginated marketplace products (strictly adType == 'item' by default)
 * with category, subcategory, search, and sorting.
 */
export async function fetchMarketplaceProducts(
  limitCount = MARKETPLACE_PAGE_SIZE,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  filters: MarketplaceFilters = {}
): Promise<PaginatedProductsResult> {
  if (!db) {
    return { products: [], lastVisibleDoc: null, hasMore: false };
  }

  const colRef = collection(db, 'products');
  const sortBy: MarketplaceSortOption = filters.sortBy || 'newest';
  const targetAdType: AdType = filters.adType || 'item';
  const trimmedSearch = filters.searchQuery?.trim() || '';
  const trimmedCat = filters.categoryId?.trim() || '';
  const trimmedSub = filters.subcategory?.trim() || '';
  const indexKey = `products:list:${targetAdType}:${trimmedCat}:${trimmedSub}:${sortBy}`;

  const runBrowseQuery = async (): Promise<PaginatedProductsResult> => {
    const baseConstraints: QueryConstraint[] = [
      where('isApproved', '==', true),
      where('isActive', '==', true),
      where('adType', '==', targetAdType),
    ];

    if (trimmedCat) {
      baseConstraints.push(where('categoryId', '==', trimmedCat));
    }

    if (trimmedSub) {
      baseConstraints.push(where('subcategory', '==', trimmedSub));
    }

    if (sortBy === 'price_asc') {
      baseConstraints.push(orderBy('price', 'asc'));
    } else if (sortBy === 'price_desc') {
      baseConstraints.push(orderBy('price', 'desc'));
    } else if (sortBy === 'most_contacted') {
      baseConstraints.push(orderBy('contactCount', 'desc'));
    } else {
      baseConstraints.push(orderBy('createdAt', 'desc'));
    }

    const runFallback = async (): Promise<PaginatedProductsResult> => {
      const fallbackLimit = trimmedSearch
        ? 100
        : Math.max(limitCount * 4, 48);
      const fallbackQ = query(
        colRef,
        where('isApproved', '==', true),
        limit(fallbackLimit)
      );
      const snapshot = await getDocs(fallbackQ);
      const snapById = new Map<string, QueryDocumentSnapshot<DocumentData>>();
      const rawDocs = snapshot.docs.map((docSnap) => {
        snapById.set(docSnap.id, docSnap);
        return {
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        };
      });
      const filtered = applyLocalMarketplaceFiltersAndSort(rawDocs, {
        ...filters,
        adType: targetAdType,
      });

      if (trimmedSearch) {
        primeProductsListIntoCache(filtered, true);
        return {
          products: filtered,
          lastVisibleDoc: null,
          hasMore: false,
        };
      }

      let startIndex = 0;
      if (lastDoc) {
        const lastIndex = filtered.findIndex((item) => item.id === lastDoc.id);
        startIndex = lastIndex >= 0 ? lastIndex + 1 : filtered.length;
      }
      const pageItems = filtered.slice(startIndex, startIndex + limitCount);
      const lastItem = pageItems[pageItems.length - 1];
      const nextLastDoc =
        lastItem?.id ? snapById.get(lastItem.id) || null : null;

      primeProductsListIntoCache(pageItems, true);
      return {
        products: pageItems,
        lastVisibleDoc: nextLastDoc,
        hasMore: startIndex + limitCount < filtered.length,
      };
    };

    if (hasKnownMissingIndex(indexKey)) {
      return runFallback();
    }

    try {
      if (trimmedSearch) {
        const searchQ = query(colRef, ...baseConstraints, limit(80));
        const snapshot = await getDocs(searchQ);
        const rawDocs = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Product, 'id'>),
          }))
          .filter(
            (item) =>
              item.categoryId !== 'accommodation' &&
              getListingAdType(item) === targetAdType
          );
        const matched = filterProductsByQuery(rawDocs, trimmedSearch);
        primeProductsListIntoCache(matched, true);
        return {
          products: matched,
          lastVisibleDoc: null,
          hasMore: false,
        };
      }

      const paginatedConstraints: QueryConstraint[] = [...baseConstraints];
      if (lastDoc) {
        paginatedConstraints.push(startAfter(lastDoc));
      }
      paginatedConstraints.push(limit(limitCount + 1));

      const q = query(colRef, ...paginatedConstraints);
      const snapshot = await getDocs(q);

      const hasMore = snapshot.docs.length > limitCount;
      const pageDocs = hasMore
        ? snapshot.docs.slice(0, limitCount)
        : snapshot.docs;

      const products = pageDocs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        }))
        .filter(
          (item) =>
            item.categoryId !== 'accommodation' &&
            getListingAdType(item) === targetAdType
        );

      primeProductsListIntoCache(products, true);

      return {
        products,
        lastVisibleDoc:
          pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
        hasMore,
      };
    } catch (err) {
      const firestoreErr = err as FirestoreError;
      if (firestoreErr?.code === 'failed-precondition') {
        console.warn(
          getRequiredCompositeIndexHint(filters, sortBy),
          firestoreErr.message
        );
        markMissingIndex(indexKey);
        return runFallback();
      }
      if (firestoreErr?.code === 'unavailable') {
        throw new Error(
          'Could not reach the marketplace database. Check your internet connection and try again.'
        );
      }
      throw err;
    }
  };

  if (!lastDoc && !trimmedSearch) {
    return runDeduplicatedQuery(
      `marketplace:page0:${limitCount}:${indexKey}`,
      runBrowseQuery
    );
  }
  return runBrowseQuery();
}

export async function getApprovedProducts(): Promise<Product[]> {
  const result = await fetchMarketplaceProducts(100, null, {
    adType: 'item',
    sortBy: 'newest',
  });
  return result.products;
}

export async function getProductById(
  id: string,
  options?: { force?: boolean }
): Promise<Product | null> {
  const cleanId = id.trim();
  if (!cleanId) {
    return null;
  }

  const cacheCheck = shouldSkipDetailNetworkFetch<Product>(`product:${cleanId}`, {
    force: options?.force,
  });
  if (cacheCheck.skip && cacheCheck.cached) {
    return cacheCheck.cached;
  }

  if (!db) {
    return cacheCheck.cached;
  }

  return runDeduplicatedQuery(`product:get:${cleanId}`, async () => {
    try {
      const snap = await getDoc(doc(db!, 'products', cleanId));
      if (snap.exists()) {
        const product: Product = {
          id: snap.id,
          ...(snap.data() as Omit<Product, 'id'>),
        };
        primeProductIntoCache(product, { isFull: true, idbOnly: false });
        return product;
      }

      // Fallback for legacy documents in `services` collection now routed to /marketplace/:id
      const legacyServiceSnap = await getDoc(doc(db!, 'services', cleanId));
      if (legacyServiceSnap.exists()) {
        const data = legacyServiceSnap.data() as Record<string, unknown>;
        const legacyProduct: Product = {
          ...(data as Omit<Product, 'id'>),
          id: legacyServiceSnap.id,
          sellerId:
            typeof data.providerId === 'string'
              ? data.providerId
              : typeof data.sellerId === 'string'
                ? data.sellerId
                : '',
          adType: 'service',
        };
        primeProductIntoCache(legacyProduct, { isFull: true, idbOnly: false });
        return legacyProduct;
      }

      return null;
    } catch (err) {
      const firestoreErr = err as FirestoreError;
      if (firestoreErr?.code === 'unavailable') {
        if (cacheCheck.cached) return cacheCheck.cached;
        throw new Error(
          'Could not reach the marketplace database. Check your internet connection and try again.'
        );
      }
      if (firestoreErr?.code === 'permission-denied') {
        return null;
      }
      throw err;
    }
  });
}

export async function incrementProductViewCount(productId: string): Promise<void> {
  if (!db || !productId.trim()) {
    return;
  }

  try {
    await updateDoc(doc(db, 'products', productId), {
      viewCount: increment(1),
    });
  } catch (err) {
    // Non-blocking telemetry: avoid breaking detail view if rules aren't deployed yet.
    console.warn('Could not increment product viewCount:', err);
  }
}

export async function incrementProductContactCount(
  productId: string
): Promise<void> {
  if (!db || !productId.trim()) {
    return;
  }

  try {
    await updateDoc(doc(db, 'products', productId), {
      contactCount: increment(1),
    });
  } catch (err) {
    // Non-blocking telemetry: never prevent WhatsApp contact link from opening.
    console.warn('Could not increment product contactCount:', err);
  }
}
