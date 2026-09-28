import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isConfirmedMissing } from './seo.js';

test('only a successful empty result is noindexed — a failed fetch never is', () => {
  assert.equal(isConfirmedMissing({ loading: false, error: false, found: null }), true);
  assert.equal(isConfirmedMissing({ loading: false, error: false, found: 0 }), true);
  // Network failure is not evidence of a missing song.
  assert.equal(isConfirmedMissing({ loading: false, error: true, found: null }), false);
  assert.equal(isConfirmedMissing({ loading: true, error: false, found: null }), false);
  assert.equal(isConfirmedMissing({ loading: false, error: false, found: { slug: 'x' } }), false);
  assert.equal(isConfirmedMissing({ loading: false, error: false, found: 3 }), false);
});
