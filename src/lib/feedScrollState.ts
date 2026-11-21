const SCROLL_STORAGE_PREFIX = 'lasuedplug_scroll_v1:';
const MAX_STORED_SCROLL_ENTRIES = 40;

const scrollByHistoryKey = new Map<string, number>();
const scrollByRouteKey = new Map<string, number>();
const feedViewStateByKey = new Map<string, unknown>();

function readSessionScroll(storageKey: string): number | undefined {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return undefined;
    }
    const raw = window.sessionStorage.getItem(
      `${SCROLL_STORAGE_PREFIX}${storageKey}`
    );
    if (raw === null) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeSessionScroll(storageKey: string, value: number): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }
    window.sessionStorage.setItem(
      `${SCROLL_STORAGE_PREFIX}${storageKey}`,
      String(Math.max(0, Math.round(value)))
    );
  } catch {
    // Ignore storage errors (private mode / quota)
  }
}

function trimMap<K, V>(map: Map<K, V>, maxEntries = MAX_STORED_SCROLL_ENTRIES): void {
  while (map.size > maxEntries) {
    const firstKey = map.keys().next().value;
    if (firstKey === undefined) break;
    map.delete(firstKey);
  }
}

export function buildRouteKey(pathname: string, search = ''): string {
  return `${pathname || '/'}${search || ''}`;
}

export function saveRouteScroll(
  historyKey: string | undefined,
  routeKey: string,
  scrollY: number
): void {
  if (!Number.isFinite(scrollY) || scrollY < 0) return;
  const normalizedY = Math.round(scrollY);

  if (historyKey && historyKey !== 'default') {
    scrollByHistoryKey.set(historyKey, normalizedY);
    trimMap(scrollByHistoryKey);
    writeSessionScroll(`k:${historyKey}`, normalizedY);
  }

  if (routeKey) {
    scrollByRouteKey.set(routeKey, normalizedY);
    trimMap(scrollByRouteKey);
    writeSessionScroll(`r:${routeKey}`, normalizedY);
  }
}

export function getSavedRouteScroll(
  historyKey: string | undefined,
  routeKey: string
): number | undefined {
  if (historyKey && historyKey !== 'default') {
    const mem = scrollByHistoryKey.get(historyKey);
    if (typeof mem === 'number') return mem;
    const sessionVal = readSessionScroll(`k:${historyKey}`);
    if (typeof sessionVal === 'number') {
      scrollByHistoryKey.set(historyKey, sessionVal);
      return sessionVal;
    }
  }

  if (routeKey) {
    const routeMem = scrollByRouteKey.get(routeKey);
    if (typeof routeMem === 'number') return routeMem;
    const routeSessionVal = readSessionScroll(`r:${routeKey}`);
    if (typeof routeSessionVal === 'number') {
      scrollByRouteKey.set(routeKey, routeSessionVal);
      return routeSessionVal;
    }
  }

  return undefined;
}

export function saveRouteViewState<T>(
  historyKey: string | undefined,
  routeKey: string,
  state: T
): void {
  if (historyKey && historyKey !== 'default') {
    feedViewStateByKey.set(`k:${historyKey}`, state);
  }
  if (routeKey) {
    feedViewStateByKey.set(`r:${routeKey}`, state);
  }
  trimMap(feedViewStateByKey);
}

export function getSavedRouteViewState<T>(
  historyKey: string | undefined,
  routeKey: string
): T | undefined {
  if (historyKey && historyKey !== 'default') {
    const keyHit = feedViewStateByKey.get(`k:${historyKey}`);
    if (keyHit !== undefined) return keyHit as T;
  }
  if (routeKey) {
    const routeHit = feedViewStateByKey.get(`r:${routeKey}`);
    if (routeHit !== undefined) return routeHit as T;
  }
  return undefined;
}

export function hasInAppBackHistory(
  historyState: unknown = typeof window !== 'undefined'
    ? window.history.state
    : null,
  locationKey?: string
): boolean {
  if (
    historyState &&
    typeof historyState === 'object' &&
    typeof (historyState as { idx?: unknown }).idx === 'number'
  ) {
    return (historyState as { idx: number }).idx > 0;
  }
  return Boolean(locationKey && locationKey !== 'default');
}

export function getScrollActionForNavigation(params: {
  navigationType: 'POP' | 'PUSH' | 'REPLACE';
  pathnameChanged: boolean;
}): 'restore' | 'reset-top' | 'none' {
  if (params.navigationType === 'POP') {
    return 'restore';
  }
  if (params.pathnameChanged) {
    return 'reset-top';
  }
  return 'none';
}

export function resetFeedScrollStateForTests(): void {
  scrollByHistoryKey.clear();
  scrollByRouteKey.clear();
  feedViewStateByKey.clear();
}
