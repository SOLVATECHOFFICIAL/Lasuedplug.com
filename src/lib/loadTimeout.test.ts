import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PAGE_LOAD_MS, withLoadTimeout } from './loadTimeout.ts';

test('MAX_PAGE_LOAD_MS is strictly under 3 seconds', () => {
  assert.ok(MAX_PAGE_LOAD_MS <= 3000);
  assert.equal(MAX_PAGE_LOAD_MS, 2800);
});

test('withLoadTimeout resolves fast promises normally', async () => {
  const result = await withLoadTimeout(Promise.resolve('ok'), 200);
  assert.equal(result, 'ok');
});

test('withLoadTimeout resolves fallbackValue when stalled beyond maxMs', async () => {
  const stalled = new Promise<string>(() => {
    // never resolves
  });
  const start = Date.now();
  const result = await withLoadTimeout(stalled, 40, 'fallback');
  const elapsed = Date.now() - start;
  assert.equal(result, 'fallback');
  assert.ok(elapsed < 500);
});

test('withLoadTimeout rejects cleanly when stalled beyond maxMs without fallback', async () => {
  const stalled = new Promise<string>(() => {
    // never resolves
  });
  await assert.rejects(
    () => withLoadTimeout(stalled, 40),
    /longer than expected/i
  );
});
