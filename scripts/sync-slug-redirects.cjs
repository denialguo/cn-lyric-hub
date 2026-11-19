#!/usr/bin/env node
/**
 * Make vercel.json's 301 redirects match the song_slug_aliases table (old slug -> current slug).
 *
 *   npm run redirects:sync    rewrite the "redirects" array in vercel.json
 *   npm run redirects:check   exit 1 if vercel.json is out of date (no write)
 *
 * Vercel applies redirects before static files, so an old prerendered page can never shadow a redirect.
 * Vercel caps vercel.json at 2,048 redirects; this refuses to write past 2,000 (switch to bulk redirects then).
 */
const fs = require('fs');
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { readAll } = require('./read-all.cjs');

const LIMIT = 2000;

async function main() {
  const { buildRedirects } = await import('../src/lib/slugs.js');
  const check = process.argv.includes('--check');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const db = createClient(process.env.VITE_SUPABASE_URL, key, { auth: { persistSession: false } });
  const aliases = await readAll(db, 'song_slug_aliases', 'old_slug,songs(slug)', ['old_slug']);
  const redirects = buildRedirects(aliases);
  if (redirects.length > LIMIT) throw new Error(`${redirects.length} redirects exceeds ${LIMIT}; move to Vercel bulk redirects.`);

  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const same = JSON.stringify(config.redirects || []) === JSON.stringify(redirects);
  if (check) {
    if (!same) { console.error(`❌ vercel.json redirects are out of date (${redirects.length} aliases). Run npm run redirects:sync.`); process.exit(1); }
    console.log(`✓ ${redirects.length} redirects up to date.`); return;
  }
  const next = { cleanUrls: config.cleanUrls, trailingSlash: config.trailingSlash, redirects, ...Object.fromEntries(Object.entries(config).filter(([k]) => !['cleanUrls', 'trailingSlash', 'redirects'].includes(k))) };
  fs.writeFileSync('vercel.json', JSON.stringify(next, null, 2) + '\n');
  console.log(`${same ? 'No change:' : 'Wrote'} ${redirects.length} redirects to vercel.json.`);
}

main().catch(error => { console.error('❌', error.message); process.exit(1); });
