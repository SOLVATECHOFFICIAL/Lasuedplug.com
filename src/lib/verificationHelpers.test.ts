import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSubmitVerificationRequest,
  formatVerificationDate,
  getLatestVerificationRequest,
  getVerificationUiState,
  isValidVerificationImageDataUrl,
  sortVerificationRequests,
  validateVerificationInput,
} from './verificationHelpers';
import { VerificationRequest } from '../types';

const SAMPLE_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';

test('sortVerificationRequests orders newest requests first', () => {
  const rows: VerificationRequest[] = [
    {
      id: 'old',
      userId: 'u1',
      fullName: 'Old Student',
      idCardImage: SAMPLE_IMAGE,
      status: 'rejected',
      createdAt: 1000,
    },
    {
      id: 'new',
      userId: 'u1',
      fullName: 'New Student',
      idCardImage: SAMPLE_IMAGE,
      status: 'pending',
      createdAt: { seconds: 5, nanoseconds: 0 },
    },
  ];

  const sorted = sortVerificationRequests(rows);
  assert.equal(sorted[0].id, 'new');
  assert.equal(sorted[1].id, 'old');
  assert.equal(getLatestVerificationRequest(rows)?.id, 'new');
});

test('getVerificationUiState prioritizes verified, then pending, then rejected, else unverified', () => {
  const pendingReq: VerificationRequest = {
    id: 'r1',
    userId: 'u1',
    fullName: 'Ada',
    idCardImage: SAMPLE_IMAGE,
    status: 'pending',
    createdAt: 2000,
  };
  const rejectedReq: VerificationRequest = {
    id: 'r2',
    userId: 'u1',
    fullName: 'Ada',
    idCardImage: SAMPLE_IMAGE,
    status: 'rejected',
    createdAt: 3000,
  };

  assert.equal(getVerificationUiState(true, [pendingReq]), 'verified');
  assert.equal(getVerificationUiState(false, [rejectedReq, pendingReq]), 'pending');
  assert.equal(getVerificationUiState(false, [rejectedReq]), 'rejected');
  assert.equal(getVerificationUiState(false, []), 'unverified');
});

test('canSubmitVerificationRequest blocks verified users and pending duplicates', () => {
  const pendingReq: VerificationRequest = {
    id: 'r1',
    userId: 'u1',
    fullName: 'Ada',
    idCardImage: SAMPLE_IMAGE,
    status: 'pending',
    createdAt: 1000,
  };
  const rejectedReq: VerificationRequest = {
    id: 'r2',
    userId: 'u1',
    fullName: 'Ada',
    idCardImage: SAMPLE_IMAGE,
    status: 'rejected',
    createdAt: 2000,
  };

  assert.equal(canSubmitVerificationRequest(true, []).allowed, false);
  assert.equal(canSubmitVerificationRequest(false, [pendingReq]).allowed, false);
  assert.equal(canSubmitVerificationRequest(false, [rejectedReq]).allowed, true);
  assert.equal(canSubmitVerificationRequest(false, []).allowed, true);
});

test('validateVerificationInput validates userId, fullName, and Base64 image', () => {
  assert.equal(isValidVerificationImageDataUrl(SAMPLE_IMAGE), true);
  assert.equal(isValidVerificationImageDataUrl('https://example.com/a.jpg'), false);

  assert.ok(validateVerificationInput({ userId: '', fullName: 'Ada', idCardImage: SAMPLE_IMAGE }));
  assert.ok(validateVerificationInput({ userId: 'u1', fullName: 'A', idCardImage: SAMPLE_IMAGE }));
  assert.ok(validateVerificationInput({ userId: 'u1', fullName: 'Ada', idCardImage: '' }));
  assert.ok(
    validateVerificationInput({
      userId: 'u1',
      fullName: 'Ada',
      idCardImage: 'not-a-data-url',
    })
  );
  assert.equal(
    validateVerificationInput({
      userId: 'u1',
      fullName: 'Ada Okafor',
      idCardImage: SAMPLE_IMAGE,
    }),
    null
  );
});

test('formatVerificationDate handles missing timestamps cleanly', () => {
  assert.equal(formatVerificationDate(null), 'Just now');
  const formatted = formatVerificationDate(Date.UTC(2025, 2, 15));
  assert.ok(formatted.includes('2025'));
});
