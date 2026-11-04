const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { checkSeoOrigin } = require('./check-seo-origin.cjs');

test('build scripts write flat catalogue files and sitemap URLs without invented lastmod', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'catalogue-build-'));
  const songs = Array.from({ length: 1001 }, (_, id) => ({
    id, slug: `song-${id}`, title_zh: `歌曲 ${id}`, artist_en: 'Test Artist',
    updated_at: id === 0 ? '2026-01-01T00:00:00Z' : null,
  }));
  const server = http.createServer((req, res) => {
    const [from, to] = (req.headers.range || '0-999').split('-').map(Number);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(songs.slice(from, to + 1)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(cwd, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(cwd, 'public'));
  await fs.mkdir(path.join(cwd, 'dist'));
  await fs.copyFile(path.join(__dirname, '../index.html'), path.join(cwd, 'dist/index.html'));
  const env = { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, VITE_SUPABASE_ANON_KEY: 'test' };
  for (const script of ['generate-sitemap.cjs', 'prerender.cjs']) {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [path.join(__dirname, script)], { cwd, env });
    assert.doesNotMatch(stdout + stderr, /skipping|failed/i);
  }
  await fs.copyFile(path.join(cwd, 'public/sitemap.xml'), path.join(cwd, 'dist/sitemap.xml'));
  await fs.copyFile(path.join(__dirname, '../public/robots.txt'), path.join(cwd, 'dist/robots.txt'));
  checkSeoOrigin(path.join(cwd, 'dist'));
  for (const route of ['index', 'songs', 'artists', 'song/song-0', 'artist/Test Artist', 'faq', 'stats', 'privacy', 'terms']) {
    const html = await fs.readFile(path.join(cwd, `dist/${route}.html`), 'utf8');
    const canonical = `https://cnlyrics.app/${route === 'index' ? '' : route.replaceAll(' ', '%20')}`;
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}"`));
    assert.ok(html.includes('<meta property="og:image" content="https://cnlyrics.app/logo.png"'));
  }
  assert.match(await fs.readFile(path.join(cwd, 'dist/robots.txt'), 'utf8'), /Sitemap: https:\/\/cnlyrics\.app\/sitemap.xml/);
  const sitemap = await fs.readFile(path.join(cwd, 'public/sitemap.xml'), 'utf8');
  for (const [, location] of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) {
    assert.equal(new URL(location).origin, 'https://cnlyrics.app');
  }
  assert.match(sitemap, /<loc>https:\/\/cnlyrics\.app\/artists<\/loc>/);
  for (let page = 1; page <= 11; page++) {
    const route = page === 1 ? 'songs' : `songs/${page}`;
    assert.ok(sitemap.includes(`<loc>https://cnlyrics.app/${route}</loc>`));
    const html = await fs.readFile(path.join(cwd, `dist/${route}.html`), 'utf8');
    assert.match(html, /<a [^>]*href="\/song\/song-/);
  }
  assert.equal([...sitemap.matchAll(/<lastmod>/g)].length, 1);
  assert.ok(sitemap.includes('<lastmod>2026-01-01T00:00:00.000Z</lastmod>'));
  assert.equal(JSON.parse(await fs.readFile(path.join(cwd, 'dist/catalogue.json'), 'utf8')).songs.length, 1001);
  const home = await fs.readFile(path.join(cwd, 'dist/index.html'), 'utf8');
  assert.match(home, /href="\/songs"/);
  assert.match(home, /href="\/artists"/);
  const artist = await fs.readFile(path.join(cwd, 'dist/artist/Test Artist.html'), 'utf8');
  assert.match(artist, /href="\/song\/song-1000"/);
});

test('production builds fail on prerender errors and missing configuration', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prerender-failure-'));
  const root = path.join(__dirname, '..');
  const song = { id: 1, slug: 'test-song', title_zh: '测试', artist_en: 'Test Artist' };
  let failFetch = false;
  const server = http.createServer((req, res) => {
    const isPrerender = new URL(req.url, 'http://localhost').searchParams.get('select').includes('lyrics_chinese');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = failFetch && isPrerender ? 401 : 200;
    res.end(JSON.stringify(res.statusCode === 401 ? { message: 'Unauthorized' } : [song]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(cwd, { recursive: true, force: true });
  });
  const env = {
    ...process.env, NODE_ENV: 'production',
    VITE_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, VITE_SUPABASE_ANON_KEY: 'test',
  };
  const run = promisify(execFile);
  const prerender = path.join(__dirname, 'prerender.cjs');
  const resetDist = async () => {
    await fs.rm(path.join(cwd, 'dist'), { recursive: true, force: true });
    await fs.mkdir(path.join(cwd, 'dist'));
    await fs.copyFile(path.join(root, 'index.html'), path.join(cwd, 'dist/index.html'));
  };
  for (const [kind, obstacle] of [['song', 'song'], ['artist', 'artist'], ['catalogue', 'songs.html']]) {
    await t.test(`${kind} file-write failure exits non-zero`, async () => {
      await resetDist();
      if (obstacle.endsWith('.html')) await fs.mkdir(path.join(cwd, 'dist', obstacle));
      else await fs.writeFile(path.join(cwd, 'dist', obstacle), 'blocked');
      await assert.rejects(run(process.execPath, [prerender], { cwd, env }), error => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /Prerender failed:/);
        return true;
      });
    });
  }
  await t.test('npm run build propagates a prerender fetch failure after Vite succeeds', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    await fs.writeFile(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { build: pkg.scripts.build } }));
    await fs.symlink(path.join(root, 'scripts'), path.join(cwd, 'scripts'), 'dir');
    await fs.symlink(path.join(root, 'node_modules'), path.join(cwd, 'node_modules'), 'dir');
    await fs.mkdir(path.join(cwd, 'public'));
    await fs.writeFile(path.join(cwd, 'index.html'), '<html><head><title>Test</title></head><body><div id="root"></div></body></html>');
    failFetch = true;
    await assert.rejects(run('npm', ['run', 'build'], { cwd, env }), error => {
      assert.equal(error.code, 1);
      assert.match(error.stdout, /Sitemap generated:/);
      assert.match(error.stdout, /built in/);
      assert.match(error.stderr, /Prerender failed: Catalogue HTTP 401/);
      return true;
    });
  });
  for (const context of ['npm_lifecycle_event', 'NODE_ENV', 'VERCEL', 'local']) {
    await t.test(`missing configuration: ${context}`, async () => {
      const missing = { ...env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', NODE_ENV: '', VERCEL: '', npm_lifecycle_event: '' };
      if (context !== 'local') missing[context] = { npm_lifecycle_event: 'build', NODE_ENV: 'production', VERCEL: '1' }[context];
      if (context === 'local') {
        const { stderr } = await run(process.execPath, [prerender], { cwd, env: missing });
        assert.match(stderr, /skipping local prerender/);
      } else {
        await assert.rejects(run(process.execPath, [prerender], { cwd, env: missing }), error => {
          assert.equal(error.code, 1);
          assert.match(error.stderr, /Supabase configuration missing/);
          return true;
        });
      }
    });
  }
});
