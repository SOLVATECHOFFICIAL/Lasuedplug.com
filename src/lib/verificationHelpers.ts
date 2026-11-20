import { getTimestampMillis } from './homeHelpers';
import { VerificationRequest } from '../types';

export type VerificationUiState =
  | 'verified'
  | 'pending'
  | 'rejected'
  | 'unverified';

const MAX_ID_CARD_DATA_URL_LENGTH = 850_000;

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
  requests: VerificationRequest[]
): { allowed: boolean; reason?: string } {
  if (isVerified) {
    return {
      allowed: false,
      reason: 'Your student account is already verified.',
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
}): string | null {
  if (!input.userId?.trim()) {
    return 'You must be signed in to apply for verification.';
  }
  if (!input.fullName?.trim() || input.fullName.trim().length < 2) {
    return 'Please save your full name on your profile before applying.';
  }
  if (!input.idCardImage?.trim()) {
    return 'Please upload your Student ID card or School Fee receipt.';
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
