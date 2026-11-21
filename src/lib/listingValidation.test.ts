import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOpeningHoursRange,
  isGpsAccuracyAcceptable,
  isValidGpsCoordinates,
  NO_IMAGES_TOAST_MESSAGE,
  validateAccommodationCreateInput,
  validateImageCount,
  validateMarketplaceCreateInput,
  validateRoommateCreateInput,
  validateStoreCreateInput,
} from './listingValidation';

test('validateImageCount enforces minimum 1 and maximum 4 images', () => {
  assert.equal(validateImageCount(0), NO_IMAGES_TOAST_MESSAGE);
  assert.equal(validateImageCount(1), null);
  assert.equal(validateImageCount(4), null);
  assert.ok(validateImageCount(5));
});

test('GPS accuracy and coordinate helpers enforce <= 50m threshold and valid bounds', () => {
  assert.equal(isGpsAccuracyAcceptable(12), true);
  assert.equal(isGpsAccuracyAcceptable(50), true);
  assert.equal(isGpsAccuracyAcceptable(50.1), false);
  assert.equal(isGpsAccuracyAcceptable(120), false);
  assert.equal(isGpsAccuracyAcceptable(undefined), false);

  assert.equal(isValidGpsCoordinates(6.5832, 3.9814), true);
  assert.equal(isValidGpsCoordinates(undefined, 3.9814), false);
  assert.equal(isValidGpsCoordinates(95, 3.9814), false);
});

test('formatOpeningHoursRange formats 24h time picker values cleanly', () => {
  assert.equal(
    formatOpeningHoursRange('08:00', '18:30'),
    '8:00 AM - 6:30 PM'
  );
  assert.equal(
    formatOpeningHoursRange('00:15', '12:00'),
    '12:15 AM - 12:00 PM'
  );
  assert.equal(formatOpeningHoursRange('', '18:00'), '');
});

test('validateMarketplaceCreateInput validates items (physical vs online) and services (shop vs mobile/online)', () => {
  const missingItemErrors = validateMarketplaceCreateInput({
    adType: 'item',
    title: 'Book',
    description: 'Good',
    categoryId: '',
    subcategory: '',
    imagesCount: 0,
    quantity: '1',
    priceType: 'fixed',
    priceAmount: '',
    locationType: 'physical',
    locationName: '',
    whatsappNumber: '08012345678',
  });
  assert.equal(missingItemErrors.images, NO_IMAGES_TOAST_MESSAGE);
  assert.ok(missingItemErrors.title);
  assert.ok(missingItemErrors.description);
  assert.ok(missingItemErrors.categoryId);
  assert.ok(missingItemErrors.price);
  assert.ok(missingItemErrors.locationName);
  assert.ok(missingItemErrors.gps);

  // Online item hides/skips GPS and address requirements, and Contact for Price skips price
  const validOnlineItem = validateMarketplaceCreateInput({
    adType: 'item',
    title: 'Netflix Gift Card',
    description: 'Instant digital voucher delivery on WhatsApp',
    categoryId: 'electronics',
    subcategory: 'Other Electronics',
    imagesCount: 1,
    quantity: '2',
    priceType: 'contact',
    priceAmount: '',
    locationType: 'online',
    locationName: '',
    whatsappNumber: '08012345678',
  });
  assert.deepEqual(validOnlineItem, {});

  // Service with physical shop requires shop address + GPS + price if fixed
  const invalidShopService = validateMarketplaceCreateInput({
    adType: 'service',
    title: 'Phone Repair',
    description: 'Fast iPhone and Android screen replacements',
    categoryId: 'tech_repairs',
    subcategory: 'Phone Repairs',
    imagesCount: 2,
    priceType: 'fixed',
    priceAmount: '0',
    locationType: 'physical',
    serviceLocation: 'shop',
    locationName: '',
    whatsappNumber: '08012345678',
  });
  assert.ok(invalidShopService.price);
  assert.ok(invalidShopService.locationName);
  assert.ok(invalidShopService.gps);

  // Mobile/online service with contact for price passes without GPS/address
  const validMobileService = validateMarketplaceCreateInput({
    adType: 'service',
    title: 'Home Hair Braiding',
    description: 'Neat knotless braids at your hostel room',
    categoryId: 'beauty',
    subcategory: 'Hair Styling & Braiding',
    imagesCount: 2,
    priceType: 'contact',
    priceAmount: '',
    locationType: 'online',
    serviceLocation: 'mobile',
    locationName: '',
    whatsappNumber: '08012345678',
  });
  assert.deepEqual(validMobileService, {});
});

test('validateAccommodationCreateInput and validateRoommateCreateInput require images, >=5 char text, amenities/budget, and GPS pin', () => {
  assert.equal(
    validateAccommodationCreateInput({
      type: 'self_contain',
      title: 'Clean Self Contain',
      description: 'Water and light',
      rentPrice: '180000',
      amenitiesCount: 1,
      generalLocation: 'LASUED Gate',
      exactAddress: 'Plot 5, Epe Road',
      imagesCount: 0,
      whatsappDigits: '2348012345678',
      latitude: 6.58,
      longitude: 3.98,
    }),
    NO_IMAGES_TOAST_MESSAGE
  );

  assert.ok(
    validateAccommodationCreateInput({
      type: 'self_contain',
      title: 'Clean Self Contain',
      description: 'Water and light available daily',
      rentPrice: '180000',
      amenitiesCount: 1,
      generalLocation: 'LASUED Gate',
      exactAddress: 'Plot 5, Epe Road',
      imagesCount: 2,
      whatsappDigits: '2348012345678',
    })?.includes('GPS')
  );

  assert.equal(
    validateAccommodationCreateInput({
      type: 'self_contain',
      title: 'Clean Self Contain',
      description: 'Water and light available daily',
      rentPrice: '180000',
      amenitiesCount: 1,
      generalLocation: 'LASUED Gate',
      exactAddress: 'Plot 5, Epe Road',
      imagesCount: 2,
      whatsappDigits: '2348012345678',
      latitude: 6.58,
      longitude: 3.98,
    }),
    null
  );

  assert.ok(
    validateRoommateCreateInput({
      type: 'need_roommate',
      title: 'Female roommate needed',
      description: 'Sharing 2-bed flat near gate',
      budget: '',
      generalLocation: 'Igbogbo, Epe',
      preferences: 'Female, neat',
      imagesCount: 1,
      whatsappDigits: '2348012345678',
      latitude: 6.58,
      longitude: 3.98,
    })?.includes('budget')
  );

  assert.ok(
    validateRoommateCreateInput({
      type: 'need_roommate',
      title: 'Female roommate needed',
      description: 'Sharing 2-bed flat near gate',
      budget: '120000',
      generalLocation: 'Igbogbo, Epe',
      preferences: 'Female, neat',
      imagesCount: 1,
      whatsappDigits: '2348012345678',
    })?.includes('GPS')
  );
});

test('validateStoreCreateInput requires images, >=5 char name & desc, opening hours, address, and GPS pin', () => {
  const badStore = validateStoreCreateInput({
    name: 'Shop',
    description: 'Nice',
    category: 'General Campus Store',
    openingTimeStart: '',
    openingTimeEnd: '',
    imagesCount: 0,
    whatsappNumber: '08012345678',
    locationName: '',
  });
  assert.equal(badStore.images, NO_IMAGES_TOAST_MESSAGE);
  assert.ok(badStore.name);
  assert.ok(badStore.description);
  assert.ok(badStore.openingHours);
  assert.ok(badStore.locationName);
  assert.ok(badStore.gps);

  const goodStore = validateStoreCreateInput({
    name: 'Campus Gadgets Hub',
    description: 'Affordable phone accessories and repairs near gate.',
    category: 'Electronics & Gadgets',
    openingTimeStart: '08:00',
    openingTimeEnd: '18:00',
    imagesCount: 2,
    whatsappNumber: '08012345678',
    locationName: 'Shop 4, LASUED Main Gate',
    latitude: 6.5812,
    longitude: 3.9821,
  });
  assert.deepEqual(goodStore, {});
});
