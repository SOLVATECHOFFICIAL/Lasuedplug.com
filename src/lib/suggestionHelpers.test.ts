import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSuggestionWhatsAppUrl,
  getSuggestionCategoryLabel,
  parseStoredSuggestions,
  validateSuggestionInput,
} from './suggestionHelpers';
import { UPDATES_WHATSAPP_GROUP_LINK } from './constants';

test('validateSuggestionInput rejects empty or too-short fields and accepts valid input', () => {
  const emptyResult = validateSuggestionInput({
    category: 'new_feature',
    title: '  ',
    details: 'short',
  });
  assert.equal(emptyResult.valid, false);
  assert.ok(emptyResult.errors.title);
  assert.ok(emptyResult.errors.details);

  const validResult = validateSuggestionInput({
    category: 'marketplace',
    title: 'Add Hostel Price Filter',
    details: 'Let students filter hostels by distance to main campus gate.',
  });
  assert.equal(validResult.valid, true);
  assert.deepEqual(validResult.errors, {});
});

test('buildSuggestionWhatsAppUrl formats category, title, details, and author', () => {
  const url = buildSuggestionWhatsAppUrl({
    category: 'ui_speed',
    title: 'Dark mode option',
    details: 'Please add a dark mode toggle for night reading.',
    authorName: 'Tunde 200L',
  });
  assert.ok(url.startsWith('https://wa.me/'));
  const decoded = decodeURIComponent(url);
  assert.ok(decoded.includes('Design & Speed'));
  assert.ok(decoded.includes('Dark mode option'));
  assert.ok(decoded.includes('Tunde 200L'));
});

test('getSuggestionCategoryLabel and parseStoredSuggestions work deterministically', () => {
  assert.equal(getSuggestionCategoryLabel('bug_fix'), 'Report a Bug / Issue');
  assert.equal(
    UPDATES_WHATSAPP_GROUP_LINK,
    'https://chat.whatsapp.com/DdRUGL68WgE2kECup1OZ87?s=cl&p=a&iam=2'
  );

  const parsed = parseStoredSuggestions(
    JSON.stringify([
      {
        id: 's1',
        title: 'Older idea',
        details: 'Details one two three four',
        category: 'other',
        authorName: 'Ada',
        status: 'new',
        deliveryChannel: 'firestore',
        createdAtMs: 1000,
      },
      {
        id: 's2',
        title: 'Newer idea',
        details: 'Details five six seven eight',
        category: 'new_feature',
        authorName: 'Bola',
        status: 'new',
        deliveryChannel: 'whatsapp_fallback',
        createdAtMs: 5000,
      },
    ])
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, 's2');
  assert.deepEqual(parseStoredSuggestions('bad json'), []);
});
