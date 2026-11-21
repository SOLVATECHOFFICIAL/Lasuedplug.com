import { MixedFeedType } from './trendingHelpers';

export const RECENTLY_VIEWED_STORAGE_KEY = 'recentlyViewed';
export const MAX_RECENTLY_VIEWED = 5;

export interface RecentlyViewedItem {
  id: string;
  _type: MixedFeedType;
  title: string;
  subtitle?: string;
  priceLabel: string;
  imageUrl?: string;
  href: string;
  isVerified?: boolean;
  viewedAt: number;
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is RecentlyViewedItem =>
          Boolean(entry) &&
          typeof entry === 'object' &&
          typeof entry.id === 'string' &&
          typeof entry.title === 'string' &&
          typeof entry.href === 'string'
      )
      .slice(0, MAX_RECENTLY_VIEWED);
  } catch {
    return [];
  }
}

export function saveRecentlyViewed(
  item: Omit<RecentlyViewedItem, 'viewedAt'>
): RecentlyViewedItem[] {
  if (!item.id.trim() || !item.href.trim()) {
    return getRecentlyViewed();
  }

  const nextEntry: RecentlyViewedItem = {
    ...item,
    viewedAt: Date.now(),
  };

  const existing = getRecentlyViewed();
  const deduped = existing.filter(
    (entry) => !(entry.id === item.id && entry._type === item._type)
  );
  const updated = [nextEntry, ...deduped].slice(0, MAX_RECENTLY_VIEWED);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        RECENTLY_VIEWED_STORAGE_KEY,
        JSON.stringify(updated)
      );
      window.dispatchEvent(new CustomEvent('lasuedplug:recently-viewed'));
    } catch {
      // Ignore quota or storage restriction errors
    }
  }

  return updated;
}

export function removeRecentlyViewedIds(
  ids: ReadonlyArray<string>,
  type?: MixedFeedType
): RecentlyViewedItem[] {
  const existing = getRecentlyViewed();
  if (ids.length === 0 || existing.length === 0) {
    return existing;
  }

  const removeSet = new Set(ids.map((id) => id.trim()).filter(Boolean));
  if (removeSet.size === 0) {
    return existing;
  }

  const updated = existing.filter((entry) => {
    if (!removeSet.has(entry.id)) return true;
    if (type && entry._type !== type) return true;
    return false;
  });

  if (updated.length === existing.length) {
    return existing;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        RECENTLY_VIEWED_STORAGE_KEY,
        JSON.stringify(updated)
      );
      window.dispatchEvent(new CustomEvent('lasuedplug:recently-viewed'));
    } catch {
      // Ignore quota or storage restriction errors
    }
  }

  return updated;
}

export function clearRecentlyViewedByType(
  type: MixedFeedType
): RecentlyViewedItem[] {
  const existing = getRecentlyViewed();
  if (existing.length === 0) {
    return existing;
  }

  const updated = existing.filter((entry) => entry._type !== type);
  if (updated.length === existing.length) {
    return existing;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        RECENTLY_VIEWED_STORAGE_KEY,
        JSON.stringify(updated)
      );
      window.dispatchEvent(new CustomEvent('lasuedplug:recently-viewed'));
    } catch {
      // Ignore quota or storage restriction errors
    }
  }

  return updated;
}

