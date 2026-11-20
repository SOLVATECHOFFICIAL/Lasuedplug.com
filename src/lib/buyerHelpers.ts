import { getTimestampMillis } from './homeHelpers';

export function buildFavoriteDocId(userId: string, listingId: string): string {
  return `${userId.trim()}_${listingId.trim()}`;
}

export function sortByCreatedAtDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
  );
}

export function formatEnquiryDate(value: unknown): string {
  const millis = getTimestampMillis(value);
  if (!millis) {
    return 'Just now';
  }
  return new Date(millis).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
