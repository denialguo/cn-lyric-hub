#!/usr/bin/env node
/**
 * Apply reports/slug-map.json (from generate-slug-map.mjs) to songs.slug.
 *
 *   npm run migrate:slugs                  dry run (default): validates, prints a summary, writes nothing
 *   npm run migrate:slugs -- --write --baseline backups/<file>.json
 *                                          update songs.slug, one song at a time. --baseline is REQUIRED: a full backup
 *                                          taken after the last data repair; every song row must still match it exactly
 *   npm run migrate:slugs -- --rollback    with --write: restore the old slugs from the same map
 *
 * Only songs.slug is written, and each update is guarded by .eq('slug', <expected current slug>) so a
 * song edited since the map was built is skipped, not clobbered. The songs_record_slug_alias trigger
 * (migration 20261120000000) records every old slug; without that table this script refuses to write.
 * Take `npm run backup` first and pass it as --baseline. reports/slug-migration.json lists every change and is the rollback record.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { readAll } = require('./read-all.cjs');

const MAP = path.join('reports', 'slug-map.json');
const REPORT = path.join('reports', 'slug-migration.json');
const BACKUP_NAME = /^\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/;
const ALIAS_COLUMNS = 'old_slug,song_id,created_at';

/** A real SELECT of the alias table's columns (a HEAD request reports no error for a missing table). */
async function assertAliasTable(db) {
  const { data, error } = await db.from('song_slug_aliases').select(ALIAS_COLUMNS).limit(1);
  if (error) throw new Error(`song_slug_aliases is not usable (${error.message}). Apply migration 20261120000000 first.`);
  if (!Array.isArray(data)) throw new Error('song_slug_aliases SELECT returned no rows array; refusing to write.');
}

/** Problems (empty = ok) between a full backup's songs table and the live rows. Every column must match. */
function baselineProblems(backupSongs, liveSongs) {
  const problems = [];
  if (!Array.isArray(backupSongs)) return ['baseline has no songs table'];
  if (backupSongs.length !== liveSongs.length) problems.push(`baseline has ${backupSongs.length} songs, live has ${liveSongs.length}`);
  const byId = new Map(backupSongs.map(row => [Number(row.id), row]));
  for (const live of liveSongs) {
    const base = byId.get(Number(live.id));
    if (!base) { problems.push(`#${live.id} is not in the baseline`); continue; }
    const columns = new Set([...Object.keys(base), ...Object.keys(live)]);
    const differing = [...columns].filter(c => JSON.stringify(base[c]) !== JSON.stringify(live[c]));
    if (differing.length) problems.push(`#${live.id} differs from the baseline in: ${differing.join(', ')}`);
  }
  return problems;
}

function loadBaseline(file) {
  if (!file) throw new Error('--write needs --baseline backups/<timestamp>.json (a full `npm run backup` taken after the last data repair).');
  if (!BACKUP_NAME.test(path.basename(file))) throw new Error(`${file} is not a full backup (expected backups/<timestamp>.json).`);
  return JSON.parse(fs.readFileSync(file, 'utf8')).tables?.songs;
}

function argValue(name) {
  const i = process.argv.findIndex(a => a === name || a.startsWith(`${name}=`));
  if (i < 0) return null;
  return process.argv[i].includes('=') ? process.argv[i].split('=').slice(1).join('=') : process.argv[i + 1] ?? null;
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
  const baselineArg = argValue('--baseline');
  if (!write && baselineArg && !rollback) {
    const issues = baselineProblems(loadBaseline(baselineArg), await readAll(db, 'songs', '*', ['id']));
    console.log(issues.length ? `Baseline ${baselineArg}: ✗ ${issues.length} problems (first: ${issues[0]})` : `Baseline ${baselineArg}: ✓ matches all live song rows exactly`);
    if (issues.length) { process.exitCode = 1; return; }
  }
  if (!write) { console.log('\nDry run: nothing was written. Pass --write --baseline <backup> to apply.'); return; }

  if (!rollback) await assertAliasTable(db);
  // A rollback is the escape hatch back to the old slugs, so it cannot require live data to equal a pre-migration backup.
  const baselineFile = rollback ? null : argValue('--baseline');
  if (!rollback) {
    const liveFull = await readAll(db, 'songs', '*', ['id']);
    const baselineIssues = baselineProblems(loadBaseline(baselineFile), liveFull);
    if (baselineIssues.length) {
      baselineIssues.slice(0, 10).forEach(p => console.error(`  ✗ ${p}`));
      throw new Error(`Live songs do not match the baseline ${baselineFile} (${baselineIssues.length} problems). Take a new \`npm run backup\` and pass that.`);
    }
    console.log(`Baseline OK: ${baselineFile} matches all ${liveFull.length} live song rows exactly.`);
  }

  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify({ generated_at: new Date().toISOString(), rollback, baseline: baselineFile, changes: todo }, null, 1));
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

if (require.main === module) main().catch(error => { console.error('❌ Slug migration failed:', error.message); process.exit(1); });

module.exports = { assertAliasTable, baselineProblems, loadBaseline };
