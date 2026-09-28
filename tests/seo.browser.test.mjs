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
