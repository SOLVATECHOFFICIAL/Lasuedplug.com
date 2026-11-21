import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildListingShareMessage,
  formatSharePriceText,
  shareListing,
} from './shareUtils';

test('formatSharePriceText formats fixed, negotiable, and contact pricing', () => {
  assert.equal(
    formatSharePriceText({ priceType: 'fixed', price: 15000, adType: 'item' }),
    '₦15,000'
  );
  assert.equal(
    formatSharePriceText({
      priceType: 'negotiable',
      price: 25000,
      adType: 'item',
    }),
    '₦25,000 (Negotiable)'
  );
  assert.equal(
    formatSharePriceText({ priceType: 'contact', price: 25000, adType: 'item' }),
    'Contact for Price'
  );
  assert.equal(
    formatSharePriceText({ priceType: 'fixed', price: 5000, adType: 'service' }),
    'Contact for Price'
  );
  assert.equal(
    formatSharePriceText({ priceType: 'fixed', adType: 'item' }),
    'Contact for Price'
  );
});

test('buildListingShareMessage builds Temu/Jumia-style share text', () => {
  const msg = buildListingShareMessage(
    'HP EliteBook 840 G5',
    '₦180,000 (Negotiable)',
    'Item',
    'https://lasuedplug.com/marketplace/abc123'
  );
  assert.equal(
    msg,
    'Check out this Item on LASUEDPLUG: HP EliteBook 840 G5 for ₦180,000 (Negotiable). View details here: https://lasuedplug.com/marketplace/abc123'
  );
});

test('shareListing uses navigator.share when available and skips toast', async () => {
  const sharedPayloads: Array<{ title?: string; text?: string; url?: string }> = [];
  const toasts: Array<{ message: string; type?: string }> = [];

  const outcome = await shareListing(
    'Self-Contain near Gate',
    '₦250,000/year',
    'Accommodation',
    'https://lasuedplug.com/accommodation/acc1',
    {
      navigatorShare: async (data) => {
        sharedPayloads.push(data);
      },
      copyToClipboard: async () => {
        throw new Error('Should not fall back to clipboard when share succeeds');
      },
      onToast: (message, type) => {
        toasts.push({ message, type });
      },
    }
  );

  assert.equal(outcome, 'shared');
  assert.equal(sharedPayloads.length, 1);
  assert.equal(sharedPayloads[0].title, 'Self-Contain near Gate');
  assert.equal(
    sharedPayloads[0].url,
    'https://lasuedplug.com/accommodation/acc1'
  );
  assert.equal(
    sharedPayloads[0].text,
    'Check out this Accommodation on LASUEDPLUG: Self-Contain near Gate for ₦250,000/year. View details here: https://lasuedplug.com/accommodation/acc1'
  );
  assert.equal(toasts.length, 0);
});

test('shareListing returns cancelled without copying when navigator.share throws AbortError', async () => {
  let copyCalled = false;
  const toasts: string[] = [];

  const outcome = await shareListing(
    'Campus Cuts',
    'Business',
    'Store',
    'https://lasuedplug.com/store/s1',
    {
      navigatorShare: async () => {
        const err = new Error('User cancelled');
        err.name = 'AbortError';
        throw err;
      },
      copyToClipboard: async () => {
        copyCalled = true;
        return true;
      },
      onToast: (message) => {
        toasts.push(message);
      },
    }
  );

  assert.equal(outcome, 'cancelled');
  assert.equal(copyCalled, false);
  assert.equal(toasts.length, 0);
});

test('shareListing copies full message to clipboard and shows toast when navigator.share fails or is absent', async () => {
  const copiedTexts: string[] = [];
  const toasts: Array<{ message: string; type?: string }> = [];

  const outcome = await shareListing(
    'Roommate in Igbogbo',
    'Roommate Request',
    'Roommate',
    'https://lasuedplug.com/roommates?request=rm1',
    {
      navigatorShare: async () => {
        throw new Error('NotAllowedError');
      },
      copyToClipboard: async (text) => {
        copiedTexts.push(text);
        return true;
      },
      onToast: (message, type) => {
        toasts.push({ message, type });
      },
    }
  );

  assert.equal(outcome, 'copied');
  assert.equal(
    copiedTexts[0],
    'Check out this Roommate on LASUEDPLUG: Roommate in Igbogbo for Roommate Request. View details here: https://lasuedplug.com/roommates?request=rm1'
  );
  assert.deepEqual(toasts, [
    { message: 'Link copied to clipboard!', type: 'success' },
  ]);
});
