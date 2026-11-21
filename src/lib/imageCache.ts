import { resolveListingImageUrl } from './seedAssets';

const warmedImageUrls = new Set<string>();
const inflightImageWarmups = new Map<string, Promise<void>>();

export function isImageWarmed(url?: string | null): boolean {
  const resolved = resolveListingImageUrl(url);
  if (!resolved) return false;
  if (resolved.startsWith('data:') || resolved.startsWith('blob:')) {
    return true;
  }
  return warmedImageUrls.has(resolved);
}

export function markImageWarmed(url?: string | null): void {
  const resolved = resolveListingImageUrl(url);
  if (!resolved) return;
  if (warmedImageUrls.size > 600) {
    const iterator = warmedImageUrls.values();
    for (let i = 0; i < 100; i += 1) {
      const oldest = iterator.next();
      if (oldest.done) break;
      warmedImageUrls.delete(oldest.value);
    }
  }
  warmedImageUrls.add(resolved);
}

export function warmImage(url?: string | null): Promise<void> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve();
  }
  const resolved = resolveListingImageUrl(url);
  if (!resolved) {
    return Promise.resolve();
  }
  if (resolved.startsWith('data:') || resolved.startsWith('blob:')) {
    warmedImageUrls.add(resolved);
    return Promise.resolve();
  }
  if (warmedImageUrls.has(resolved)) {
    return Promise.resolve();
  }

  const existing = inflightImageWarmups.get(resolved);
  if (existing) {
    return existing;
  }

  const promise = new Promise<void>((resolve) => {
    try {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.decoding = 'async';
      img.onload = () => {
        warmedImageUrls.add(resolved);
        inflightImageWarmups.delete(resolved);
        resolve();
      };
      img.onerror = () => {
        inflightImageWarmups.delete(resolved);
        resolve();
      };
      img.src = resolved;
    } catch {
      inflightImageWarmups.delete(resolved);
      resolve();
    }
  });

  inflightImageWarmups.set(resolved, promise);
  return promise;
}

export function warmImages(
  urls: ReadonlyArray<string | undefined | null>,
  maxCount = 8
): void {
  if (typeof window === 'undefined' || urls.length === 0) return;

  let warmed = 0;
  for (const rawUrl of urls) {
    if (warmed >= maxCount) break;
    const resolved = resolveListingImageUrl(rawUrl);
    if (!resolved || warmedImageUrls.has(resolved)) continue;
    warmed += 1;
    void warmImage(resolved);
  }
}
