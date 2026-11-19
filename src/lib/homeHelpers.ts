import { MASTER_CATEGORIES } from './categories';
import { PriceType, PriceUnit } from '../types';

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

export const SEED_CATEGORIES = MASTER_CATEGORIES.map((category) => ({
  id: category.id,
  name: category.name,
  slug: category.id,
  subs: [...category.subs],
}));

export interface SeedProductRecord {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  categoryId: string;
  subcategory: string;
  categoryName: string;
  images: string[];
  priceType: PriceType;
  price?: number;
  priceUnit?: PriceUnit;
  whatsappNumber: string;
  locationName?: string;
  shopName?: string;
  googleMapLink?: string;
  hasDelivery: boolean;
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
    title: 'Butter',
    description:
      'Fresh salted table butter spread (250g tub), kept cool and ready for breakfast bread, toast, or baking around hostel.',
    priceType: 'fixed',
    price: 1800,
    priceUnit: 'per_item',
    categoryId: 'food',
    subcategory: 'Raw Foodstuff',
    categoryName: 'Food & Groceries',
    images: ['/src/assets/images/product_small_chops_1795127980147.jpg'],
    locationName: 'Sub-Gate Food Pavilion',
    shopName: "Mama Kelechi's Shop",
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
    title: 'Akara and Bread',
    description:
      'Hot morning akara fried fresh at 7 AM paired with soft Agege bread. Great campus breakfast before early lectures.',
    priceType: 'fixed',
    price: 700,
    priceUnit: 'per_item',
    categoryId: 'food',
    subcategory: 'Cooked Meals',
    categoryName: 'Food & Groceries',
    images: ['/src/assets/images/product_small_chops_1795127980147.jpg'],
    locationName: 'LASUED Main Gate',
    shopName: 'Iya Yusuf Breakfast Spot',
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
    title: 'Puff Puff',
    description:
      'Golden, fluffy Nigerian puff-puff packed warm with optional pepper sauce. Bulk hostel boxes also available.',
    priceType: 'fixed',
    price: 500,
    priceUnit: 'per_item',
    categoryId: 'food',
    subcategory: 'Small Chops & Snacks (Buns, Meatpie, Bread & Egg)',
    categoryName: 'Food & Groceries',
    images: ['/src/assets/images/product_small_chops_1795127980147.jpg'],
    locationName: 'Sub-Gate Food Pavilion',
    shopName: "Mama Kelechi's Shop",
    googleMapLink: 'https://maps.google.com/?q=6.4360,3.9870',
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
    title: 'Egg and Tea',
    description:
      'Hot spiced tea with fried egg and toasted bread served fresh for breakfast or late-night reading fuel.',
    priceType: 'fixed',
    price: 1000,
    priceUnit: 'per_item',
    categoryId: 'food',
    subcategory: 'Cooked Meals',
    categoryName: 'Food & Groceries',
    images: ['/src/assets/images/product_electric_kettle_1795127980017.jpg'],
    locationName: 'Block A Hostel Walkway',
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
    title: 'HP Laptop',
    description:
      'Clean UK-used HP Pavilion 14 Core i5 laptop with 8GB RAM, 256GB SSD, strong battery life, and original charger included.',
    priceType: 'fixed',
    price: 45000,
    priceUnit: 'total',
    categoryId: 'electronics',
    subcategory: 'Laptops & Computers',
    categoryName: 'Electronics & Gadgets',
    images: ['/src/assets/images/product_hp_laptop_1795124919610.jpg'],
    locationName: 'Shop 4, LASUED Gate',
    shopName: 'TechHub Campus Store',
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
    title: 'Phone Charger',
    description:
      'Fast 20W USB-C & Lightning phone charger with braided cable compatible with iPhone, Samsung, Tecno, and Infinix.',
    priceType: 'fixed',
    price: 3500,
    priceUnit: 'per_item',
    categoryId: 'electronics',
    subcategory: 'Phone Accessories',
    categoryName: 'Electronics & Gadgets',
    images: ['/src/assets/images/product_power_bank_1795127980570.jpg'],
    locationName: 'LASUED Faculty Courtyard',
    shopName: 'Campus Gadgets NG',
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
    title: 'Nike Sneakers',
    description:
      'Clean white EU 42 Nike low-top sneakers in great condition. Comfortable for daily lectures and campus walks.',
    priceType: 'negotiable',
    price: 22000,
    priceUnit: 'total',
    categoryId: 'fashion',
    subcategory: 'Shoes & Sneakers',
    categoryName: 'Fashion & Clothing',
    images: ['/src/assets/images/product_campus_sneakers_1795127979631.jpg'],
    locationName: 'Epe Market Junction',
    shopName: 'Campus Drip Closet',
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
    title: 'Phone Charging Services',
    description:
      'Reliable solar and inverter phone charging station right opposite the main gate. Safe lockers and fast charging all day.',
    priceType: 'contact',
    priceUnit: 'per_day',
    categoryId: 'tech_repairs',
    subcategory: 'Phone Charging Services',
    categoryName: 'Tech & Repairs',
    images: ['/src/assets/images/product_screen_repair_1795124920283.jpg'],
    locationName: 'Opposite Main Gate',
    shopName: 'GigaCharge Spot',
    googleMapLink: 'https://maps.google.com/?q=6.4352,3.9865',
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
    title: 'Used Textbook (Calculus & Engineering Math)',
    description:
      'Neatly used 100L/200L Calculus and Engineering Mathematics textbooks with zero torn pages.',
    priceType: 'negotiable',
    price: 2500,
    priceUnit: 'total',
    categoryId: 'books',
    subcategory: 'Textbooks & Handouts',
    categoryName: 'Books & Academics',
    images: ['/src/assets/images/product_used_textbook_1795124920368.jpg'],
    locationName: 'Block B, Room 12',
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
    title: 'Anker 20000mAh Power Bank',
    description:
      'High-capacity 20000mAh power bank that holds up to 4 full phone charges during hostel power outages.',
    priceType: 'fixed',
    price: 18500,
    priceUnit: 'total',
    categoryId: 'electronics',
    subcategory: 'Power Banks & Charging',
    categoryName: 'Electronics & Gadgets',
    images: ['/src/assets/images/product_power_bank_1795127980570.jpg'],
    locationName: 'LASUED Faculty Courtyard',
    shopName: 'Campus Gadgets NG',
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
    title: 'Stainless Steel Electric Kettle (1.8L)',
    description:
      'Fast-boil stainless steel electric kettle with auto shut-off. Works perfectly for hostel tea and noodles.',
    priceType: 'fixed',
    price: 12500,
    priceUnit: 'total',
    categoryId: 'hostel',
    subcategory: 'Cooking Utensils',
    categoryName: 'Hostel Essentials',
    images: ['/src/assets/images/product_electric_kettle_1795127980017.jpg'],
    locationName: 'Odo-Egiri Hostel Road',
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
    title: 'Screen Replacement & Phone Repair',
    description:
      'Same-day screen replacement for iPhone, Samsung, Tecno, and Infinix devices around Epe.',
    priceType: 'fixed',
    price: 8000,
    priceUnit: 'per_item',
    categoryId: 'tech_repairs',
    subcategory: 'Phone Repairs',
    categoryName: 'Tech & Repairs',
    images: ['/src/assets/images/product_screen_repair_1795124920283.jpg'],
    locationName: 'LASU Epe Campus Gate',
    shopName: 'Epe FixHub',
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
    title: 'Navy Canvas School Backpack',
    description:
      'Water-resistant campus backpack with padded 15.6-inch laptop compartment and leather buckle trim.',
    priceType: 'negotiable',
    price: 9500,
    priceUnit: 'total',
    categoryId: 'fashion',
    subcategory: 'Bags & Backpacks',
    categoryName: 'Fashion & Clothing',
    images: ['/src/assets/images/product_campus_sneakers_1795127979631.jpg'],
    locationName: 'Papa / Epe Bus Stop',
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
    title: 'Project Printing & Spiral Binding',
    description:
      'Clean laser printing, formatting, and hard/spiral binding for final-year projects and seminar papers.',
    priceType: 'fixed',
    price: 3500,
    priceUnit: 'per_item',
    categoryId: 'cyber',
    subcategory: 'Printing & Binding',
    categoryName: 'Cyber & Printing',
    images: ['/src/assets/images/product_used_textbook_1795124920368.jpg'],
    locationName: 'Shop 9, Student Union Arcade',
    shopName: 'Apex Print Cafe',
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
    title: '100L & 200L Past Questions Compendium',
    description:
      'Printed and spiral-bound past exam questions with worked solutions for GST, EDU, and CSC courses.',
    priceType: 'fixed',
    price: 1200,
    priceUnit: 'per_item',
    categoryId: 'books',
    subcategory: 'Past Questions',
    categoryName: 'Books & Academics',
    images: ['/src/assets/images/product_used_textbook_1795124920368.jpg'],
    locationName: 'Main Library Walkway',
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
    type: 'Self-Contain',
    title: 'Modern Self-Contain Near LASUED Gate',
    description:
      'Tiled studio apartment with private kitchen, wardrobe, running water, and 5-minute walk to campus.',
    price: 180000,
    location: 'Odo-Egiri Road, Epe',
    amenities: ['Running Water', 'Tiled Floor', 'Security Gate'],
    images: ['/src/assets/images/product_electric_kettle_1795127980017.jpg'],
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-accommodation-2',
    ownerId: 'test_owner',
    type: 'Single Room',
    title: 'Clean Single Room Student Lodge',
    description:
      'Quiet, fenced compound ideal for serious students. Shared borehole and prepaid meter included.',
    price: 95000,
    location: 'Papa / Epe Express',
    amenities: ['Prepaid Meter', 'Borehole', 'Fenced Compound'],
    images: ['/src/assets/images/product_electric_kettle_1795127980017.jpg'],
    isApproved: true,
    isActive: true,
  },
  {
    id: 'seed-accommodation-3',
    ownerId: 'test_owner',
    type: 'Shared Flat',
    title: '2-Bedroom Shared Flat (Solar Backup)',
    description:
      'Spacious 2-bedroom flat with inverter backup for evening reading and reliable water supply.',
    price: 250000,
    location: 'Ita-Opo, Epe',
    amenities: ['Solar Backup', '2 Bathrooms', 'Balcony'],
    images: ['/src/assets/images/product_electric_kettle_1795127980017.jpg'],
    isApproved: true,
    isActive: true,
  },
];
