import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAccommodationWhatsAppUrl,
  buildRoommateWhatsAppUrl,
  filterAccommodations,
  filterRoommateRequests,
  getAccommodationPublicLocation,
  getAccommodationRent,
  getAccommodationTypeLabel,
  getRoommateTypeLabel,
  sanitizePublicAccommodation,
} from './accommodationHelpers';
import { Accommodation, RoommateRequest } from '../types';

const SAMPLE_ACCOMMODATIONS: Accommodation[] = [
  {
    id: 'acc-1',
    ownerId: 'owner-1',
    type: 'self_contain',
    title: 'Self Contain at Epe',
    description: 'Clean studio with tiled floor and borehole',
    rentPrice: 250000,
    generalLocation: 'Epe, Near Campus Road',
    exactAddress: 'Plot 12, Secret Street, Epe',
    amenities: ['Running Water', 'Prepaid Meter'],
    images: ['data:image/png;base64,abc'],
    whatsappNumber: '08012345678',
    isApproved: true,
    isActive: true,
    createdAt: 1000,
    ownerSnapshot: { fullName: 'Mr. Ade', isVerified: true },
  },
  {
    id: 'acc-2',
    ownerId: 'owner-2',
    type: 'single_room',
    title: 'Single Room near LASUED Gate',
    description: 'Affordable student room',
    rentPrice: 120000,
    generalLocation: 'Near LASUED Gate',
    exactAddress: 'House 7, Hidden Lane',
    amenities: ['Fenced Compound'],
    images: ['data:image/png;base64,abc'],
    whatsappNumber: '2348098765432',
    isApproved: true,
    isActive: true,
    createdAt: 2000,
  },
  {
    id: 'acc-3',
    ownerId: 'owner-3',
    type: 'shared_apartment',
    title: 'Pending Shared Flat',
    description: 'Not yet approved',
    rentPrice: 300000,
    generalLocation: 'Igbogbo',
    exactAddress: 'Block 5, Hidden Avenue',
    amenities: [],
    images: [],
    whatsappNumber: '08011112222',
    isApproved: false,
    isActive: true,
    createdAt: 3000,
  },
];

test('sanitizePublicAccommodation removes exactAddress completely', () => {
  const sanitized = sanitizePublicAccommodation(SAMPLE_ACCOMMODATIONS[0]);
  assert.equal('exactAddress' in sanitized, false);
  assert.equal(sanitized.generalLocation, 'Epe, Near Campus Road');
  assert.equal(sanitized.rentPrice, 250000);
});

test('filterAccommodations filters by approval, type, price range, and never matches private exactAddress', () => {
  const approvedOnly = filterAccommodations(SAMPLE_ACCOMMODATIONS, {});
  assert.deepEqual(
    approvedOnly.map((a) => a.id),
    ['acc-1', 'acc-2']
  );

  const singleRooms = filterAccommodations(SAMPLE_ACCOMMODATIONS, {
    type: 'single_room',
  });
  assert.deepEqual(
    singleRooms.map((a) => a.id),
    ['acc-2']
  );

  const under150k = filterAccommodations(SAMPLE_ACCOMMODATIONS, {
    priceRange: 'under_150k',
  });
  assert.deepEqual(
    under150k.map((a) => a.id),
    ['acc-2']
  );

  const range150to250 = filterAccommodations(SAMPLE_ACCOMMODATIONS, {
    priceRange: '150k_250k',
  });
  assert.deepEqual(
    range150to250.map((a) => a.id),
    ['acc-1']
  );

  const publicLocationMatch = filterAccommodations(SAMPLE_ACCOMMODATIONS, {
    locationQuery: 'LASUED Gate',
  });
  assert.deepEqual(
    publicLocationMatch.map((a) => a.id),
    ['acc-2']
  );

  // Must NOT match private exactAddress
  const secretSearch = filterAccommodations(SAMPLE_ACCOMMODATIONS, {
    locationQuery: 'Secret Street',
  });
  assert.equal(secretSearch.length, 0);
});

test('accommodation labels, fallbacks, and WhatsApp URL formatting work properly', () => {
  assert.equal(getAccommodationTypeLabel('self_contain'), 'Self Contain');
  assert.equal(getAccommodationTypeLabel('shared_apartment'), 'Shared Apartment');
  assert.equal(getAccommodationTypeLabel('short_let'), 'Short Let');
  assert.equal(getRoommateTypeLabel('need_roommate'), 'Looking for Roommate');
  assert.equal(getRoommateTypeLabel('room_available'), 'Room Available');

  assert.equal(getAccommodationRent({ rentPrice: 250000 }), 250000);
  assert.equal(getAccommodationRent({ price: 95000 }), 95000);
  assert.equal(
    getAccommodationPublicLocation({ generalLocation: 'Igbogbo, Epe' }),
    'Igbogbo, Epe'
  );

  const url = buildAccommodationWhatsAppUrl('08012345678', 'Self Contain at Epe');
  assert.ok(url.startsWith('https://wa.me/2348012345678?text='));
  assert.ok(
    decodeURIComponent(url).includes(
      'Hello, I saw your accommodation listing for Self Contain at Epe on LASUEDPLUG. Is it still available?'
    )
  );

  const roommateUrl = buildRoommateWhatsAppUrl(
    '08012345678',
    'Looking for female roommate'
  );
  assert.ok(roommateUrl.startsWith('https://wa.me/2348012345678?text='));
});

test('filterRoommateRequests filters by approval, active status, type, and search', () => {
  const requests: RoommateRequest[] = [
    {
      id: 'rm-1',
      userId: 'u1',
      type: 'need_roommate',
      title: 'Looking for a female roommate to share a 2-bedroom at Igbogbo',
      description: 'Clean apartment close to transport',
      budget: 140000,
      generalLocation: 'Igbogbo, Epe',
      preferences: 'Female only, neat, no smoking',
      whatsappNumber: '2348061234567',
      isApproved: true,
      isActive: true,
      createdAt: 1000,
    },
    {
      id: 'rm-2',
      userId: 'u2',
      type: 'room_available',
      title: 'Space available near gate',
      description: 'Self contain sharing',
      generalLocation: 'Near LASUED Gate',
      preferences: 'Male student',
      whatsappNumber: '2348059876543',
      isApproved: false,
      isActive: true,
      createdAt: 2000,
    },
  ];

  const allApproved = filterRoommateRequests(requests);
  assert.deepEqual(
    allApproved.map((r) => r.id),
    ['rm-1']
  );

  const roomAvailableOnly = filterRoommateRequests(requests, 'room_available');
  assert.equal(roomAvailableOnly.length, 0);

  const locationFiltered = filterRoommateRequests(requests, 'all', 'igbogbo');
  assert.equal(locationFiltered.length, 1);
});
