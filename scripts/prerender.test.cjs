const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { songPage, artistPage } = require('./prerender.cjs');

// vite build copies the root index.html <head> into dist/index.html unchanged.
const template = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const robots = (html) => [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((m) => m[1]);
const canonicals = (html) => [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);

test('prerendered song and artist pages are indexable with a self-referencing canonical', () => {
  const songData = {
    slug: 'ru-guo-de-shi', title_zh: '如果的事', artist_en: 'Christine Fan, Angela Chang',
    lyrics_chinese: '如果你是我的传说', lyrics_pinyin: 'rú guǒ nǐ shì wǒ de chuán shuō', lyrics_english: '', year: 2005,
  };
  const song = songPage(template, songData);
  const artist = artistPage(template, '周杰伦', [songData]);

  for (const [html, canonical] of [
    [song, 'https://cnlyrichub.vercel.app/song/ru-guo-de-shi'],
    [artist, `https://cnlyrichub.vercel.app/artist/${encodeURIComponent('周杰伦')}`],
  ]) {
    assert.doesNotMatch(html, /noindex|nofollow/i);
    assert.deepEqual(robots(html), ['index, follow']);
    assert.deepEqual(canonicals(html), [canonical]);
  }
});

test('public snapshots escape script terminators and artist HTML includes song links', () => {
  const song = { slug: 'test', title_zh: '测试', lyrics_chinese: '</script><script>bad()</script>' };
  const html = songPage(template, song);
  const payload = html.match(/<script id="prerender-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(payload, /</);
  assert.deepEqual(JSON.parse(payload), { type: 'song', key: 'test', data: song });
  const artist = artistPage(template, '测试', [song]);
  assert.match(artist, /href="\/song\/test">测试<\/a>/);
  assert.doesNotMatch(artist, /lyrics_chinese/);
});
