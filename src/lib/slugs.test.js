import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, baseSlug, assignSlugs, buildRedirects, validateSlugMap, MAX_SLUG } from './slugs.js';

test('slugify collapses initialisms and apostrophes', () => {
  assert.equal(slugify('G.E.M.'), 'gem');
  assert.equal(slugify('a.i.n.y.'), 'ainy');
  assert.equal(slugify("Listen to Mother's Words"), 'listen-to-mothers-words');
});

test('baseSlug: first artist, repeated words collapsed, title cut at a word boundary', () => {
  assert.equal(baseSlug({ artist: 'Silence Wang, By2', title: 'a-little-sweet', id: 1 }), 'silence-wang-a-little-sweet');
  assert.equal(baseSlug({ artist: 'Eason Chan', title: 'talk only live live', id: 2 }), 'eason-chan-talk-only-live');
  const long = baseSlug({ artist: 'C AllStar', title: 'one two three four five six seven eight nine ten eleven twelve thirteen', id: 3 });
  assert.ok(long.length <= MAX_SLUG && long.startsWith('c-allstar-one-two') && !long.endsWith('-'));
  assert.equal(baseSlug({ artist: 'Beyond', title: '', id: 283 }), 'beyond-song-283');
});

test('assignSlugs: overrides reserved first, lowest id keeps bare slug, rest get -id', () => {
  const rows = [
    { id: 5, artist: 'A', title: 'x' }, { id: 9, artist: 'A', title: 'x' },
    { id: 1212, artist: 'T', title: 'moon' }, { id: 1346, artist: 'T', title: 'moon' },
  ];
  const m = assignSlugs(rows, { 1346: 't-moon', 1212: 't-moon-1212' });
  assert.equal(m.get(5).slug, 'a-x');
  assert.equal(m.get(9).slug, 'a-x-9');
  assert.equal(m.get(1346).slug, 't-moon');
  assert.equal(m.get(1212).slug, 't-moon-1212');
  assert.throws(() => assignSlugs(rows, { 5: 'dup', 9: 'dup' }));
  assert.throws(() => assignSlugs(rows, { 5: 'Bad Slug' }));
});

test('generated slug never steals an override', () => {
  const m = assignSlugs([{ id: 1, artist: 'A', title: 'x' }, { id: 2, artist: 'A', title: 'z' }], { 2: 'a-x' });
  assert.equal(m.get(2).slug, 'a-x');
  assert.equal(m.get(1).slug, 'a-x-1');
});

test('buildRedirects is one hop and skips no-ops', () => {
  const r = buildRedirects([
    { old_slug: 'b-1', songs: { slug: 'b' } }, { old_slug: 'a-1', songs: { slug: 'a' } }, { old_slug: 'same', songs: { slug: 'same' } },
  ]);
  assert.deepEqual(r.map(x => x.source), ['/song/a-1', '/song/b-1']);
  assert.ok(r.every(x => x.permanent === true));
});

test('validateSlugMap catches duplicates, strangers and stale rows', () => {
  const songs = [{ id: 1, slug: 'old-1' }, { id: 2, slug: 'old-2' }, { id: 3, slug: 'keep' }];
  assert.deepEqual(validateSlugMap([{ id: 1, old: 'old-1', new: 'a' }, { id: 2, old: 'old-2', new: 'b' }], songs), []);
  assert.equal(validateSlugMap([{ id: 1, old: 'old-1', new: 'a' }, { id: 2, old: 'old-2', new: 'a' }], songs).length, 1);
  assert.equal(validateSlugMap([{ id: 1, old: 'old-1', new: 'keep' }], songs).length, 1);
  assert.equal(validateSlugMap([{ id: 1, old: 'old-1', new: 'old-2' }, { id: 2, old: 'old-2', new: 'z' }], songs).length, 1);   // takes a slug another moving song still holds
  assert.equal(validateSlugMap([{ id: 1, old: 'zzz', new: 'a' }], songs).length, 1);
  assert.equal(validateSlugMap([{ id: 99, old: 'x', new: 'a' }], songs).length, 1);
});

test('titleLanguage / romanizeTitle: zh pinyin, en as written, ja/ko only with tooling', async () => {
  const { titleLanguage, romanizeTitle, uniqueSlug, newSongSlug } = await import('./slugs.js');
  assert.equal(titleLanguage('音乐'), 'zh');
  assert.equal(titleLanguage('all in'), 'en');
  assert.equal(titleLanguage('こわい'), 'ja');
  assert.equal(titleLanguage('안녕'), 'ko');
  assert.equal(await romanizeTitle('音乐', 'zh'), 'yin-yue');
  assert.equal(await romanizeTitle('こわい', 'ja'), '');
  assert.equal(await romanizeTitle('こわい', 'ja', { ja: () => 'kowai' }), 'kowai');
  const taken = new Set(['a-b', 'a-b-2']);
  assert.equal(await uniqueSlug('a-b', async s => taken.has(s)), 'a-b-3');
  assert.equal(await uniqueSlug('free', async s => taken.has(s)), 'free');
  assert.equal(await newSongSlug({ artist: 'G.E.M.', titleZh: '光年之外', isTaken: async s => taken.has(s) }), 'gem-guang-nian-zhi-wai');
  assert.equal(await newSongSlug({ artist: 'Beyond', titleZh: 'こわい', isTaken: async () => false }), 'beyond-song');
});
