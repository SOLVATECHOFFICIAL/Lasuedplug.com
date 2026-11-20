import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildListingApprovedNotification,
  buildWhatsAppContactNotification,
  countUnreadNotifications,
  formatNotificationTime,
  sortNotificationsByNewest,
} from './notificationHelpers';
import { buildEditedListingUpdatePayload } from './sellerHelpers';
import { AppNotification } from '../types';

test('countUnreadNotifications counts only unread items accurately', () => {
  const list: Array<Pick<AppNotification, 'isRead'>> = [
    { isRead: false },
    { isRead: true },
    { isRead: false },
  ];
  assert.equal(countUnreadNotifications(list), 2);
  assert.equal(countUnreadNotifications([]), 0);
});

test('sortNotificationsByNewest sorts descending by createdAt timestamp', () => {
  const list: AppNotification[] = [
    {
      id: 'n1',
      userId: 'u1',
      title: 'Old',
      message: 'First',
      type: 'system',
      isRead: true,
      createdAt: 1000,
    },
    {
      id: 'n2',
      userId: 'u1',
      title: 'Newest',
      message: 'Second',
      type: 'enquiry_received',
      isRead: false,
      createdAt: 5000,
    },
  ];
  const sorted = sortNotificationsByNewest(list);
  assert.deepEqual(
    sorted.map((n) => n.id),
    ['n2', 'n1']
  );
});

test('notification builders format approval and WhatsApp enquiry messages correctly', () => {
  const approved = buildListingApprovedNotification('seller-1', 'HP Laptop');
  assert.equal(approved.userId, 'seller-1');
  assert.equal(approved.type, 'listing_approved');
  assert.equal(approved.message, 'Your listing HP Laptop has been approved!');
  assert.equal(approved.link, '/dashboard/seller');

  const contact = buildWhatsAppContactNotification('seller-1', 'HP Laptop');
  assert.equal(contact.userId, 'seller-1');
  assert.equal(contact.type, 'enquiry_received');
  assert.equal(
    contact.message,
    'Someone contacted you on WhatsApp for HP Laptop.'
  );
  assert.equal(contact.link, '/dashboard/seller');
});

test('formatNotificationTime formats relative durations cleanly', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatNotificationTime(now - 20_000, now), 'Just now');
  assert.equal(formatNotificationTime(now - 5 * 60_000, now), '5m ago');
  assert.equal(formatNotificationTime(now - 3 * 3_600_000, now), '3h ago');
  assert.equal(formatNotificationTime(now - 2 * 86_400_000, now), '2d ago');
  assert.equal(formatNotificationTime(null, now), 'Recently');
});

test('buildEditedListingUpdatePayload strictly enforces isApproved = false (Auto-Hide on Edit)', () => {
  const itemUpdate = buildEditedListingUpdatePayload({
    adType: 'item',
    title: '  Updated HP Laptop  ',
    description: 'Updated description for campus buyer',
    categoryId: 'electronics',
    subcategory: 'Laptops & Computers',
    categoryName: 'Electronics & Gadgets',
    images: ['data:image/jpeg;base64,xyz'],
    priceType: 'fixed',
    price: 50000,
    quantity: 2,
    whatsappNumber: '08012345678',
    locationName: 'LASUED Main Gate',
    hasDelivery: true,
  });

  assert.equal(itemUpdate.isApproved, false);
  assert.equal(itemUpdate.title, 'Updated HP Laptop');
  assert.equal(itemUpdate.status, 'active');
  assert.equal(itemUpdate.isActive, true);

  const serviceUpdate = buildEditedListingUpdatePayload({
    adType: 'service',
    title: 'Updated Tutoring',
    description: 'Updated service description',
    categoryId: 'academics',
    subcategory: 'Private Tutoring',
    categoryName: 'Academic & Tutoring',
    images: [],
    priceType: 'fixed',
    serviceLocation: 'online',
    whatsappNumber: '08012345678',
  });

  assert.equal(serviceUpdate.isApproved, false);
  assert.equal(serviceUpdate.priceType, 'contact');
});
