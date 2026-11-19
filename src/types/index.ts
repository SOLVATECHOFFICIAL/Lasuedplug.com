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
  roles: UserRoles;
  isVerified: boolean;
  status: 'active' | 'suspended';
  createdAt: any;
  updatedAt: any;
}

export interface Product {
  id?: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  categoryId: string;
  images: string[];
  status: 'active' | 'sold' | 'unavailable';
  isApproved: boolean;
  isActive: boolean;
  createdAt: any;
}

export interface Service {
  id?: string;
  providerId: string;
  title: string;
  description: string;
  priceRange: string;
  categoryId: string;
  images: string[];
  isApproved: boolean;
  isActive: boolean;
  createdAt: any;
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
