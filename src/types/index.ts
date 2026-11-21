export interface UserRoles {
  buyer?: boolean;
  seller?: boolean;
  serviceProvider?: boolean;
  landlord?: boolean;
  roommateSeeker?: boolean;
  admin?: boolean;
}

export type AccountType = 'student' | 'business';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  accountType: AccountType;
  businessName?: string;
  openingHours?: string;
  isOnlineOnly?: boolean;
  trustScore: number;
  reviewCount: number;
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
  isBanned?: boolean;
  createdAt: any;
  updatedAt: any;
}

export type PriceType = 'fixed' | 'negotiable' | 'contact';
export type PriceUnit = 'total' | 'per_day' | 'per_hour' | 'per_item';
export type AdType = 'item' | 'service';
export type ServiceLocation = 'shop' | 'mobile' | 'online';

export interface Product {
  id?: string;
  sellerId: string;
  adType: AdType;

  // Store link (Optional)
  storeId?: string;
  storeName?: string;

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

  // Item specific
  quantity?: number;

  // Service specific
  serviceLocation?: ServiceLocation;

  // Location & Contact
  whatsappNumber: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;

  // Legacy compatibility fields for existing Firestore documents
  listingType?: 'product' | 'service';
  locationType?: 'physical' | 'online';
  landmark?: string;
  location?: string;
  shopName?: string;
  hasDelivery?: boolean;

  status: 'active' | 'sold' | 'unavailable';
  isApproved: boolean;
  isActive: boolean;
  needsAiReview?: boolean;
  createdAt: any;
  viewCount?: number;
  contactCount?: number;
  sellerSnapshot?: { fullName: string; isVerified: boolean };
}

export interface Store {
  id?: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string;
  openingHours?: string;
  whatsappNumber: string;
  locationName: string;
  latitude?: number;
  longitude?: number;
  trustScore?: number;
  reviewCount?: number;
  isApproved: boolean;
  isActive: boolean;
  createdAt: any;
  ownerSnapshot?: { fullName: string; isVerified: boolean };
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
  landmark?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  shopName?: string;
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

export type AccommodationType =
  | 'single_room'
  | 'self_contain'
  | 'shared_apartment'
  | 'short_let';

export interface Accommodation {
  id?: string;
  ownerId: string;
  type: AccommodationType | string;
  title: string;
  description: string;
  rentPrice: number;
  generalLocation: string;
  exactAddress?: string;
  amenities: string[];
  images: string[];
  whatsappNumber: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: any;
  ownerSnapshot?: { fullName: string; isVerified: boolean };
  // Optional legacy compatibility fields
  price?: number;
  location?: string;
}

export type RoommateRequestType = 'need_roommate' | 'room_available';

export interface RoommateRequest {
  id?: string;
  userId: string;
  type: RoommateRequestType;
  title: string;
  description: string;
  budget?: number;
  generalLocation: string;
  preferences: string;
  images: string[];
  whatsappNumber: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: any;
  userSnapshot?: { fullName: string; isVerified: boolean };
}

export interface Review {
  id?: string;
  targetId: string;
  targetType: 'user' | 'store';
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export interface Report {
  id?: string;
  reporterId: string;
  targetId: string;
  targetType:
    | 'product'
    | 'service'
    | 'accommodation'
    | 'roommate_request'
    | 'store'
    | 'user';
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: any;
}

export interface Favorite {
  id?: string;
  userId: string;
  listingId: string;
  listingType: 'item' | 'service' | 'product';
  createdAt: any;
}

export interface Enquiry {
  id?: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  listingTitle: string;
  createdAt: any;
}

export type NotificationType =
  | 'listing_approved'
  | 'listing_rejected'
  | 'enquiry_received'
  | 'system';

export interface AppNotification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  link?: string;
  createdAt: any;
}

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface VerificationRequest {
  id?: string;
  userId: string;
  fullName: string;
  idCardImage: string;
  status: VerificationStatus;
  createdAt: any;
  reviewedAt?: any;
}
