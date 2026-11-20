import { AppNotification, NotificationType } from '../types';
import { getTimestampMillis } from './homeHelpers';

export function countUnreadNotifications(
  notifications: ReadonlyArray<Pick<AppNotification, 'isRead'>>
): number {
  return notifications.reduce(
    (count, item) => (item.isRead === false ? count + 1 : count),
    0
  );
}

export function sortNotificationsByNewest(
  notifications: AppNotification[]
): AppNotification[] {
  return [...notifications].sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
  );
}

export function formatNotificationTime(
  createdAt: unknown,
  nowMillis = Date.now()
): string {
  const millis = getTimestampMillis(createdAt);
  if (!millis) {
    return 'Recently';
  }
  const diffSeconds = Math.max(0, Math.floor((nowMillis - millis) / 1000));
  if (diffSeconds < 60) {
    return 'Just now';
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return new Date(millis).toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
  });
}

export interface CreateNotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
}

export function buildListingApprovedNotification(
  sellerId: string,
  listingTitle: string,
  link = '/dashboard/seller'
): CreateNotificationPayload {
  return {
    userId: sellerId,
    title: 'Listing Approved',
    message: `Your listing ${listingTitle} has been approved!`,
    type: 'listing_approved',
    link,
  };
}

export function buildListingRejectedNotification(
  ownerId: string,
  listingTitle: string,
  link = '/dashboard/seller'
): CreateNotificationPayload {
  return {
    userId: ownerId,
    title: 'Listing Not Approved',
    message: `Your listing ${listingTitle} was not approved and has been removed.`,
    type: 'listing_rejected',
    link,
  };
}

export function buildWhatsAppContactNotification(
  sellerId: string,
  listingTitle: string,
  link = '/dashboard/seller'
): CreateNotificationPayload {
  return {
    userId: sellerId,
    title: 'New WhatsApp Enquiry',
    message: `Someone contacted you on WhatsApp for ${listingTitle}.`,
    type: 'enquiry_received',
    link,
  };
}
