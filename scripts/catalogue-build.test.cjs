const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

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
  const sitemap = await fs.readFile(path.join(cwd, 'public/sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/cnlyrichub.vercel.app\/artists<\/loc>/);
  for (let page = 1; page <= 11; page++) {
    const route = page === 1 ? 'songs' : `songs/${page}`;
    assert.ok(sitemap.includes(`<loc>https://cnlyrichub.vercel.app/${route}</loc>`));
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
