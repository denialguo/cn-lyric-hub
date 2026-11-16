import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FORM, parseSongJson, songToForm } from './songImport.js';

const full = {
  title: '落泪', artist: 'Kang Xi 康熙', album: 'Album A', release_date: '2019-05-01',
  featured_artists: 'Guest', lyricist: 'Writer', composer: 'Composer',
  lines: [
    { original: '我真的特别爱你', pinyin: 'wǒ zhēn de tè bié ài nǐ', translation: 'I truly love you so much.' },
    { original: '却无法靠近你', pinyin: 'què wú fǎ kào jìn nǐ', translation: 'But cannot get close.' },
  ],
};
const ok = value => { const r = parseSongJson(JSON.stringify(value)); assert.equal(r.ok, true, r.error); return songToForm(r.song); };
const bad = (text, pattern) => { const r = parseSongJson(typeof text === 'string' ? text : JSON.stringify(text)); assert.equal(r.ok, false); assert.match(r.error, pattern); };

test('valid full JSON fills the form in order', () => {
  const { patch, artists } = ok(full);
  assert.equal(patch.title_zh, '落泪');
  assert.equal(patch.lyrics_chinese, '我真的特别爱你\n却无法靠近你');
  assert.equal(patch.lyrics_pinyin, 'wǒ zhēn de tè bié ài nǐ\nquè wú fǎ kào jìn nǐ');
  assert.equal(patch.lyrics_english, 'I truly love you so much.\nBut cannot get close.');
  assert.equal(patch.year, '2019');
  assert.equal(patch.credits, 'Album: Album A\nFeatured: Guest\nLyrics by Writer\nComposed by Composer');
  assert.deepEqual(artists, [{ id: null, name_en: 'Kang Xi', name_zh: '康熙', isNew: true }]);
});

test('optional fields may be omitted or null', () => {
  const minimal = { title: 'T', artist: 'A', lines: [{ original: '你好' }] };
  const nulls = { ...minimal, album: null, release_date: null, featured_artists: null, lyricist: null, composer: null };
  for (const input of [minimal, nulls]) {
    const { patch } = ok(input);
    assert.deepEqual(patch, { title_zh: 'T', lyrics_chinese: '你好', lyrics_pinyin: '', lyrics_english: '' });
  }
});

test('lines without pinyin or translation keep the columns line-for-line', () => {
  const { patch } = ok({ title: 'T', artist: 'A', lines: [
    { original: '一', pinyin: 'yī' }, { original: '二', translation: 'two' }, { original: '三', pinyin: null, translation: null },
  ] });
  assert.equal(patch.lyrics_pinyin, 'yī\n\n');
  assert.equal(patch.lyrics_english, '\ntwo\n');
  assert.equal(patch.lyrics_chinese.split('\n').length, 3);
});

test('unknown keys are ignored and the patch only has real form fields', () => {
  const { patch } = ok({ ...full, mood: 'sad', lines: [{ original: '你好', extra: 1 }] });
  for (const key of Object.keys(patch)) assert.ok(key in EMPTY_FORM, key);
  assert.equal(patch.mood, undefined);
});

test('an unparseable release date is kept in credits instead of lost', () => {
  const { patch } = ok({ title: 'T', artist: 'A', release_date: 'spring', lines: [{ original: '你好' }] });
  assert.equal(patch.year, undefined);
  assert.match(patch.credits, /Released: spring/);
});

test('multiple artists split on commas', () => {
  const { artists } = ok({ title: 'T', artist: 'A, B 乙', lines: [{ original: '你好' }] });
  assert.deepEqual(artists.map(a => [a.name_en, a.name_zh]), [['A', ''], ['B', '乙']]);
});

test('rejects malformed JSON, wrong shapes and trailing or multiple objects', () => {
  bad('{"title": ', /valid JSON/);
  bad('', /valid JSON/);
  bad('[]', /single object/);
  bad('null', /single object/);
  const one = JSON.stringify(full);
  bad(one + one, /exactly one JSON object/);
  bad(one + ' thanks!', /valid JSON/);
  bad({ ...full, title: '  ' }, /"title"/);
  bad({ ...full, title: undefined }, /"title"/);
  bad({ ...full, artist: '' }, /"artist"/);
  bad({ ...full, artist: 5 }, /"artist"/);
  bad({ ...full, lines: [] }, /"lines"/);
  bad({ ...full, lines: 'x' }, /"lines"/);
  bad({ ...full, lines: [{ original: '好' }, { pinyin: 'x' }] }, /Line 2 needs/);
  bad({ ...full, lines: [{ original: '  ' }] }, /Line 1 needs/);
  bad({ ...full, lines: ['你好'] }, /Line 1 must be an object/);
  bad({ ...full, album: 3 }, /"album"/);
  bad({ ...full, lines: [{ original: '好', pinyin: 4 }] }, /"pinyin"/);
});

test('newlines inside a pasted line cannot shift the parallel columns', () => {
  const { patch } = ok({ title: 'T', artist: 'A', lines: [{ original: '你\n好', translation: 'a\nb' }, { original: '再见' }] });
  assert.equal(patch.lyrics_chinese, '你 好\n再见');
  assert.equal(patch.lyrics_english, 'a b\n');
});
