import { AccountType, UserProfile, UserRoles } from '../types';
import { isValidGpsCoordinates } from './listingValidation';

export function buildNewUserProfile(params: {
  uid: string;
  email: string;
  fullName?: string;
  accountType?: AccountType;
  timestamp: unknown;
}): UserProfile {
  return {
    uid: params.uid,
    email: params.email.trim().toLowerCase(),
    fullName: params.fullName?.trim() || '',
    accountType: params.accountType === 'business' ? 'business' : 'student',
    trustScore: 0,
    reviewCount: 0,
    roles: {
      buyer: true,
    },
    isVerified: false,
    emailVerified: false,
    status: 'active',
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  };
}

export const SUSPENDED_ACCOUNT_MESSAGE =
  'Your account has been suspended. Contact Support on WhatsApp.';
export const BANNED_ACCOUNT_MESSAGE =
  'This account has been permanently banned and cannot sign up again.';

export function isAccountSuspended(
  profile?: Partial<Pick<UserProfile, 'status' | 'isBanned'>> | null
): boolean {
  if (!profile) {
    return false;
  }
  return profile.status === 'suspended' || profile.isBanned === true;
}

export function isAccountBanned(
  profile?: Partial<Pick<UserProfile, 'isBanned'>> | null
): boolean {
  return profile?.isBanned === true;
}

export function getProtectedRouteDecision(state: {
  loading: boolean;
  isAuthenticated: boolean;
  isSuspended?: boolean;
  isEmailVerified?: boolean;
  requireEmailVerified?: boolean;
}): 'loading' | 'redirect' | 'verify-email' | 'allow' {
  if (state.loading) {
    return 'loading';
  }
  if (!state.isAuthenticated || state.isSuspended) {
    return 'redirect';
  }
  if (state.requireEmailVerified && !state.isEmailVerified) {
    return 'verify-email';
  }
  return 'allow';
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export interface SignupFormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function validateSignupForm(values: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): SignupFormErrors {
  const errors: SignupFormErrors = {};

  if (!values.fullName.trim()) {
    errors.fullName = 'Full name is required.';
  } else if (values.fullName.trim().length < 2) {
    errors.fullName = 'Please enter your full name.';
  }

  if (!values.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (values.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

export function validateLoginForm(values: {
  email: string;
  password: string;
}): LoginFormErrors {
  const errors: LoginFormErrors = {};

  if (!values.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

export function validateEmailField(email: string): string | undefined {
  if (!email.trim()) {
    return 'Email address is required.';
  }
  if (!isValidEmail(email)) {
    return 'Please enter a valid email address.';
  }
  return undefined;
}

export function getInitials(fullName?: string | null, email?: string | null): string {
  const name = (fullName || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const cleanEmail = (email || '').trim();
  if (cleanEmail) {
    return cleanEmail[0].toUpperCase();
  }
  return 'U';
}

export interface AccountTypeResolvable {
  accountType?: AccountType | string | null;
  roles?: UserRoles | null;
  businessName?: string | null;
  shopAddress?: string | null;
  isOnlineOnly?: boolean | null;
}

export function isMarketerProfile(
  entity?: AccountTypeResolvable | null
): boolean {
  if (!entity) return false;
  const rawType =
    typeof entity.accountType === 'string'
      ? entity.accountType.trim().toLowerCase()
      : '';
  if (rawType === 'business' || rawType === 'marketer') {
    return true;
  }
  if (rawType === 'student') {
    // Respect explicit student only when there is no legacy marketer flag/business footprint
    if (
      entity.roles?.landlord === true ||
      Boolean(entity.businessName && entity.businessName.trim()) ||
      Boolean(entity.shopAddress && entity.shopAddress.trim()) ||
      typeof entity.isOnlineOnly === 'boolean'
    ) {
      return true;
    }
    return false;
  }
  return Boolean(
    entity.roles?.landlord === true ||
      (entity.businessName && entity.businessName.trim()) ||
      (entity.shopAddress && entity.shopAddress.trim()) ||
      typeof entity.isOnlineOnly === 'boolean'
  );
}

export function resolveAccountType(
  entity?: AccountTypeResolvable | null
): AccountType {
  return isMarketerProfile(entity) ? 'business' : 'student';
}

export function getAccountTypeLabel(
  accountType?: AccountType | string | null
): 'Marketer' | 'Student' {
  const normalized =
    typeof accountType === 'string' ? accountType.trim().toLowerCase() : '';
  return normalized === 'business' || normalized === 'marketer'
    ? 'Marketer'
    : 'Student';
}

export function getPrimaryRoleLabel(
  roles?: UserRoles,
  accountType?: AccountType | string | null
): string {
  if (roles?.admin) return 'Admin';
  if (
    accountType &&
    getAccountTypeLabel(accountType) === 'Marketer'
  ) {
    return 'Marketer';
  }
  if (!roles) return 'Buyer';
  if (roles.seller) return 'Seller';
  if (roles.serviceProvider) return 'Service Provider';
  if (roles.landlord) return 'Marketer';
  if (roles.roommateSeeker) return 'Roommate Seeker';
  return 'Buyer';
}

export function formatFirebaseAuthError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '');
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return 'The email address is invalid.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'unavailable':
      case 'deadline-exceeded':
        return 'Could not reach the database right now. Please check your internet connection and try again.';
      default:
        break;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export const PHONE_UPDATE_COOLDOWN_DAYS = 7;
export const ACADEMIC_LOCK_MESSAGE =
  'Locked forever after saving. Contact Support to request a change.';
export const MARKETER_LOCK_MESSAGE =
  'Shop & brand details are locked forever after saving. Contact Support to request a change.';
export const ACCOUNT_TYPE_LOCK_MESSAGE =
  'Account type is chosen once at signup and locked forever. Contact Admin/Support if you need it changed.';
export const NAME_LOCK_MESSAGE =
  'Name cannot be changed. Contact Support to request a change.';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function to24HourTime(raw: string): string {
  const clean = raw.trim().toUpperCase();
  const twelveHour = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/.exec(clean);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const mins = Number(twelveHour[2] ?? '0');
    const period = twelveHour[3];
    if (hours < 1 || hours > 12 || mins < 0 || mins > 59) return '';
    if (period === 'AM') {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(clean);
  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    const mins = Number(twentyFour[2]);
    if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return '';
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  return '';
}

export function parseOpeningHoursRange(openingHours?: string | null): {
  start: string;
  end: string;
} {
  const raw = (openingHours || '').trim();
  if (!raw) return { start: '', end: '' };
  const parts = raw.split(/\s*(?:-|to|–|—)\s*/i);
  if (parts.length < 2) return { start: '', end: '' };
  const start = to24HourTime(parts[0]);
  const end = to24HourTime(parts[1]);
  if (!start || !end) return { start: '', end: '' };
  return { start, end };
}

export function checkProfileCompleteness(
  profile: Partial<UserProfile> | null | undefined
): boolean {
  if (!profile) {
    return false;
  }
  const hasName = Boolean(profile.fullName && profile.fullName.trim());
  const hasPhone = Boolean(profile.phone && profile.phone.trim());
  if (isMarketerProfile(profile)) {
    const hasBusinessName = Boolean(
      profile.businessName && profile.businessName.trim()
    );
    if (!hasName || !hasPhone || !hasBusinessName) {
      return false;
    }
    if (profile.isOnlineOnly === true) {
      return true;
    }
    const hasStructuredTimes = Boolean(
      profile.openingTimeStart &&
        profile.openingTimeStart.trim() &&
        profile.openingTimeEnd &&
        profile.openingTimeEnd.trim()
    );
    const hasHours =
      hasStructuredTimes ||
      Boolean(profile.openingHours && profile.openingHours.trim());
    const hasAddress = Boolean(
      profile.shopAddress && profile.shopAddress.trim()
    );
    const hasGps = isValidGpsCoordinates(profile.latitude, profile.longitude);
    return hasHours && hasAddress && hasGps;
  }
  const hasCampus = Boolean(profile.campus && profile.campus.trim());
  const hasDepartment = Boolean(profile.department && profile.department.trim());
  const hasLevel = Boolean(profile.level && profile.level.trim());

  return hasName && hasPhone && hasCampus && hasDepartment && hasLevel;
}

export function isFieldPermanentlyLocked(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  return String(value).trim().length > 0;
}

export function isAcademicFieldLocked(value: unknown): boolean {
  return isFieldPermanentlyLocked(value);
}

export function canSwitchAccountTypeOnProfile(
  _profile?: Partial<UserProfile> | null
): boolean {
  // Account type is selected once at signup and locked permanently unless changed by an Admin.
  return false;
}

export function areMarketerProfileFieldsLocked(
  profile: Partial<UserProfile> | null | undefined
): boolean {
  if (!profile || !isMarketerProfile(profile)) {
    return false;
  }
  return isFieldPermanentlyLocked(profile.businessName);
}

export function parseTimestampMs(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === 'object') {
    const maybeTs = value as { toMillis?: () => number; seconds?: number };
    if (typeof maybeTs.toMillis === 'function') {
      const ms = maybeTs.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof maybeTs.seconds === 'number' && Number.isFinite(maybeTs.seconds)) {
      return maybeTs.seconds * 1000;
    }
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export interface CooldownStatus {
  isLocked: boolean;
  remainingDays: number;
  nextAvailableDate: Date | null;
}

export function getFieldCooldownStatus(
  lastUpdated: unknown,
  cooldownDays: number,
  nowMs: number = Date.now()
): CooldownStatus {
  const lastMs = parseTimestampMs(lastUpdated);
  if (lastMs === null) {
    return {
      isLocked: false,
      remainingDays: 0,
      nextAvailableDate: null,
    };
  }

  const unlockMs = lastMs + cooldownDays * MS_PER_DAY;
  if (nowMs >= unlockMs) {
    return {
      isLocked: false,
      remainingDays: 0,
      nextAvailableDate: null,
    };
  }

  const remainingDays = Math.max(1, Math.ceil((unlockMs - nowMs) / MS_PER_DAY));
  return {
    isLocked: true,
    remainingDays,
    nextAvailableDate: new Date(unlockMs),
  };
}

export const PROFILE_PIC_COOLDOWN_DAYS = 7;

export function getUserAvatarUrl(
  profile?: Partial<Pick<UserProfile, 'profilePic' | 'avatarUrl'>> | null
): string {
  if (!profile) return '';
  const pic = typeof profile.profilePic === 'string' ? profile.profilePic.trim() : '';
  if (pic) return pic;
  const legacy = typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : '';
  return legacy;
}

export function formatCooldownDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export interface ProfilePicLockStatus extends CooldownStatus {
  lockMessage: string | null;
}

export function getProfilePicLockStatus(
  profilePicUpdatedAt: unknown,
  nowMs: number = Date.now()
): ProfilePicLockStatus {
  const status = getFieldCooldownStatus(
    profilePicUpdatedAt,
    PROFILE_PIC_COOLDOWN_DAYS,
    nowMs
  );
  if (!status.isLocked) {
    return {
      ...status,
      lockMessage: null,
    };
  }
  const formattedDate =
    formatCooldownDate(status.nextAvailableDate) ||
    `${status.remainingDays} day(s)`;
  return {
    ...status,
    lockMessage: `🔒 Profile picture locked. You can change it again on ${formattedDate}.`,
  };
}
