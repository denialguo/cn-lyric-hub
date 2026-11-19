#!/usr/bin/env node
/**
 * Build reports/slug-map.json: the reviewed default slug for every song, with scripts/slug-overrides.json
 * on top. READ-ONLY (reads songs, writes only the report). The Japanese/Korean tooling is NOT a project
 * dependency; install it somewhere outside the repo and point SLUGTOOL_DIR at it:
 *   cd /some/dir && npm i kuroshiro kuroshiro-analyzer-kuromoji hangul-romanization
 *   SLUGTOOL_DIR=/some/dir node scripts/generate-slug-map.mjs
 * Title language is inferred from script (kana -> ja, Hangul -> ko, Latin -> en, else zh); the override map
 * is where mixed or misclassified titles are settled by hand.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { tify } from 'chinese-conv';
import { assignSlugs, titleLanguage, romanizeTitle } from '../src/lib/slugs.js';

const require = createRequire(import.meta.url);
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { readAll } = require('./read-all.cjs');

const tools = createRequire(path.join(process.env.SLUGTOOL_DIR || process.cwd(), 'x.js'));
const Kuroshiro = tools('kuroshiro').default || tools('kuroshiro');
const Analyzer = tools('kuroshiro-analyzer-kuromoji');
const hangul = tools('hangul-romanization');
const kuro = new Kuroshiro();
await kuro.init(new Analyzer());

const tools_ = {
  ja: title => kuro.convert(tify(title), { to: 'romaji', romajiSystem: 'hepburn', mode: 'spaced' }),
  ko: title => (hangul.convert || hangul)(title),
};

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const songs = await readAll(db, 'songs', 'id,slug,title_zh,title_en,artist_en,artist_zh', ['id']);
const overrides = JSON.parse(fs.readFileSync(path.join('scripts', 'slug-overrides.json'), 'utf8'));
const rows = [];
for (const s of songs) {
  const original = (s.title_en || s.title_zh || '').normalize('NFC').trim();
  const language = titleLanguage(original);
  rows.push({ id: s.id, artist: s.artist_en || s.artist_zh, title: original ? await romanizeTitle(original, language, tools_) : '', original, language, old: s.slug });
}
const assigned = assignSlugs(rows, overrides);
const map = rows.map(r => ({
  id: r.id, artist: r.artist, original_title: r.original, title_language: r.language, romanized_title: r.title,
  old: r.old, new: assigned.get(r.id).slug, source: assigned.get(r.id).source, collided: assigned.get(r.id).collided,
}));
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(path.join('reports', 'slug-map.json'), JSON.stringify(map, null, 1));
console.log(`${map.length} songs, ${map.filter(m => m.source === 'override').length} overrides, ${map.filter(m => m.collided).length} suffixed. Wrote reports/slug-map.json`);
