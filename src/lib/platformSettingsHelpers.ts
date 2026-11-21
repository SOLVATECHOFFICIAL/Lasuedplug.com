import { UserProfile } from '../types';
import { isAuthorizedAdminSession, isUserAdmin } from './adminHelpers';

export const PLATFORM_SETTINGS_COLLECTION = 'platform_settings';
export const GLOBAL_SETTINGS_DOC_ID = 'global';

export interface PlatformSettings {
  maintenanceMode: boolean;
  academicSessionCount?: number;
  lastSessionRolloverAt?: unknown;
  lastSessionRolloverBy?: string;
  lastSessionPromotedCount?: number;
  lastSessionGraduatedCount?: number;
  updatedAt?: unknown;
  updatedBy?: string;
}

const MAINTENANCE_BYPASS_PREFIXES = [
  '/login',
  '/auth/login',
  '/forgot-password',
  '/auth/forgot-password',
  '/admin',
];

export function isMaintenanceBypassPath(pathname: string): boolean {
  const normalized = (pathname || '/').trim().toLowerCase();
  return MAINTENANCE_BYPASS_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function shouldShowMaintenanceScreen(params: {
  maintenanceMode: boolean;
  pathname: string;
  user?: { email?: string | null; emailVerified?: boolean | null } | null;
  profile?: Partial<Pick<UserProfile, 'roles'>> | null;
}): boolean {
  if (!params.maintenanceMode) {
    return false;
  }
  if (isAuthorizedAdminSession(params.user) || isUserAdmin(params.profile)) {
    return false;
  }
  if (isMaintenanceBypassPath(params.pathname)) {
    return false;
  }
  return true;
}
