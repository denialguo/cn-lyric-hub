import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestReleaseYear, normalize } from './itunes.cjs';

const result = (trackName, artistName, releaseDate) => ({ trackName, artistName, releaseDate });

test('picks the earliest release, not the first result', () => {
  // The real failure mode: compilations rank above the original pressing, so
  // results[0] dated a 1979 recording to 2005 across ~40% of old material.
  const year = bestReleaseYear([
    result('甜蜜蜜', '鄧麗君', '2005-01-01T00:00:00Z'),
    result('甜蜜蜜', '鄧麗君', '1979-11-01T00:00:00Z'),
    result('甜蜜蜜', '鄧麗君', '2015-06-01T00:00:00Z'),
  ], { title: '甜蜜蜜', artist: ['邓丽君', 'Teresa Teng'] });
  assert.equal(year, 1979);
});

test('matches across simplified and traditional', () => {
  // The DB stores Simplified; the CN store returns Traditional.
  assert.equal(normalize('鄧麗君'), normalize('邓丽君'));
  assert.equal(
    bestReleaseYear([result('小城故事', '鄧麗君', '1979-01-01T00:00:00Z')],
      { title: '小城故事', artist: ['邓丽君'] }),
    1979,
  );
});

test('ignores title decorations rather than failing to match', () => {
  assert.equal(
    bestReleaseYear([result('飛女正傳 (Live)', 'Beyond', '1999-03-01T00:00:00Z')],
      { title: '飞女正传(live) - live', artist: ['Beyond'] }),
    1999,
  );
});

test('rejects another artist and another song', () => {
  // Taking a minimum makes a stray older match actively dangerous, so both the
  // artist and the title have to match before a result is considered at all.
  assert.equal(
    bestReleaseYear([result('甜蜜蜜', 'Some Other Singer', '1960-01-01T00:00:00Z')],
      { title: '甜蜜蜜', artist: ['邓丽君'] }),
    null,
  );
  assert.equal(
    bestReleaseYear([result('完全不同的歌', '鄧麗君', '1970-01-01T00:00:00Z')],
      { title: '甜蜜蜜', artist: ['邓丽君'] }),
    null,
  );
});

test('returns null rather than guessing', () => {
  // A missing year renders as nothing; a wrong one is shown to readers as fact.
  assert.equal(bestReleaseYear(null, { title: 'x', artist: ['y'] }), null);
  assert.equal(bestReleaseYear([], { title: 'x', artist: ['y'] }), null);
  assert.equal(
    bestReleaseYear([result('甜蜜蜜', '鄧麗君', null)], { title: '甜蜜蜜', artist: ['邓丽君'] }),
    null,
  );
});

test('discards impossible years', () => {
  assert.equal(
    bestReleaseYear([
      result('甜蜜蜜', '鄧麗君', '1800-01-01T00:00:00Z'),
      result('甜蜜蜜', '鄧麗君', '1979-01-01T00:00:00Z'),
    ], { title: '甜蜜蜜', artist: ['邓丽君'] }),
    1979,
  );
});
