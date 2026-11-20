import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFrontendGroqApiKey,
  getFrontendGroqClient,
  GROQ_MODEL,
} from './groqService';

test('groqService targets active qwen/qwen3.8-27b model and returns null cleanly when API key is missing', () => {
  assert.equal(GROQ_MODEL, 'qwen/qwen3.8-27b');
  assert.equal(getFrontendGroqApiKey(), '');
  assert.equal(getFrontendGroqClient(), null);
});
