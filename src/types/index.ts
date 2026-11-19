export interface UserRoles {
  buyer?: boolean;
  seller?: boolean;
  serviceProvider?: boolean;
  landlord?: boolean;
  roommateSeeker?: boolean;
  admin?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  department?: string;
  level?: string;
  campus?: string;
  lastPhoneUpdate?: any;
  roles: UserRoles;
  isVerified: boolean;
  status: 'active' | 'suspended';
  createdAt: any;
  updatedAt: any;
}

export type PriceType = 'fixed' | 'negotiable' | 'contact';
export type PriceUnit = 'total' | 'per_day' | 'per_hour' | 'per_item';

export interface Product {
  id?: string;
  sellerId: string;
  title: string;
  description: string;
  categoryId: string;
  subcategory: string;
  categoryName?: string;
  images: string[];

  // Pricing Logic
  priceType: PriceType;
  price?: number;
  priceUnit?: PriceUnit;

  // Location & Contact Logic
  whatsappNumber: string;
  locationName?: string;
  location?: string;
  shopName?: string;
  googleMapLink?: string;
  hasDelivery: boolean;

  // Engagement Metrics
  viewCount: number;
  contactCount: number;

  status: 'active' | 'sold' | 'unavailable';
  isApproved: boolean;
  isActive: boolean;
  createdAt: any;
  sellerSnapshot?: { fullName: string; isVerified: boolean };
}

export interface Service {
  id?: string;
  providerId: string;
  title: string;
  description: string;
  categoryId: string;
  subcategory: string;
  images: string[];

  // Pricing Logic
  priceType: PriceType;
  price?: number;
  priceUnit?: PriceUnit;
  priceRange?: string;

  // Location & Contact Logic
  whatsappNumber: string;
  locationName?: string;
  shopName?: string;
  googleMapLink?: string;
  hasDelivery: boolean;

  // Engagement Metrics
  viewCount: number;
  contactCount: number;

  status: 'active' | 'sold' | 'unavailable';
  isApproved: boolean;
  isActive: boolean;
  createdAt: any;
  sellerSnapshot?: { fullName: string; isVerified: boolean };
}

export interface Accommodation {
  id?: string;
  ownerId: string;
  type: string;
  title: string;
  description: string;
  price: number;
  location: string;
  amenities: string[];
  images: string[];
  isApproved: boolean;
  isActive: boolean;
  createdAt: any;
}

export interface Report {
  id?: string;
  reporterId: string;
  targetId: string;
  targetType: 'product' | 'service' | 'accommodation' | 'user';
  reason: string;
  status: 'open' | 'resolved';
  createdAt: any;
}
