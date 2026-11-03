import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import prerender from '../scripts/prerender.cjs';

const artist = '测试歌手';
const song = {
  id: 1, slug: 'seo-test-song', title_zh: '测试歌曲', title_en: '',
  artist_en: artist, artist_zh: '', cover_url: '', tags: [],
  lyrics_chinese: '音乐在这里', lyrics_pinyin: 'yīn yuè zài zhè lǐ', lyrics_english: 'Music is here',
  created_at: '2026-01-01T00:00:00Z',
};

test('rendered public pages survive failed requests without hiding content or adding noindex', { timeout: 120_000 }, async t => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'cn-lyric-seo-'));
  let server, browser;
  t.after(async () => {
    await browser?.close();
    if (server) await new Promise(resolve => server.httpServer.close(resolve));
    await rm(outDir, { recursive: true, force: true });
  });

  // Build the real app with a fake API origin. No production data or credentials.
  await build({
    logLevel: 'error',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://seo-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('seo-test-anon-key'),
    },
    build: { outDir, emptyOutDir: true },
  });
  const template = await readFile(path.join(outDir, 'index.html'), 'utf8');
  const catalogueSongs = Array.from({ length: 205 }, (_, id) => ({ ...song, id, slug: id ? `fixture-${id}` : song.slug }));
  const generated = await prerender.cataloguePages(template, catalogueSongs);
  await writeFile(path.join(outDir, 'catalogue.json'), JSON.stringify(generated.catalogue));
  for (const [route, html] of generated.pages) {
    const file = path.join(outDir, `${route}.html`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html);
  }
  const pages = [
    { type: 'song', route: `/song/${song.slug}`, html: prerender.songPage(template, song) },
    { type: 'artist', route: `/artist/${encodeURIComponent(artist)}`, html: prerender.artistPage(template, artist, [song]) },
  ];
  for (const page of pages) {
    const file = path.join(outDir, `${decodeURIComponent(page.route)}.html`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, page.html);
  }
  server = await preview({ logLevel: 'silent', build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();

  await t.test('catalogue navigation works without JavaScript', async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto(origin + '/');
      await page.getByRole('link', { name: 'Song directory', exact: true }).click();
      assert.equal(await page.locator('a[href^="/song/"]').count(), 100);
      await page.getByRole('link', { name: 'Next page', exact: true }).click();
      assert.equal(new URL(page.url()).pathname, '/songs/2');
      await page.getByRole('link', { name: 'Next page', exact: true }).click();
      assert.equal(await page.locator('a[href^="/song/"]').count(), 5);
      await page.getByRole('link', { name: 'Artist directory', exact: true }).click();
      await page.getByRole('link', { name: artist, exact: false }).click();
      assert.equal(await page.locator(`a[href="/song/${song.slug}"]`).count(), 1);
    } finally { await context.close(); }
  });

  await t.test('React preserves directory links, pagination and canonicals on desktop and mobile', async () => {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.route('**/*', request => new URL(request.request().url()).origin === origin ? request.continue() : request.abort());
        await page.goto(origin + '/songs', { waitUntil: 'networkidle' });
        await page.getByRole('navigation', { name: 'Main', exact: true }).waitFor();
        assert.equal(await page.locator('a[href^="/song/"]').count(), 100);
        await page.getByRole('link', { name: 'Next page', exact: true }).click();
        await page.getByText('Page 2 of 3', { exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelector('link[rel="canonical"]')?.href.endsWith('/songs/2'));
        assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
        assert.equal(await page.locator('meta[name="robots"][content*="noindex"]').count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.evaluate(() => window.scrollY), 0);
        await page.screenshot({ path: path.join(tmpdir(), `cn-catalogue-${width}.png`), fullPage: false });
        await page.getByRole('link', { name: 'Artist directory', exact: true }).click();
        await page.getByRole('heading', { name: 'Artist Directory', exact: true }).waitFor();
        assert.equal(await page.locator('a[href^="/artist/"]').count(), 1);
        await page.getByRole('navigation', { name: 'Catalogue', exact: true }).getByRole('link', { name: 'Home', exact: true }).click();
        await page.getByRole('heading', { name: 'Explore the catalogue', exact: true }).waitFor();
        await page.locator('#catalogue-heading').scrollIntoViewIfNeeded();
        await page.locator('section[aria-labelledby="catalogue-heading"] a[href^="/song/"]').first().waitFor();
        assert.equal(await page.locator('section[aria-labelledby="catalogue-heading"] a[href^="/song/"]').count(), 6);
        await page.evaluate(() => {
          history.pushState({}, '', '/songs/999');
          window.dispatchEvent(new PopStateEvent('popstate'));
        });
        await page.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('meta[name="robots"]')].some(tag => tag.content.includes('noindex')));
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    }
  });

  for (const { type, route } of pages) {
    for (const mode of ['abort', '503', 'empty', 'fresh']) {
      await t.test(`${type}: ${mode}`, async () => {
        const page = await browser.newPage();
        try {
          let requests = 0;
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.route('**/*', request => {
            const url = new URL(request.request().url());
            if (url.origin === origin) return request.continue();
            if (url.hostname !== 'seo-test.supabase.co') return request.abort();
            requests++;
            if (mode === 'abort') return request.abort();
            if (mode === '503') return request.fulfill({ status: 503, json: { message: 'Unavailable' } });
            let rows = [];
            if (mode === 'fresh') {
              const fresh = { ...song, title_zh: '更新的歌曲', lyrics_chinese: '新的音乐', lyrics_pinyin: 'xīn de yīn yuè' };
              if (url.pathname.endsWith('/songs')) rows = [fresh];
              if (url.pathname.endsWith('/artists')) rows = [{ id: 'artist-id', name_en: artist }];
              if (url.pathname.endsWith('/song_artists')) rows = [{ songs: fresh }];
            }
            return request.fulfill({ json: rows });
          });
          await page.goto(origin + route, { waitUntil: 'networkidle' });
          // Head updates are deferred by Helmet. Wait for the real page to mount.
          await page.waitForFunction(() => !document.title.includes('Lyrics, Pinyin') && !document.title.includes('Song Lyrics with Pinyin'));
          if (mode === 'empty') {
            await page.waitForFunction(() => [...document.querySelectorAll('meta[name="robots"]')].some(tag => tag.content.includes('noindex')));
            assert.equal(await page.locator(type === 'song' ? 'ruby' : 'article').count(), 0);
          } else {
            if (type === 'song') {
              const characters = await page.locator('ruby').evaluateAll(nodes => nodes.map(node => node.firstChild.textContent).join(''));
              assert.equal(characters, mode === 'fresh' ? '新的音乐' : song.lyrics_chinese);
              assert.ok(await page.getByRole('button', { name: 'Appearance', exact: true }).isVisible());
            } else {
              const label = mode === 'fresh' ? '更新的歌曲' : song.title_zh;
              assert.ok(await page.getByRole('link', { name: `Read ${label}`, exact: true }).isVisible());
              assert.match(await page.locator('body').innerText(), /1 Songs Available/);
            }
            const robots = await page.locator('meta[name="robots"]').evaluateAll(nodes => nodes.map(node => node.content));
            assert.ok(robots.every(value => !/noindex/i.test(value)), robots.join(', '));
          }
          assert.ok(requests > 0, 'The rendered app must actually attempt its API request');
          assert.deepEqual(errors, []);

          // A snapshot must not leak into another URL during client navigation.
          if (mode === 'abort') {
            const missingRoute = `/${type}/no-snapshot`;
            await page.evaluate(route => {
              history.pushState({}, '', route);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }, missingRoute);
            await page.getByText(type === 'song' ? 'Couldn’t load the lyrics' : 'Couldn’t load the songs.', { exact: true }).waitFor();
            await page.waitForLoadState('networkidle');
            assert.equal(await page.locator(type === 'song' ? 'ruby' : 'article').count(), 0);
            assert.doesNotMatch(await page.locator('body').innerText(), /We don't have any songs/);
            assert.equal(await page.locator('meta[name="robots"][content*="noindex"]').count(), 0);
          }
        } finally {
          await page.close();
        }
      });
    }
  }
});
