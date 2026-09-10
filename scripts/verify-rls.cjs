/**
 * CN Lyric Hub — RLS policy verifier
 *
 * Probes the REST API the way an attacker would rather than through the app,
 * because the UI only ever sends well-formed requests and therefore proves
 * nothing about authorization.
 *
 * Non-destructive: writes are either no-ops (a field set to its current value),
 * deliberate foreign-key violations, or made against a throwaway row that is
 * created and deleted with the service role.
 *
 * Reading the responses:
 *   200 + []            a USING clause hid the rows       → write blocked
 *   401 / 403 / 42501   a WITH CHECK clause rejected it   → write blocked
 *   23503 / 23505 / 23502  RLS ALLOWED it, a constraint stopped it
 *
 * Usage: node scripts/verify-rls.cjs     (exit 0 = all policies correct)
 */

const fs = require('fs');
require('dotenv').config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' });

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SVC) {
  console.error('❌ Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const FAKE_SONG = 999999999;      // bigint that cannot exist → FK violation
const FAKE_USER = '00000000-0000-0000-0000-0000000000ff';

async function rq(path, { key = ANON, jwt, method = 'GET', body, prefer } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${jwt || key}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, text: await res.text() };
}

const blocked = (r) =>
  r.status === 401 || r.status === 403 || r.text.includes('42501') || r.text.trim() === '[]';
const allowed = (r) =>
  (r.status >= 200 && r.status < 300 && r.text.trim() !== '[]') ||
  r.text.includes('23503') || r.text.includes('23505') || r.text.includes('23502');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n       ${detail}`); }
}

(async () => {
  // --- setup: a throwaway song so destructive probes never touch real data ---
  const made = await rq('songs', {
    key: SVC, method: 'POST', prefer: 'return=representation',
    body: { title_en: 'ZZ_RLS_VERIFY', artist_en: 'ZZ_RLS_VERIFY', source: 'import',
            slug: 'zz-rls-verify-' + Date.now(), lyrics_chinese: 'x' },
  });
  const probe = JSON.parse(made.text)[0];

  const others = JSON.parse((await rq('profiles?select=id,role&limit=1', { key: SVC })).text);
  const other = others[0];

  const session = await (await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: '{}',
  })).json();
  const jwt = session.access_token;
  const uid = session.user?.id;
  if (!jwt) { console.error('❌ could not create an anonymous session'); process.exit(1); }

  try {
    console.log('\nsongs');
    check('anon CAN read songs',
      (await rq('songs?select=id&limit=1')).status === 200, 'public read is expected');

    let r = await rq(`songs?id=eq.${probe.id}`, {
      method: 'PATCH', prefer: 'return=representation', body: { lyrics_chinese: 'VERIFY' } });
    check('anon CANNOT update songs', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await rq('songs', { method: 'POST', body: { title_en: 'ZZ', artist_en: 'ZZ', source: 'import' } });
    check('anon CANNOT insert songs', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    // An anonymous Supabase session holds the Postgres role `authenticated`, so
    // "authenticated" never meant "has a real account". This is the hole that let
    // a throwaway session rewrite the whole catalogue.
    r = await rq(`songs?id=eq.${probe.id}`, { jwt, method: 'PATCH',
      prefer: 'return=representation', body: { lyrics_chinese: 'VERIFY_ANON' } });
    check('anonymous session CANNOT update songs', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await rq('songs', { jwt, method: 'POST',
      body: { title_en: 'ZZ', artist_en: 'ZZ' } });
    check('anonymous session CANNOT insert songs', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    // The review path must keep working for everyone, or non-admins lose the
    // ability to suggest anything at all.
    r = await rq('song_submissions', { jwt, method: 'POST', prefer: 'return=representation',
      body: { title_en: 'ZZ_RLS_VERIFY_SUB', artist_en: 'ZZ_RLS_VERIFY_SUB', status: 'pending', user_id: uid } });
    check('anyone CAN still submit for review', allowed(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    console.log('\nprofiles');
    r = await rq(`profiles?id=eq.${uid}`, { jwt, method: 'PATCH',
      prefer: 'return=representation', body: { role: 'admin' } });
    const after = JSON.parse((await rq(`profiles?select=role&id=eq.${uid}`, { key: SVC })).text);
    check('user CANNOT escalate own role to admin', after[0]?.role !== 'admin',
      `role became ${JSON.stringify(after[0]?.role)} — PRIVILEGE ESCALATION`);

    r = await rq(`profiles?id=eq.${other.id}`, { jwt, method: 'PATCH',
      prefer: 'return=representation', body: { display_name: 'pwned' } });
    check('user CANNOT edit another profile', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    console.log('\ncommunity content (FK-guarded, nothing is really written)');
    r = await rq('line_translations', { jwt, method: 'POST',
      body: { song_id: FAKE_SONG, line_index: 0, content: 'x', user_id: other.id } });
    check('user CANNOT post a translation as someone else', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await rq('line_translations', { jwt, method: 'POST',
      body: { song_id: FAKE_SONG, line_index: 0, content: 'x', user_id: uid } });
    check('user CAN post their own translation', allowed(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await rq('song_likes', { jwt, method: 'POST', body: { song_id: FAKE_SONG, user_id: other.id } });
    check('user CANNOT forge a like as someone else', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await rq('song_likes', { method: 'POST', body: { song_id: FAKE_SONG, user_id: FAKE_USER } });
    check('anon CANNOT insert likes', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await rq('line_votes', { jwt, method: 'POST',
      body: { song_id: FAKE_SONG, line_index: 0, user_id: other.id } });
    check('user CANNOT forge a vote as someone else', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await rq('song_likes', { jwt, method: 'POST', body: { song_id: FAKE_SONG, user_id: uid } });
    check('user CAN like as themselves', allowed(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    // Anonymous visitors are meant to be able to like things — they just must not
    // be able to attribute the like to somebody else.
    r = await rq('song_likes', { jwt, method: 'POST', body: { song_id: FAKE_SONG, user_id: uid } });
    check('anonymous session CAN like as itself', allowed(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    // Cross-user edits/deletes of community content — these already pass, kept as
    // regression cover since nothing else asserts them.
    r = await rq(`line_translations?user_id=neq.${uid}`, { jwt, method: 'PATCH',
      prefer: 'return=representation', body: { content: 'PWNED' } });
    check('user CANNOT edit another user translation', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await rq(`line_comments?user_id=neq.${uid}`, { jwt, method: 'DELETE',
      prefer: 'return=representation' });
    check('user CANNOT delete another user comment', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);
  } finally {
    // --- teardown ---
    await rq(`songs?id=eq.${probe.id}`, { key: SVC, method: 'DELETE' });
    await rq('songs?title_en=eq.ZZ', { key: SVC, method: 'DELETE' });
    await rq('song_submissions?title_en=eq.ZZ_RLS_VERIFY_SUB', { key: SVC, method: 'DELETE' });
    await rq(`profiles?id=eq.${uid}`, { key: SVC, method: 'DELETE' });
    await fetch(`${URL}/auth/v1/admin/users/${uid}`, {
      method: 'DELETE', headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  }

  console.log(`\n${'='.repeat(46)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log(`${'='.repeat(46)}\n`);
  if (fail) {
    console.log('Apply the migrations in supabase/migrations/ in the Supabase SQL');
    console.log('editor (newest last), then re-run this script.\n');
  }
  process.exit(fail ? 1 : 0);
})();
