import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogueStats } from './catalogueStats.js';

test('snapshot counts repeated tones correctly, keeps all likes, and excludes raw lyrics', () => {
  const rows = Array.from({ length: 12 }, (_, id) => ({
    id, slug: String(id), title_zh: '歌', lyrics_chinese: '妈妈麻麻马马骂骂',
    song_likes: [{ count: 1 }], tags: [],
  }));
  const result = buildCatalogueStats(rows, {});
  assert.deepEqual(result.toneData.map(t => t.value), [24, 24, 24, 24, 0]);
  assert.equal(result.totalChars, 96);
  assert.equal(result.totalLikes, 12);
  assert.equal(result.topLiked.length, 10);
  assert.equal(result.songCount, 12);
  assert.equal(JSON.stringify(result).includes('lyrics_chinese'), false);
  const empty = buildCatalogueStats([], {});
  assert.equal(empty.avgLines, 0);
  assert.deepEqual(empty.lyricSamples, []);
  assert.equal(empty.longestSong, null);
});
