#!/usr/bin/env node
/**
 * Apply reports/slug-map.json (from generate-slug-map.mjs) to songs.slug.
 *
 *   npm run migrate:slugs                  dry run (default): validates, prints a summary, writes nothing
 *   npm run migrate:slugs -- --write       update songs.slug, one song at a time
 *   npm run migrate:slugs -- --rollback    with --write: restore the old slugs from the same map
 *
 * Only songs.slug is written, and each update is guarded by .eq('slug', <expected current slug>) so a
 * song edited since the map was built is skipped, not clobbered. The songs_record_slug_alias trigger
 * (migration 20261120000000) records every old slug; without that table this script refuses to write.
 * Take `npm run backup` first. reports/slug-migration.json lists every change and is the rollback record.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { readAll } = require('./read-all.cjs');

const MAP = path.join('reports', 'slug-map.json');
const REPORT = path.join('reports', 'slug-migration.json');
const BACKUP_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Only a full backup counts (timestamped file with a songs table), not an ad-hoc row snapshot.
function recentBackup(songCount) {
  if (!fs.existsSync('backups')) return null;
  const files = fs.readdirSync('backups').filter(f => /^\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/.test(f))
    .map(f => ({ f, t: fs.statSync(path.join('backups', f)).mtimeMs })).sort((a, b) => b.t - a.t);
  if (!files[0] || Date.now() - files[0].t >= BACKUP_MAX_AGE_MS) return null;
  const backup = JSON.parse(fs.readFileSync(path.join('backups', files[0].f), 'utf8'));
  return backup.tables?.songs?.length === songCount ? files[0].f : null;
}

async function main() {
  const { validateSlugMap } = await import('../src/lib/slugs.js');
  const write = process.argv.includes('--write');
  const rollback = process.argv.includes('--rollback');
  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let map = JSON.parse(fs.readFileSync(MAP, 'utf8')).map(({ id, old, new: next }) => ({ id, old, new: next }));
  if (rollback) map = map.map(m => ({ id: m.id, old: m.new, new: m.old }));
  const songs = await readAll(db, 'songs', 'id,slug', ['id']);
  const problems = validateSlugMap(map, songs, { checkLength: !rollback });
  const current = new Map(songs.map(s => [s.id, s.slug]));
  const todo = map.filter(m => m.old !== m.new && current.get(m.id) === m.old);
  const done = map.filter(m => current.get(m.id) === m.new).length;

  console.log(`Slug migration (${write ? (rollback ? 'ROLLBACK WRITE' : 'WRITE') : 'dry run'})\n-----------------------`);
  console.log(`Songs in map:       ${map.length}\nAlready on new slug: ${done}\nTo change:           ${todo.length}\nProblems:            ${problems.length}`);
  problems.slice(0, 20).forEach(p => console.log(`  ✗ ${p}`));
  if (problems.length) { console.error('\n❌ Fix the problems above before writing.'); process.exitCode = 1; return; }
  if (!write) { console.log('\nDry run: nothing was written. Pass --write to apply.'); return; }

  // A GET (not HEAD): supabase-js reports no error for a HEAD against a missing table. A rollback needs no aliases.
  if (!rollback) {
    const { data: probe, error: tableError } = await db.from('song_slug_aliases').select('old_slug').limit(1);
    if (tableError || !Array.isArray(probe)) throw new Error(`song_slug_aliases is missing (${tableError?.message ?? 'no rows array returned'}). Apply migration 20261120000000 first.`);
  }
  const backup = recentBackup(songs.length);
  if (!backup) throw new Error('No full backup from the last 2 hours with the current song count. Run `npm run backup` first.');
  console.log(`Backup found: ${backup}`);

  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify({ generated_at: new Date().toISOString(), rollback, changes: todo }, null, 1));
  const written = [];
  for (const m of todo) {
    const { data, error } = await db.from('songs').update({ slug: m.new }).eq('id', m.id).eq('slug', m.old).select('id');
    if (error) { console.error(`❌ Stopped at #${m.id}: ${error.message}. ${written.length} written; the rest untouched.`); process.exitCode = 1; return; }
    if (!data?.length) { console.log(`Skipped #${m.id}: slug changed since the map was built`); continue; }
    written.push(m.id);
  }
  console.log(`Wrote ${written.length} slugs.`);

  const after = await readAll(db, 'songs', 'id,slug', ['id']);
  const aliasSet = rollback ? null : new Set((await readAll(db, 'song_slug_aliases', 'old_slug,song_id', ['old_slug'])).map(a => a.old_slug));
  const bad = todo.filter(m => after.find(s => s.id === m.id)?.slug !== m.new || (aliasSet && !aliasSet.has(m.old)));
  console.log(bad.length ? `❌ ${bad.length} songs failed verification: ${bad.map(m => m.id).join(', ')}` : rollback ? '✓ Verified: every changed song is back on its previous slug.' : '✓ Verified: every changed song has its new slug and its old slug as an alias.');
  if (bad.length) process.exitCode = 1;
  if (!rollback) console.log('Next: npm run redirects:sync, commit vercel.json, push.');
}

main().catch(error => { console.error('❌ Slug migration failed:', error.message); process.exit(1); });
