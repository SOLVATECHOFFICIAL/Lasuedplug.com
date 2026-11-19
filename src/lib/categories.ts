export interface MasterCategory {
  id: string;
  name: string;
  subs: readonly string[];
}

export const MASTER_CATEGORIES: readonly MasterCategory[] = [
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
    id: 'tech_repairs',
    name: 'Tech & Repairs',
    subs: [
      'Phone Repairs',
      'Phone Flashing & Unlocking',
      'Laptop Repairs',
      'Appliance Repairs',
      'Phone Charging Services',
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty & Grooming',
    subs: ['Hair Styling', 'Barbing', 'Makeup & Gele', 'Nails & Pedicure'],
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
      'Borrow/Lend',
    ],
  },
  {
    id: 'academics',
    name: 'Academic & Skills',
    subs: ['Private Tutoring', 'Project Help', 'Skill Acquisition'],
  },
  {
    id: 'accommodation',
    name: 'Accommodation',
    subs: ['Single Rooms', 'Self-Contain', 'Shared Apartments', 'Roommate Finder'],
  },
];

export function getCategoryById(categoryId?: string): MasterCategory | undefined {
  if (!categoryId) return undefined;
  return MASTER_CATEGORIES.find((cat) => cat.id === categoryId);
}

export function getCategoryName(categoryId?: string): string {
  return getCategoryById(categoryId)?.name || categoryId || '';
}

export function getSubcategoriesForCategory(categoryId?: string): readonly string[] {
  return getCategoryById(categoryId)?.subs || [];
}
