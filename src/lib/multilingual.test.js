import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlainEnglishLine, repeatsOriginal } from './multilingual.js';

test('repeatsOriginal is exact equality after trimming, and nothing fuzzier', () => {
  assert.equal(repeatsOriginal("Baby don't cry", "Baby don't cry"), true);
  assert.equal(repeatsOriginal('Oh', 'Oh'), true);
  assert.equal(repeatsOriginal('  Oh ', 'Oh\t'), true);
  assert.equal(repeatsOriginal('Oh', 'Oh!'), false); // punctuation
  assert.equal(repeatsOriginal('Oh', 'oh'), false); // capitalization
  assert.equal(repeatsOriginal('Oh  baby', 'Oh baby'), false); // inner whitespace is not normalized
  assert.equal(repeatsOriginal('我爱你', 'I love you'), false);
  assert.equal(repeatsOriginal('', ''), false);
  assert.equal(repeatsOriginal('   ', '  '), false);
  assert.equal(repeatsOriginal(undefined, 'Oh'), false);
});

test('only clearly English lines count as plain English', () => {
  for (const line of ["Baby don't cry", 'Oh', '“Quoted” — yeah…', 'Hello, world! (x2)']) assert.equal(isPlainEnglishLine(line), true, line);
  for (const line of ['我真的特别爱你 baby', 'wǒ ài nǐ', 'café', '...', '123', '', '  ', 'さよなら']) assert.equal(isPlainEnglishLine(line), false, line);
});

test('dedupeAdjacentEnglish', async () => {
  const { dedupeAdjacentEnglish: d } = await import('./multilingual.js');
  assert.deepEqual(d(['a', 'a', 'a', 'b', 'a']), ['a', '', '', 'b', 'a']);
  assert.deepEqual(d(['a', '', 'a']), ['a', '', 'a']);
  assert.deepEqual(d(['', '', 'a ', 'a']), ['', '', 'a ', '']);
});
