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
    const structuredData = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
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

const ld = html => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const titleOf = html => html.match(/<title>(.*?)<\/title>/)[1].replaceAll('&amp;', '&');
const ogTitleOf = html => html.match(/property="og:title" content="([^"]*)"/)[1].replaceAll('&amp;', '&');

test('title templates', async () => {
  const song = { slug: 's', title_zh: '歌', artist_en: 'Singer', lyrics_chinese: '你好', lyrics_english: '' };
  const plain = songPage(template, song);
  const translated = songPage(template, { ...song, lyrics_english: 'Hello' });
  assert.equal(titleOf(plain), '歌 Lyrics & Pinyin — Singer | CN Lyrics');
  assert.equal(titleOf(translated), '歌 Lyrics, Pinyin & Translation — Singer | CN Lyrics');
  assert.equal(titleOf(artistPage(template, 'Singer', [song])), 'Singer Lyrics & Pinyin | CN Lyrics');
  const { pages } = await require('./prerender.cjs').cataloguePages(template, Array.from({ length: 150 }, (_, id) => ({ id, slug: `s${id}`, title_zh: `歌${id}` })));
  assert.equal(titleOf(pages.get('index')), 'CN Lyrics — Chinese Lyrics with Pinyin');
  assert.equal(titleOf(pages.get('songs')), 'Chinese Song Lyrics | CN Lyrics');
  assert.equal(titleOf(pages.get('songs/2')), 'Chinese Song Lyrics — Page 2 | CN Lyrics');
  assert.equal(titleOf(pages.get('artists')), 'Chinese Music Artists | CN Lyrics');
  const { staticMeta } = await import('../src/lib/pageMeta.js');
  assert.equal(staticMeta('stats').title, 'Chinese Lyrics Statistics | CN Lyrics');
  assert.equal(staticMeta('faq').title, 'FAQ | CN Lyrics');
  assert.equal(staticMeta('privacy').title, 'Privacy Policy | CN Lyrics');
  for (const html of [plain, translated, ...pages.values()]) {
    assert.equal(ogTitleOf(html), titleOf(html)); // og:title == <title>
    assert.match(html, /property="og:site_name" content="CN Lyrics"/);
    assert.doesNotMatch(html, /CN Lyric Hub/);
  }
});

test('homepage has one WebSite node and the shell matches the shared metadata', async () => {
  const { pages } = await require('./prerender.cjs').cataloguePages(template, [{ id: 1, slug: 'a', title_zh: '歌' }]);
  const { HOME_DESCRIPTION, HOME_TITLE } = await import('../src/lib/pageMeta.js');
  const sites = ld(pages.get('index')).filter(d => d['@type'] === 'WebSite');
  assert.deepEqual(sites, [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'CN Lyrics', alternateName: 'cnlyrics.app', url: 'https://cnlyrics.app/' }]);
  assert.equal(pages.get('index').match(/name="description" content="([^"]*)"/)[1], HOME_DESCRIPTION);
  // The unrendered shell (served for unknown routes) must not drift from the template either.
  assert.equal(titleOf(template), HOME_TITLE);
  assert.match(template, new RegExp(`name="description" content="${HOME_DESCRIPTION.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"`));
  for (const [route, html] of pages) if (route !== 'index') assert.equal(ld(html).filter(d => d['@type'] === 'WebSite').length, 0);
});

test('favicon declares its real MIME type', () => {
  const icon = template.match(/<link rel="icon"[^>]*>/)[0];
  assert.match(icon, /type="image\/png"/);
  assert.match(icon, /href="\/logo\.png"/);
});

test('no public source contains the old brand', () => {
  const root = path.join(__dirname, '..');
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const files = [...walk(path.join(root, 'src')), path.join(root, 'index.html'), ...walk(path.join(root, 'public'))]
    .filter(f => /\.(jsx?|html|svg|json|xml|txt)$/.test(f) && !f.endsWith('.test.js'));
  // Built output is covered by check-seo-origin.cjs at the end of `npm run build`.
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /CN Lyric Hub/i, file);
});
