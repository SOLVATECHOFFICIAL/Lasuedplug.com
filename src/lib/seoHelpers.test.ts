import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanonicalUrl,
  formatMetaDescription,
  getRobotsDirective,
} from './seoHelpers';

test('buildCanonicalUrl strips query params and trailing slashes while preserving origin', () => {
  assert.equal(
    buildCanonicalUrl({
      origin: 'https://lasuedplug-com.vercel.app',
      pathname: '/marketplace/',
    }),
    'https://lasuedplug-com.vercel.app/marketplace'
  );

  assert.equal(
    buildCanonicalUrl({
      explicitUrl: 'https://lasuedplug-com.vercel.app/services/?q=barber#top',
    }),
    'https://lasuedplug-com.vercel.app/services'
  );

  assert.equal(
    buildCanonicalUrl({
      origin: 'https://lasuedplug-com.vercel.app',
      pathname: '/',
    }),
    'https://lasuedplug-com.vercel.app/'
  );
});

test('getRobotsDirective switches between index and noindex cleanly', () => {
  assert.equal(getRobotsDirective(false), 'index, follow');
  assert.equal(getRobotsDirective(undefined), 'index, follow');
  assert.equal(getRobotsDirective(true), 'noindex, nofollow');
});

test('formatMetaDescription trims whitespace and clamps at 160 characters', () => {
  const longText = 'A'.repeat(200);
  const formatted = formatMetaDescription(longText);
  assert.equal(formatted.length, 160);
  assert.ok(formatted.endsWith('...'));
});
