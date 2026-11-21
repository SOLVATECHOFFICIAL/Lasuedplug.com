export interface MasterCategory {
  id: string;
  name: string;
  subs: readonly string[];
}

export const PRODUCT_CATEGORIES: readonly MasterCategory[] = [
  {
    id: 'electronics',
    name: 'Electronics & Gadgets',
    subs: [
      'Phones & Tablets',
      'Laptops & Computers',
      'Phone Accessories',
      'Gaming & Console Rentals',
      'Power Banks & Charging',
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion & Clothing',
    subs: [
      'Shoes & Sneakers',
      'Bags & Backpacks',
      'Thrift Clothes (Okrika)',
      'Native & Corporate Wear',
      'Jewelry & Watches',
    ],
  },
  {
    id: 'books',
    name: 'Books & Academics',
    subs: ['Textbooks & Handouts', 'Past Questions', 'Stationery'],
  },
  {
    id: 'hostel',
    name: 'Hostel Essentials',
    subs: ['Bedding', 'Cooking Utensils', 'Furniture', 'Hostel Decor & Painting'],
  },
  {
    id: 'food',
    name: 'Food & Groceries',
    subs: [
      'Small Chops & Snacks (Buns, Meatpie, Bread & Egg)',
      'Cooked Meals',
      'Fast Food & Smoothies',
      'Raw Foodstuff',
      'Drinks & Beverages',
      'Water Delivery',
    ],
  },
];

export const SERVICE_CATEGORIES: readonly MasterCategory[] = [
  {
    id: 'tech_repairs',
    name: 'Tech & Repairs',
    subs: [
      'Phone Repairs',
      'Phone Flashing & Unlocking',
      'Laptop Repairs',
      'Appliance Repairs',
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty & Grooming',
    subs: ['Hair Styling', 'Barbing', 'Makeup & Gele', 'Nails & Pedicure'],
  },
  {
    id: 'cyber',
    name: 'Cyber & Printing',
    subs: [
      'Cyber Cafe (Typing)',
      'Photocopy & Lamination',
      'Printing & Binding',
      'Project Formatting',
    ],
  },
  {
    id: 'creative',
    name: 'Creative & Professional',
    subs: [
      'Graphic Design',
      'Web Design',
      'Photography',
      'Event Rentals',
      'Event Tickets',
    ],
  },
  {
    id: 'everyday',
    name: 'Everyday Services',
    subs: [
      'Laundry & Ironing',
      'Tailoring',
      'POS & Cash Out',
      'Delivery & Errands',
      'Bike/Keke/Car Hire',
      'VTU (Data/Airtime)',
    ],
  },
  {
    id: 'academics',
    name: 'Academic & Skills',
    subs: ['Private Tutoring', 'Project Help', 'Skill Acquisition'],
  },
];

export const ALL_MARKETPLACE_CATEGORIES: readonly MasterCategory[] = [
  ...PRODUCT_CATEGORIES,
  ...SERVICE_CATEGORIES,
];

export function getCategoriesForAdType(
  adType: 'item' | 'service'
): readonly MasterCategory[] {
  return adType === 'service' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;
}

export function getCategoryById(categoryId?: string): MasterCategory | undefined {
  if (!categoryId) return undefined;
  return ALL_MARKETPLACE_CATEGORIES.find((cat) => cat.id === categoryId);
}

export function getCategoryName(categoryId?: string): string {
  return getCategoryById(categoryId)?.name || categoryId || '';
}

export const STORE_GENERAL_SUBCATEGORIES: readonly string[] = [
  'Provisions & Everyday Needs',
  'Electronics & Phone Accessories',
  'Fashion & Thrift',
  'Food, Snacks & Drinks',
  'Books & Stationery',
  'Multi-Category Campus Shop',
];

export function getSubcategoriesForCategory(categoryId?: string): readonly string[] {
  return getCategoryById(categoryId)?.subs || [];
}

export function getStoreSubcategoriesForCategory(
  categoryName?: string
): readonly string[] {
  const clean = (categoryName || '').trim();
  if (!clean) return [];
  if (clean === 'General Campus Store') {
    return STORE_GENERAL_SUBCATEGORIES;
  }
  const matched = ALL_MARKETPLACE_CATEGORIES.find(
    (cat) => cat.name === clean || cat.id === clean
  );
  return matched?.subs || STORE_GENERAL_SUBCATEGORIES;
}
