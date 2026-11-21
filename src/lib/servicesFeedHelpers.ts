import { Product, Service, Store } from '../types';
import { getCategoryName, SERVICE_CATEGORIES } from './categories';
import { getTimestampMillis } from './homeHelpers';

export type MixedServiceFeedEntry =
  | {
      kind: 'product_service';
      id: string;
      createdAtMs: number;
      product: Product;
    }
  | {
      kind: 'legacy_service';
      id: string;
      createdAtMs: number;
      service: Service;
    }
  | {
      kind: 'store';
      id: string;
      createdAtMs: number;
      store: Store;
    };

export function doesStoreMatchServiceCategory(
  store: Store,
  selectedCategory: string
): boolean {
  if (!selectedCategory) return true;
  if (selectedCategory === 'stores') return true;

  const matchedServiceCat = SERVICE_CATEGORIES.find(
    (cat) => cat.id === selectedCategory
  );
  if (!matchedServiceCat) return false;

  const haystack = [store.category, store.subcategory, store.name, store.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    haystack.includes(matchedServiceCat.id.toLowerCase()) ||
    haystack.includes(matchedServiceCat.name.toLowerCase())
  ) {
    return true;
  }

  return matchedServiceCat.subs.some((sub) =>
    haystack.includes(sub.toLowerCase())
  );
}

export function buildMixedServicesAndStoresFeed(params: {
  productServices: ReadonlyArray<Product>;
  legacyServices: ReadonlyArray<Service>;
  stores: ReadonlyArray<Store>;
  selectedCategory?: string;
  searchQuery?: string;
}): MixedServiceFeedEntry[] {
  const category = (params.selectedCategory || '').trim();
  const queryText = (params.searchQuery || '').trim().toLowerCase();

  const entries: MixedServiceFeedEntry[] = [];
  const seenProductIds = new Set<string>();

  if (category !== 'stores') {
    for (const item of params.productServices) {
      if (item.id) seenProductIds.add(item.id);
      if (category && item.categoryId !== category) continue;

      if (queryText) {
        const haystack = [
          item.title,
          item.description,
          getCategoryName(item.categoryId),
          item.subcategory,
          item.locationName,
          item.shopName,
          item.storeName,
          item.sellerSnapshot?.fullName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(queryText)) continue;
      }

      entries.push({
        kind: 'product_service',
        id: item.id || `${item.sellerId}-${item.title}`,
        createdAtMs: getTimestampMillis(item.createdAt),
        product: item,
      });
    }

    for (const item of params.legacyServices) {
      if (item.id && seenProductIds.has(item.id)) continue;
      if (category && item.categoryId !== category) continue;

      if (queryText) {
        const haystack = [
          item.title,
          item.description,
          getCategoryName(item.categoryId),
          item.subcategory,
          item.locationName,
          item.shopName,
          item.sellerSnapshot?.fullName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(queryText)) continue;
      }

      entries.push({
        kind: 'legacy_service',
        id: item.id || `${item.providerId}-${item.title}`,
        createdAtMs: getTimestampMillis(item.createdAt),
        service: item,
      });
    }
  }

  for (const store of params.stores) {
    if (!doesStoreMatchServiceCategory(store, category)) continue;

    if (queryText) {
      const haystack = [
        store.name,
        store.description,
        store.category,
        store.subcategory,
        store.locationName,
        store.openingHours,
        store.ownerSnapshot?.fullName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(queryText)) continue;
    }

    entries.push({
      kind: 'store',
      id: store.id || `${store.ownerId}-${store.name}`,
      createdAtMs: getTimestampMillis(store.createdAt),
      store,
    });
  }

  entries.sort((a, b) => b.createdAtMs - a.createdAtMs);
  return entries;
}
