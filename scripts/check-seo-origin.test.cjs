const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkSeoOrigin } = require('./check-seo-origin.cjs');

test('artifact check rejects old-host leaks in every SEO output and nested bundles', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-origin-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'nested'));
  const oldOrigin = 'https://cnlyrichub.vercel.app';
  for (const [name, content] of [
    ['page.html', `<link rel="canonical" href="${oldOrigin}/songs">`],
    ['page.html', `<meta property="og:url" content="${oldOrigin}/">`],
    ['page.html', `<meta property="og:image" content="${oldOrigin}/logo.png">`],
    ['page.html', `<script type="application/ld+json">{"url":"${oldOrigin}/"}</script>`],
    ['sitemap.xml', `<loc>${oldOrigin}/song/test</loc>`],
    ['robots.txt', `Sitemap: ${oldOrigin}/sitemap.xml`],
    ['app.js', `const origin = '${oldOrigin}';`],
  ]) {
    const file = path.join(directory, 'nested', name);
    fs.writeFileSync(file, content.replaceAll(oldOrigin, 'https://cnlyrics.app'));
    assert.doesNotThrow(() => checkSeoOrigin(directory));
    fs.writeFileSync(file, content);
    assert.throws(() => checkSeoOrigin(directory), /Old production host/);
    fs.unlinkSync(file);
  }
  assert.throws(() => checkSeoOrigin(path.join(directory, 'missing')), /ENOENT/);
});
