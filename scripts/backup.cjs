#!/usr/bin/env node
/**
 * Dumps every table to one timestamped JSON file in ./backups/.
 *
 * The database is the only copy of all user-generated content: the corpus in
 * ~/Downloads/Chinese_Lyrics/ can restore imported `lyrics_chinese` and nothing
 * else — not the user-submitted songs, community translations, comments, likes,
 * curated English, script-backfilled covers/years, or edit history.
 *
 * ⚠️ WHAT THIS IS NOT: it is not pg_dump. It saves row DATA only — no schema, no
 * indexes, no RLS policies, no triggers, no password hashes. Those live in
 * supabase/migrations/, which is why data alone is enough to rebuild. Restoring
 * means: create the project, apply the migrations, then insert these rows.
 * Users would have to sign in again (auth is exported without credentials).
 *
 * ⚠️ Never trust a backup that didn't verify. Every table's row count is read
 * from the server first and compared against what was actually written; any
 * mismatch aborts with a non-zero exit rather than leaving a short file that
 * looks complete. A partial backup is worse than no backup, because you stop
 * worrying about it.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ quiet: true });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Every table with data worth keeping. Ordered parent-first, so a restore can
// insert them top to bottom without tripping a foreign key.
const TABLES = [
  'profiles', 'artists', 'songs', 'song_artists', 'song_revisions',
  'song_submissions', 'song_likes', 'line_translations', 'line_comments',
  'comments', 'line_votes', 'comment_votes', 'comment_likes',
];

const PAGE = 1000; // PostgREST caps every response at 1000 rows regardless of limit

async function dumpTable(table) {
  const { count, error: countError } = await supabase
    .from(table).select('*', { count: 'exact', head: true });
  if (countError) throw new Error(`${table}: count failed — ${countError.message}`);

  const rows = [];
  for (let from = 0; from < (count || 0); from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: read failed at offset ${from} — ${error.message}`);
    rows.push(...data);
  }

  // The whole point of the script. A short table means the dump is a lie.
  if (rows.length !== (count || 0)) {
    throw new Error(`${table}: expected ${count} rows, got ${rows.length} — backup aborted`);
  }
  return rows;
}

// Every user id the dumped rows point at: profiles.id plus any user_id column.
async function referencedUsers(data, toRecord) {
  const ids = new Set((data.profiles || []).map((row) => row.id));
  for (const rows of Object.values(data)) for (const row of rows) if (row.user_id) ids.add(row.user_id);
  const found = [];
  for (const id of ids) {
    const { data: result, error } = await supabase.auth.admin.getUserById(id);
    if (error && error.status === 404) found.push({ id, missing: true });
    // A malformed auth row ("Database error loading user") can't be read by any API call. Keep its id,
    // which is all content ownership needs, and say so loudly. Anything else (network, auth) still aborts.
    else if (error && /^Database error/.test(error.message)) {
      console.warn(`  ⚠️  auth user ${id} is unreadable (${error.message}); saved id only`);
      found.push({ id, unreadable: true, error: error.message });
    } else if (error) throw new Error(`auth.users ${id}: ${error.message}`);
    else found.push(toRecord(result.user));
  }
  return found;
}

(async () => {
  const started = new Date();
  const data = {};
  let total = 0;

  for (const table of TABLES) {
    const rows = await dumpTable(table);
    data[table] = rows;
    total += rows.length;
    console.log(`  ${String(rows.length).padStart(6)}  ${table}`);
  }

  // Ids and emails only — no password hashes exist over this API, so restored
  // users must sign in again. Exported because profiles and every contribution
  // FK to auth.users: without these ids you cannot tell who owned what.
  const toRecord = (u) => ({
    id: u.id, email: u.email, created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at, is_anonymous: u.is_anonymous,
    provider: u.app_metadata?.provider,
  });
  let authSource = 'listUsers (all users)';
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (!authError) {
    data.auth_users = authData.users.map(toRecord);
    if (data.auth_users.length === 1000) console.warn('  ⚠️  hit the 1000-user page cap — paginate before trusting this');
  } else {
    // GoTrue's list endpoint can fail on one malformed auth row ("Database error finding users")
    // even at perPage=1. Single-user lookup still works, so export every user the backed-up
    // content references. Anonymous sessions that own nothing are not needed to restore ownership.
    console.warn(`  ⚠️  listUsers failed (${authError.message}); exporting referenced users via getUserById`);
    data.auth_users = await referencedUsers(data, toRecord);
    authSource = `getUserById for ${data.auth_users.length} users referenced by content (listUsers failed: ${authError.message})`;
  }
  console.log(`  ${String(data.auth_users.length).padStart(6)}  auth.users (no credentials; ${authSource})`);

  const dir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${started.toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({
    generated_at: started.toISOString(),
    project_url: url,
    auth_users_source: authSource,
    note: 'Row data only — no schema. Apply supabase/migrations/ first, then insert these tables in key order.',
    tables: data,
  }, null, 2));

  const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ ${total} content rows + ${data.auth_users.length} users → backups/${path.basename(file)} (${mb} MB)`);
  console.log('   Copy it somewhere that is not this laptop.');
})().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
