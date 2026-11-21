import { getTimestampMillis } from './homeHelpers';
import { isMarketerProfile } from './authHelpers';
import { AccountType, VerificationRequest } from '../types';

export type VerificationUiState =
  | 'verified'
  | 'pending'
  | 'rejected'
  | 'unverified';

const MAX_ID_CARD_DATA_URL_LENGTH = 850_000;

export const STUDENT_VERIFICATION_DOC_TYPES = [
  'Student ID Card',
  'School Fee Receipt',
] as const;

export const MARKETER_VERIFICATION_DOC_TYPES = [
  'NIN Slip / Card',
  "Driver's License",
  "Voter's Card",
  'International Passport',
] as const;

export function getVerificationDocOptions(
  accountType?: AccountType | string | null
): readonly string[] {
  const normalized =
    typeof accountType === 'string' ? accountType.trim().toLowerCase() : '';
  return normalized === 'business' || normalized === 'marketer'
    ? MARKETER_VERIFICATION_DOC_TYPES
    : STUDENT_VERIFICATION_DOC_TYPES;
}

export function getVerifiedBadgeLabel(
  accountType?: AccountType | string | null
): string {
  const normalized =
    typeof accountType === 'string' ? accountType.trim().toLowerCase() : '';
  return normalized === 'business' || normalized === 'marketer'
    ? 'Verified Marketer'
    : 'Verified Student';
}

export function getResolvedVerifiedBadgeLabel(
  entity?: {
    accountType?: AccountType | string | null;
    businessName?: string | null;
    shopAddress?: string | null;
    isOnlineOnly?: boolean | null;
  } | null
): string {
  if (!entity) return 'Verified Member';
  if (isMarketerProfile(entity)) return 'Verified Marketer';
  const normalized =
    typeof entity.accountType === 'string'
      ? entity.accountType.trim().toLowerCase()
      : '';
  if (normalized === 'student') return 'Verified Student';
  return 'Verified Member';
}

export function sortVerificationRequests(
  requests: VerificationRequest[]
): VerificationRequest[] {
  return [...requests].sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
  );
}

export function getLatestVerificationRequest(
  requests: VerificationRequest[]
): VerificationRequest | null {
  if (!Array.isArray(requests) || requests.length === 0) {
    return null;
  }
  return sortVerificationRequests(requests)[0] ?? null;
}

export function getVerificationUiState(
  isVerified: boolean,
  requests: VerificationRequest[]
): VerificationUiState {
  if (isVerified) {
    return 'verified';
  }
  if (requests.some((req) => req.status === 'pending')) {
    return 'pending';
  }
  const latest = getLatestVerificationRequest(requests);
  if (latest?.status === 'rejected') {
    return 'rejected';
  }
  return 'unverified';
}

export function canSubmitVerificationRequest(
  isVerified: boolean,
  requests: VerificationRequest[],
  accountType?: AccountType | null
): { allowed: boolean; reason?: string } {
  if (isVerified) {
    return {
      allowed: false,
      reason:
        accountType === 'business'
          ? 'Your marketer account is already verified.'
          : 'Your student account is already verified.',
    };
  }
  if (requests.some((req) => req.status === 'pending')) {
    return {
      allowed: false,
      reason: 'You already have a verification request pending review.',
    };
  }
  return { allowed: true };
}

export function isValidVerificationImageDataUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(trimmed);
}

export function validateVerificationInput(input: {
  userId?: string;
  fullName?: string;
  idCardImage?: string;
  accountType?: AccountType;
  documentType?: string;
}): string | null {
  if (!input.userId?.trim()) {
    return 'You must be signed in to apply for verification.';
  }
  if (!input.fullName?.trim() || input.fullName.trim().length < 2) {
    return 'Please save your full name on your profile before applying.';
  }
  if (input.accountType === 'business' && input.documentType !== undefined && !input.documentType.trim()) {
    return 'Please select an ID document type (NIN, Driver’s License, Voter’s Card, or Passport).';
  }
  if (!input.idCardImage?.trim()) {
    return input.accountType === 'business'
      ? "Please upload a clear photo of your NIN, Driver's License, Voter's Card, or Passport."
      : 'Please upload your Student ID card or School Fee receipt.';
  }
  if (!isValidVerificationImageDataUrl(input.idCardImage)) {
    return 'Uploaded document must be a valid compressed image.';
  }
  if (input.idCardImage.length > MAX_ID_CARD_DATA_URL_LENGTH) {
    return 'Document image is too large. Please upload a smaller photo.';
  }
  return null;
}

export function formatVerificationDate(value: unknown): string {
  const millis = getTimestampMillis(value);
  if (!millis) return 'Just now';
  return new Date(millis).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
