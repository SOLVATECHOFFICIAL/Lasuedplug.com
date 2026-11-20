import { ALL_MARKETPLACE_CATEGORIES } from './categories';
import { AdType, PriceType, PriceUnit, ServiceLocation } from '../types';

export const SEED_PLACEHOLDER_IMAGE_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mN8//HLfwYiAOOoQvoqBABbWyZJf74G2QAAAABJRU5ErkJggg==';

export interface TimestampLike {
  toMillis?: () => number;
  seconds?: number;
}

export function getTimestampMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    const ts = value as TimestampLike;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  }
  return 0;
}

export function filterAndSortListings<
  T extends { isApproved?: boolean; isActive?: boolean; createdAt?: unknown }
>(items: T[], limitCount = 4): T[] {
  return items
    .filter((item) => item.isApproved === true && item.isActive === true)
    .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt))
    .slice(0, limitCount);
}

export function buildMarketplaceSearchUrl(rawQuery: string): string {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return '/marketplace';
  }
  return `/marketplace?q=${encodeURIComponent(trimmed)}`;
}

export const SEED_CATEGORIES = ALL_MARKETPLACE_CATEGORIES.map((category) => ({
  id: category.id,
  name: category.name,
  slug: category.id,
  subs: [...category.subs],
}));

export interface SeedProductRecord {
  id: string;
  sellerId: string;
  adType: AdType;
  title: string;
  description: string;
  categoryId: string;
  subcategory: string;
  categoryName: string;
  images: string[];
  quantity?: number;
  serviceLocation?: ServiceLocation;
  priceType: PriceType;
  price?: number;
  priceUnit?: PriceUnit;
  whatsappNumber: string;
  locationName: string;
  shopName?: string;
  latitude?: number;
  longitude?: number;
  hasDelivery?: boolean;
  viewCount: number;
  contactCount: number;
  sellerSnapshot: { fullName: string; isVerified: boolean };
  status: 'active';
  isApproved: boolean;
  isActive: boolean;
}

export const SEED_PRODUCTS: SeedProductRecord[] = [
  {
    id: 'seed-product-1',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Butter',
    description:
      'Fresh salted table butter spread (250g tub), kept cool and ready for breakfast bread, toast, or baking around hostel.',
    quantity: 12,
    priceType: 'fixed',
    price: 1800,
    priceUnit: 'per_item',
    categoryId: 'food',
    subcategory: 'Raw Foodstuff',
    categoryName: 'Food & Groceries',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Sub-Gate Food Pavilion',
    shopName: "Mama Kelechi's Shop",
    latitude: 6.5836,
    longitude: 3.9842,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348067890123',
    sellerSnapshot: {
      fullName: 'Kelechi Nwosu',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-2',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Akara and Bread',
    description:
      'Hot morning akara fried fresh at 7 AM paired with soft Agege bread. Great campus breakfast before early lectures.',
    quantity: 20,
    priceType: 'fixed',
    price: 700,
    priceUnit: 'per_item',
    categoryId: 'food',
    subcategory: 'Cooked Meals',
    categoryName: 'Food & Groceries',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'LASUED Main Gate',
    shopName: 'Iya Yusuf Breakfast Spot',
    latitude: 6.5829,
    longitude: 3.9831,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348067890123',
    sellerSnapshot: {
      fullName: 'Kelechi Nwosu',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-3',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Puff Puff',
    description:
      'Golden, fluffy Nigerian puff-puff packed warm with optional pepper sauce. Bulk hostel boxes also available.',
    quantity: 15,
    priceType: 'fixed',
    price: 500,
    priceUnit: 'per_item',
    categoryId: 'food',
    subcategory: 'Small Chops & Snacks (Buns, Meatpie, Bread & Egg)',
    categoryName: 'Food & Groceries',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Sub-Gate Food Pavilion',
    shopName: "Mama Kelechi's Shop",
    latitude: 6.5835,
    longitude: 3.9844,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348067890123',
    sellerSnapshot: {
      fullName: 'Kelechi Nwosu',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-4',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Egg and Tea',
    description:
      'Hot spiced tea with fried egg and toasted bread served fresh for breakfast or late-night reading fuel.',
    quantity: 10,
    priceType: 'fixed',
    price: 1000,
    priceUnit: 'per_item',
    categoryId: 'food',
    subcategory: 'Cooked Meals',
    categoryName: 'Food & Groceries',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Block A Hostel Walkway',
    latitude: 6.5841,
    longitude: 3.9825,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348056789012',
    sellerSnapshot: {
      fullName: 'Seyi Ogunleye',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-5',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'HP Laptop',
    description:
      'Clean UK-used HP Pavilion 14 Core i5 laptop with 8GB RAM, 256GB SSD, strong battery life, and original charger included.',
    quantity: 1,
    priceType: 'fixed',
    price: 45000,
    priceUnit: 'total',
    categoryId: 'electronics',
    subcategory: 'Laptops & Computers',
    categoryName: 'Electronics & Gadgets',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Shop 4, LASUED Gate',
    shopName: 'TechHub Campus Store',
    latitude: 6.5827,
    longitude: 3.9835,
    hasDelivery: false,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348012345678',
    sellerSnapshot: {
      fullName: 'Tunde Adeyemi',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-6',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Phone Charger',
    description:
      'Fast 20W USB-C & Lightning phone charger with braided cable compatible with iPhone, Samsung, Tecno, and Infinix.',
    quantity: 8,
    priceType: 'fixed',
    price: 3500,
    priceUnit: 'per_item',
    categoryId: 'electronics',
    subcategory: 'Phone Accessories',
    categoryName: 'Electronics & Gadgets',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'LASUED Faculty Courtyard',
    shopName: 'Campus Gadgets NG',
    latitude: 6.5832,
    longitude: 3.9829,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348012345678',
    sellerSnapshot: {
      fullName: 'Tunde Adeyemi',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-7',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Nike Sneakers',
    description:
      'Clean white EU 42 Nike low-top sneakers in great condition. Comfortable for daily lectures and campus walks.',
    quantity: 2,
    priceType: 'negotiable',
    price: 22000,
    priceUnit: 'total',
    categoryId: 'fashion',
    subcategory: 'Shoes & Sneakers',
    categoryName: 'Fashion & Clothing',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Epe Market Junction',
    shopName: 'Campus Drip Closet',
    latitude: 6.5849,
    longitude: 3.9851,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348045678901',
    sellerSnapshot: {
      fullName: 'Aisha Lawal',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-8',
    sellerId: 'test_seller',
    adType: 'service',
    serviceLocation: 'shop',
    title: 'Phone Charging & Device Care',
    description:
      'Reliable solar and inverter phone charging lockers and quick hardware checkups right opposite the main gate.',
    priceType: 'contact',
    categoryId: 'tech_repairs',
    subcategory: 'Phone Repairs',
    categoryName: 'Tech & Repairs',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Opposite Main Gate',
    shopName: 'GigaCharge Spot',
    latitude: 6.5825,
    longitude: 3.9830,
    hasDelivery: false,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348034567890',
    sellerSnapshot: {
      fullName: 'Ibrahim Musa',
      isVerified: false,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-9',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Used Textbook (Calculus & Engineering Math)',
    description:
      'Neatly used 100L/200L Calculus and Engineering Mathematics textbooks with zero torn pages.',
    quantity: 1,
    priceType: 'negotiable',
    price: 2500,
    priceUnit: 'total',
    categoryId: 'books',
    subcategory: 'Textbooks & Handouts',
    categoryName: 'Books & Academics',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Block B, Room 12',
    latitude: 6.5843,
    longitude: 3.9822,
    hasDelivery: false,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348023456789',
    sellerSnapshot: {
      fullName: 'Chidinma Okafor',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-10',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Anker 20000mAh Power Bank',
    description:
      'High-capacity 20000mAh power bank that holds up to 4 full phone charges during hostel power outages.',
    quantity: 4,
    priceType: 'fixed',
    price: 18500,
    priceUnit: 'total',
    categoryId: 'electronics',
    subcategory: 'Power Banks & Charging',
    categoryName: 'Electronics & Gadgets',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'LASUED Faculty Courtyard',
    shopName: 'Campus Gadgets NG',
    latitude: 6.5831,
    longitude: 3.9828,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348012345678',
    sellerSnapshot: {
      fullName: 'Tunde Adeyemi',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-11',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Stainless Steel Electric Kettle (1.8L)',
    description:
      'Fast-boil stainless steel electric kettle with auto shut-off. Works perfectly for hostel tea and noodles.',
    quantity: 3,
    priceType: 'fixed',
    price: 12500,
    priceUnit: 'total',
    categoryId: 'hostel',
    subcategory: 'Cooking Utensils',
    categoryName: 'Hostel Essentials',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Odo-Egiri Hostel Road',
    latitude: 6.5852,
    longitude: 3.9815,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348056789012',
    sellerSnapshot: {
      fullName: 'Seyi Ogunleye',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-12',
    sellerId: 'test_seller',
    adType: 'service',
    serviceLocation: 'mobile',
    title: 'Screen Replacement & Phone Repair',
    description:
      'Same-day mobile pickup & hostel-call screen replacement for iPhone, Samsung, Tecno, and Infinix devices around Epe.',
    priceType: 'contact',
    categoryId: 'tech_repairs',
    subcategory: 'Phone Repairs',
    categoryName: 'Tech & Repairs',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'LASU Epe Campus Gate',
    shopName: 'Epe FixHub',
    latitude: 6.5820,
    longitude: 3.9840,
    hasDelivery: false,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348034567890',
    sellerSnapshot: {
      fullName: 'Ibrahim Musa',
      isVerified: false,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-13',
    sellerId: 'test_seller',
    adType: 'item',
    title: 'Navy Canvas School Backpack',
    description:
      'Water-resistant campus backpack with padded 15.6-inch laptop compartment and leather buckle trim.',
    quantity: 6,
    priceType: 'negotiable',
    price: 9500,
    priceUnit: 'total',
    categoryId: 'fashion',
    subcategory: 'Bags & Backpacks',
    categoryName: 'Fashion & Clothing',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Papa / Epe Bus Stop',
    latitude: 6.5812,
    longitude: 3.9860,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348045678901',
    sellerSnapshot: {
      fullName: 'Aisha Lawal',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-14',
    sellerId: 'test_seller',
    adType: 'service',
    serviceLocation: 'shop',
    title: 'Project Printing & Spiral Binding',
    description:
      'Clean laser printing, formatting, and hard/spiral binding for final-year projects and seminar papers.',
    priceType: 'contact',
    categoryId: 'cyber',
    subcategory: 'Printing & Binding',
    categoryName: 'Cyber & Printing',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Shop 9, Student Union Arcade',
    shopName: 'Apex Print Cafe',
    latitude: 6.5834,
    longitude: 3.9833,
    hasDelivery: false,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348078901234',
    sellerSnapshot: {
      fullName: 'Femi Balogun',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-product-15',
    sellerId: 'test_seller',
    adType: 'item',
    title: '100L & 200L Past Questions Compendium',
    description:
      'Printed and spiral-bound past exam questions with worked solutions for GST, EDU, and CSC courses.',
    quantity: 14,
    priceType: 'fixed',
    price: 1200,
    priceUnit: 'per_item',
    categoryId: 'books',
    subcategory: 'Past Questions',
    categoryName: 'Books & Academics',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    locationName: 'Main Library Walkway',
    latitude: 6.5838,
    longitude: 3.9827,
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    whatsappNumber: '2348023456789',
    sellerSnapshot: {
      fullName: 'Chidinma Okafor',
      isVerified: true,
    },
    status: 'active',
    isApproved: true,
    isActive: true,
  },
];

export const SEED_SERVICES = [
  {
    id: 'seed-service-1',
    providerId: 'test_provider',
    title: 'CHM 101 & MTH 102 Peer Tutoring',
    description:
      'Small-group and one-on-one exam prep sessions around Epe campus with worked past questions.',
    categoryId: 'academics',
    subcategory: 'Private Tutoring',
    priceType: 'fixed' as const,
    price: 2000,
    priceUnit: 'per_hour' as const,
    priceRange: '₦2,000 - ₦5,000 / session',
    whatsappNumber: '2348023456789',
    locationName: 'LASUED Library Courtyard',
    hasDelivery: false,
    viewCount: 0,
    contactCount: 0,
    images: ['/src/assets/images/product_used_textbook_1795124920368.jpg'],
    status: 'active' as const,
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-service-2',
    providerId: 'test_provider',
    title: 'Express Student Laundry & Ironing',
    description:
      'Same-day wash, dry, fold, and steam press with pickup and drop-off at hostels around Epe.',
    categoryId: 'everyday',
    subcategory: 'Laundry & Ironing',
    priceType: 'fixed' as const,
    price: 1500,
    priceUnit: 'per_item' as const,
    priceRange: '₦1,500 - ₦4,000 / basket',
    whatsappNumber: '2348056789012',
    locationName: 'Odo-Egiri Road, Epe',
    hasDelivery: true,
    viewCount: 0,
    contactCount: 0,
    images: ['/src/assets/images/product_campus_sneakers_1795127979631.jpg'],
    status: 'active' as const,
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-service-3',
    providerId: 'test_provider',
    title: 'Phone Screen & Laptop Software Repair',
    description:
      'Quick diagnostics, Windows/Office setup, and screen replacements for students on a budget.',
    categoryId: 'tech_repairs',
    subcategory: 'Phone Repairs',
    priceType: 'contact' as const,
    priceUnit: 'total' as const,
    priceRange: '₦3,000 - ₦18,000',
    whatsappNumber: '2348034567890',
    locationName: 'Opposite Main Gate',
    hasDelivery: false,
    viewCount: 0,
    contactCount: 0,
    images: ['/src/assets/images/product_screen_repair_1795124920283.jpg'],
    status: 'active' as const,
    isApproved: true,
    isActive: true,
  },
];

export const SEED_ACCOMMODATIONS = [
  {
    id: 'seed-accommodation-1',
    ownerId: 'test_owner',
    type: 'self_contain' as const,
    title: 'Self Contain at Epe',
    description:
      'Tiled self-contain apartment with private kitchen, wardrobe, running water, and a 5-minute walk to campus.',
    rentPrice: 250000,
    generalLocation: 'Epe, Near Campus Road',
    exactAddress: 'Plot 12, Odo-Egiri Close, Epe',
    amenities: ['Running Water', 'Tiled Floor', 'Security Gate', 'Private Kitchen'],
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    whatsappNumber: '2348056789012',
    isApproved: true,
    isActive: true,
    ownerSnapshot: {
      fullName: 'Alhaji Rasheed Bello',
      isVerified: true,
    },
  },
  {
    id: 'seed-accommodation-2',
    ownerId: 'test_owner',
    type: 'single_room' as const,
    title: 'Single Room near LASUED Gate',
    description:
      'Quiet, fenced compound ideal for serious students. Shared borehole and prepaid meter included.',
    rentPrice: 120000,
    generalLocation: 'Near LASUED Gate',
    exactAddress: 'House 4, Main Gate Junction, Epe',
    amenities: ['Prepaid Meter', 'Borehole', 'Fenced Compound'],
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    whatsappNumber: '2348012345678',
    isApproved: true,
    isActive: true,
    ownerSnapshot: {
      fullName: 'Mrs. Funke Adeola',
      isVerified: true,
    },
  },
  {
    id: 'seed-accommodation-3',
    ownerId: 'test_owner',
    type: 'shared_apartment' as const,
    title: '2-Bedroom Shared Flat (Solar Backup)',
    description:
      'Spacious 2-bedroom flat with inverter backup for evening reading and reliable water supply.',
    rentPrice: 280000,
    generalLocation: 'Ita-Opo, Epe',
    exactAddress: 'Block C, Flat 2, Ita-Opo Estate, Epe',
    amenities: ['Solar / Inverter', 'Running Water', 'Wardrobe'],
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    whatsappNumber: '2348034567890',
    isApproved: true,
    isActive: true,
    ownerSnapshot: {
      fullName: 'Engr. Tunde Bakare',
      isVerified: false,
    },
  },
];

export const SEED_ROOMMATE_REQUESTS = [
  {
    id: 'seed-roommate-1',
    userId: 'test_roommate_1',
    type: 'need_roommate' as const,
    title: 'Looking for a female roommate to share a 2-bedroom at Igbogbo',
    description:
      'Found a neat 2-bedroom flat close to shuttle drop-off at Igbogbo. Looking for a friendly female student to split annual rent and utility bills.',
    budget: 140000,
    generalLocation: 'Igbogbo, Epe',
    preferences: 'Female only, clean, quiet for reading, no smoking',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    whatsappNumber: '2348061234567',
    isApproved: true,
    isActive: true,
    userSnapshot: {
      fullName: 'Zainab Balogun',
      isVerified: true,
    },
  },
  {
    id: 'seed-roommate-2',
    userId: 'test_roommate_2',
    type: 'room_available' as const,
    title: '1 Space Available in Self-Contain Near LASUED Gate',
    description:
      'Spacious self-contain already furnished with fan, mattress, and borehole access. Walking distance to lecture halls.',
    budget: 110000,
    generalLocation: 'Near LASUED Gate',
    preferences: 'Male student, 200L or 300L, neat and respectful',
    images: [SEED_PLACEHOLDER_IMAGE_BASE64],
    whatsappNumber: '2348059876543',
    isApproved: true,
    isActive: true,
    userSnapshot: {
      fullName: 'Daniel Ojo',
      isVerified: true,
    },
  },
];
