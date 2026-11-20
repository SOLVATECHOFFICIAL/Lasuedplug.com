import {
  Accommodation,
  Product,
  Report,
  RoommateRequest,
  Store,
  UserProfile,
} from '../types';
import { getTimestampMillis } from './homeHelpers';
import { isServiceAd } from './sellerHelpers';

export type AdminModuleType =
  | 'item'
  | 'service'
  | 'room'
  | 'roommate'
  | 'store';

export type AdminCollectionName =
  | 'products'
  | 'accommodations'
  | 'roommate_requests'
  | 'stores';

export interface PendingAdminItem {
  id: string;
  _type: AdminModuleType;
  collectionName: AdminCollectionName;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  priceOrSubtitle: string;
  locationLabel: string;
  thumbnail?: string;
  createdAt: unknown;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalListings: number;
  pendingApprovals: number;
  openReports: number;
}

export function isUserAdmin(
  profile?: Partial<Pick<UserProfile, 'roles'>> | null,
  hasAdminClaim = false
): boolean {
  return Boolean(hasAdminClaim || profile?.roles?.admin === true);
}

export function getAdminModuleLabel(
  type: AdminModuleType
): 'Item' | 'Service' | 'Room' | 'Roommate' | 'Store' {
  switch (type) {
    case 'item':
      return 'Item';
    case 'service':
      return 'Service';
    case 'room':
      return 'Room';
    case 'roommate':
      return 'Roommate';
    case 'store':
      return 'Store';
  }
}

export function formatPendingAmount(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

export function mapProductToPendingAdminItem(product: Product): PendingAdminItem {
  const isService = isServiceAd(product);
  let priceText = 'Contact for price';
  if (!isService && typeof product.price === 'number' && product.price > 0) {
    priceText = formatPendingAmount(product.price);
  }
  return {
    id: product.id || '',
    _type: isService ? 'service' : 'item',
    collectionName: 'products',
    ownerId: product.sellerId,
    ownerName: product.sellerSnapshot?.fullName || 'LASUEDPLUG Seller',
    title: product.title,
    description: product.description,
    priceOrSubtitle: priceText,
    locationLabel: product.locationName || product.landmark || 'Campus Area',
    thumbnail: product.images?.[0],
    createdAt: product.createdAt,
  };
}

export function mapAccommodationToPendingAdminItem(
  acc: Accommodation
): PendingAdminItem {
  return {
    id: acc.id || '',
    _type: 'room',
    collectionName: 'accommodations',
    ownerId: acc.ownerId,
    ownerName: acc.ownerSnapshot?.fullName || 'LASUEDPLUG Landlord',
    title: acc.title,
    description: acc.description,
    priceOrSubtitle: `${formatPendingAmount(acc.rentPrice || 0)} / yr`,
    locationLabel: acc.generalLocation || 'Epe Campus Area',
    thumbnail: acc.images?.[0],
    createdAt: acc.createdAt,
  };
}

export function mapRoommateToPendingAdminItem(
  req: RoommateRequest
): PendingAdminItem {
  return {
    id: req.id || '',
    _type: 'roommate',
    collectionName: 'roommate_requests',
    ownerId: req.userId,
    ownerName: req.userSnapshot?.fullName || 'LASUEDPLUG Student',
    title: req.title,
    description: req.description,
    priceOrSubtitle:
      typeof req.budget === 'number' && req.budget > 0
        ? `Budget: ${formatPendingAmount(req.budget)} / yr`
        : req.preferences || 'Roommate Request',
    locationLabel: req.generalLocation || 'Epe Campus Area',
    thumbnail: req.images?.[0],
    createdAt: req.createdAt,
  };
}

export function mapStoreToPendingAdminItem(store: Store): PendingAdminItem {
  return {
    id: store.id || '',
    _type: 'store',
    collectionName: 'stores',
    ownerId: store.ownerId,
    ownerName: store.ownerSnapshot?.fullName || 'LASUEDPLUG Store Owner',
    title: store.name,
    description: store.description,
    priceOrSubtitle: store.category || 'Campus Store',
    locationLabel: store.locationName || 'Epe Campus Area',
    thumbnail: store.logoUrl,
    createdAt: store.createdAt,
  };
}

export function sortPendingAdminItems(
  items: PendingAdminItem[]
): PendingAdminItem[] {
  return [...items].sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
  );
}

export function filterPendingAdminItems(
  items: PendingAdminItem[],
  filter: 'all' | AdminModuleType
): PendingAdminItem[] {
  if (filter === 'all') {
    return items;
  }
  return items.filter((item) => item._type === filter);
}

export function filterAdminUsers(
  users: UserProfile[],
  rawQuery: string
): UserProfile[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return users;
  }
  return users.filter(
    (user) =>
      (user.fullName || '').toLowerCase().includes(q) ||
      (user.email || '').toLowerCase().includes(q) ||
      (user.department || '').toLowerCase().includes(q)
  );
}

export function getAdminReportTargetCollection(
  targetType: Report['targetType']
):
  | 'products'
  | 'services'
  | 'accommodations'
  | 'roommate_requests'
  | 'stores'
  | null {
  switch (targetType) {
    case 'product':
      return 'products';
    case 'service':
      return 'services';
    case 'accommodation':
      return 'accommodations';
    case 'roommate_request':
      return 'roommate_requests';
    case 'store':
      return 'stores';
    case 'user':
    default:
      return null;
  }
}

export function getPrimaryUserRoleBadge(user: Pick<UserProfile, 'roles'>): string {
  if (user.roles?.admin) return 'Admin';
  if (user.roles?.landlord) return 'Landlord';
  if (user.roles?.serviceProvider) return 'Service Provider';
  if (user.roles?.seller) return 'Seller';
  if (user.roles?.roommateSeeker) return 'Roommate Seeker';
  return 'Student';
}
