const { test } = require('node:test');
const assert = require('node:assert/strict');
const config = require('../vercel.json');

// Vercel allows 2,048 redirects in vercel.json (docs: routing/redirects/configuration-redirects).
test('vercel.json redirects: within Vercel limit, permanent, one hop, no loops', () => {
  const redirects = config.redirects || [];
  assert.ok(redirects.length <= 2000, `${redirects.length} redirects; Vercel caps vercel.json at 2,048, switch to bulk redirects`);
  const sources = new Set(redirects.map(r => r.source));
  assert.equal(sources.size, redirects.length, 'duplicate redirect source');
  for (const r of redirects) {
    assert.equal(r.permanent, true, `${r.source} must be permanent`);
    assert.notEqual(r.source, r.destination);
    assert.ok(!sources.has(r.destination), `${r.source} chains through ${r.destination}`);
  }
});
