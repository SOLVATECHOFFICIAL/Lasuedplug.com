import { UserProfile } from '../types';

export function buildNewUserProfile(params: {
  uid: string;
  email: string;
  fullName?: string;
  timestamp: unknown;
}): UserProfile {
  return {
    uid: params.uid,
    email: params.email.trim().toLowerCase(),
    fullName: params.fullName?.trim() || '',
    roles: {
      buyer: true,
    },
    isVerified: false,
    status: 'active',
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  };
}

export function getProtectedRouteDecision(state: {
  loading: boolean;
  isAuthenticated: boolean;
}): 'loading' | 'redirect' | 'allow' {
  if (state.loading) {
    return 'loading';
  }
  if (!state.isAuthenticated) {
    return 'redirect';
  }
  return 'allow';
}
