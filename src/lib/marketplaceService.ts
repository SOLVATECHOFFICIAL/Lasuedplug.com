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
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getTimestampMillis } from './homeHelpers';
import {
  applyLocalMarketplaceFiltersAndSort,
  filterProductsByQuery,
  MarketplaceFilters,
  MarketplaceSortOption,
} from './marketplaceHelpers';
import { matchProductsBySearchKeywords } from './aiSearchService';
import { Product } from '../types';

export const MARKETPLACE_PAGE_SIZE = 12;

export interface PaginatedProductsResult {
  products: Product[];
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

function getRequiredCompositeIndexHint(
  filters: MarketplaceFilters,
  sortBy: MarketplaceSortOption
): string {
  const fields = ['isApproved ASC', 'isActive ASC'];
  if (filters.categoryId) fields.push('categoryId ASC');
  if (filters.subcategory) fields.push('subcategory ASC');
  if (sortBy === 'price_asc') fields.push('price ASC');
  else if (sortBy === 'price_desc') fields.push('price DESC');
  else if (sortBy === 'most_contacted') fields.push('contactCount DESC');
  else fields.push('createdAt DESC');

  return `Firestore composite index required on collection "products": (${fields.join(', ')}). Check firestore.indexes.json and deploy with "firebase deploy --only firestore:indexes".`;
}

/**
 * Fetches the top 8 trending products sorted by viewCount (descending).
 * Requires composite index: products (isApproved ASC, isActive ASC, viewCount DESC).
 */
export async function fetchTrendingProducts(limitCount = 8): Promise<Product[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, 'products');

  try {
    const q = query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      orderBy('viewCount', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Product, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      console.warn(
        'Firestore composite index required on collection "products": (isApproved ASC, isActive ASC, viewCount DESC). Check firestore.indexes.json.',
        firestoreErr.message
      );
      const fallbackQ = query(colRef, where('isApproved', '==', true));
      const snapshot = await getDocs(fallbackQ);
      const docs = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        }))
        .filter((item) => item.isApproved === true && item.isActive === true)
        .sort((a, b) => {
          const viewDiff = (b.viewCount || 0) - (a.viewCount || 0);
          if (viewDiff !== 0) return viewDiff;
          const contactDiff = (b.contactCount || 0) - (a.contactCount || 0);
          if (contactDiff !== 0) return contactDiff;
          return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
        });
      return docs.slice(0, limitCount);
    }
    if (firestoreErr?.code === 'unavailable') {
      throw new Error(
        'Could not reach the marketplace database. Check your internet connection and try again.'
      );
    }
    throw err;
  }
}

/**
 * Fetches all approved & active Firestore products so AI search can scan
 * every listing (titles, descriptions, categories, locations, and image hints).
 */
export async function fetchAllApprovedActiveProducts(): Promise<Product[]> {
  if (!db) {
    return [];
  }

  const colRef = collection(db, 'products');

  try {
    const q = query(
      colRef,
      where('isApproved', '==', true),
      where('isActive', '==', true),
      limit(250)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Product, 'id'>),
    }));
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'failed-precondition') {
      const fallbackQ = query(colRef, where('isApproved', '==', true));
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        }))
        .filter((item) => item.isApproved === true && item.isActive === true);
    }
    if (firestoreErr?.code === 'unavailable') {
      throw new Error(
        'Could not reach the marketplace database. Check your internet connection and try again.'
      );
    }
    throw err;
  }
}

/**
 * Queries approved & active Firestore products and matches them against
 * the original search query plus AI-expanded keywords.
 */
export async function fetchProductsByAiKeywords(
  originalQuery: string,
  expandedKeywords: string[]
): Promise<Product[]> {
  const docs = await fetchAllApprovedActiveProducts();
  return matchProductsBySearchKeywords(docs, originalQuery, expandedKeywords);
}

/**
 * Fetches paginated marketplace products with category, subcategory, search, and sorting.
 *
 * NOTE: Combining `where` clauses (isApproved, isActive, categoryId, subcategory)
 * with `orderBy` (createdAt, price, or contactCount) requires composite indexes in Firestore.
 * Required indexes are defined in `firestore.indexes.json`.
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
  const trimmedSearch = filters.searchQuery?.trim() || '';

  const baseConstraints: QueryConstraint[] = [
    where('isApproved', '==', true),
    where('isActive', '==', true),
  ];

  if (filters.categoryId?.trim()) {
    baseConstraints.push(where('categoryId', '==', filters.categoryId.trim()));
  }

  if (filters.subcategory?.trim()) {
    baseConstraints.push(where('subcategory', '==', filters.subcategory.trim()));
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

  try {
    if (trimmedSearch) {
      const searchQ = query(colRef, ...baseConstraints, limit(100));
      const snapshot = await getDocs(searchQ);
      const rawDocs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Product, 'id'>),
      }));
      const matched = filterProductsByQuery(rawDocs, trimmedSearch);
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

    const products = pageDocs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Product, 'id'>),
    }));

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
      const fallbackQ = query(colRef, where('isApproved', '==', true));
      const snapshot = await getDocs(fallbackQ);
      const snapById = new Map<string, QueryDocumentSnapshot<DocumentData>>();
      const rawDocs = snapshot.docs.map((docSnap) => {
        snapById.set(docSnap.id, docSnap);
        return {
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, 'id'>),
        };
      });
      const filtered = applyLocalMarketplaceFiltersAndSort(rawDocs, filters);

      if (trimmedSearch) {
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

      return {
        products: pageItems,
        lastVisibleDoc: nextLastDoc,
        hasMore: startIndex + limitCount < filtered.length,
      };
    }
    if (firestoreErr?.code === 'unavailable') {
      throw new Error(
        'Could not reach the marketplace database. Check your internet connection and try again.'
      );
    }
    throw err;
  }
}

export async function getApprovedProducts(): Promise<Product[]> {
  const result = await fetchMarketplaceProducts(100, null, { sortBy: 'newest' });
  return result.products;
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!db || !id.trim()) {
    return null;
  }

  try {
    const snap = await getDoc(doc(db, 'products', id));
    if (!snap.exists()) {
      return null;
    }
    return {
      id: snap.id,
      ...(snap.data() as Omit<Product, 'id'>),
    };
  } catch (err) {
    const firestoreErr = err as FirestoreError;
    if (firestoreErr?.code === 'unavailable') {
      throw new Error(
        'Could not reach the marketplace database. Check your internet connection and try again.'
      );
    }
    if (firestoreErr?.code === 'permission-denied') {
      return null;
    }
    throw err;
  }
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
