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
    [song, 'https://cnlyrics.app/song/ru-guo-de-shi'],
    [artist, `https://cnlyrics.app/artist/${encodeURIComponent('周杰伦')}`],
  ]) {
    assert.doesNotMatch(html, /noindex|nofollow/i);
    assert.deepEqual(robots(html), ['index, follow']);
    assert.deepEqual(canonicals(html), [canonical]);
    assert.doesNotMatch(html, /cnlyrichub\.vercel\.app/);
    const structuredData = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    assert.equal(structuredData[0].url, canonical);
    assert.ok(html.includes('content="https://cnlyrics.app/logo.png"'));
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

test('ordinary HTML links reach every song through the homepage and paginated directories', async () => {
  const { cataloguePages } = require('./prerender.cjs');
  const songs = Array.from({ length: 205 }, (_, id) => ({
    id, slug: `test-${id}`, title_zh: `歌曲 ${id} <&>`, artist_en: 'Artist A, Artist B', artist_zh: '歌手',
  }));
  songs.push({ id: 999, slug: null, title_zh: 'No public URL' });
  const { pages, catalogue } = await cataloguePages(template, songs);
  const links = html => [...html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').matchAll(/<a\b[^>]*href="([^"]*)"/g)].map(match => match[1]);
  const homeLinks = links(pages.get('index'));
  assert.ok(homeLinks.includes('/songs'));
  assert.ok(homeLinks.includes('/artists'));
  assert.equal(homeLinks.filter(link => link.startsWith('/song/')).length, 6);
  assert.ok(homeLinks.some(link => link.startsWith('/artist/')));
  assert.ok(links(pages.get('artists')).includes('/artist/Artist%20A'));
  assert.ok(links(pages.get('artists')).includes('/artist/Artist%20B'));
  assert.ok(links(pages.get('artists')).includes(`/artist/${encodeURIComponent('歌手')}`));
  assert.ok(links(pages.get('songs')).includes('/songs/2'));
  assert.ok(!links(pages.get('songs')).includes('/songs/1'));
  assert.ok(links(pages.get('songs/2')).includes('/songs'));
  assert.ok(links(pages.get('songs/2')).includes('/songs/3'));
  assert.ok(links(pages.get('songs/3')).includes('/songs/2'));
  assert.ok(!links(pages.get('songs/3')).includes('/songs/4'));
  const reached = new Set();
  const queue = ['/'];
  while (queue.length) {
    const route = queue.shift();
    if (reached.has(route)) continue;
    reached.add(route);
    const html = pages.get(route === '/' ? 'index' : route.slice(1));
    if (html) queue.push(...links(html));
  }
  for (const song of songs.filter(song => song.slug)) assert.ok(reached.has(`/song/${song.slug}`), song.slug);
  assert.equal(catalogue.songs.length, 205);
  const titles = new Set();
  for (const [route, html] of pages) {
    assert.doesNotMatch(html, /noindex|nofollow/i);
    assert.deepEqual(canonicals(html), [`https://cnlyrics.app/${route === 'index' ? '' : route}`]);
    assert.deepEqual(robots(html), ['index, follow']);
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
  }
  assert.equal(titles.size, pages.size);
  assert.match(pages.get('songs'), /歌曲 0 &lt;&amp;&gt;/);
  const { cataloguePage, buildCatalogue } = await import('../src/lib/catalogue.js');
  assert.equal(cataloguePage(catalogue, 'songs', 4), null);
  assert.equal(cataloguePage(catalogue, 'songs', 0), null);
  assert.equal(cataloguePage(catalogue, 'songs', NaN), null);
  assert.deepEqual(cataloguePage(buildCatalogue([]), 'songs').items, []);
});
