/**
 * CN Lyric Hub — RLS policy verifier
 *
 * Probes the REST API the way an attacker would rather than through the app,
 * because the UI only ever sends well-formed requests and therefore proves
 * nothing about authorization.
 *
 * Non-destructive: every mutable target is a newly created probe row.
 * Cleanup uses exact returned IDs and verifies that no probe rows remain.
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
  const rows = [];
  const users = [];
  const marker = `ZZ_PROBE_${Date.now()}_${require('crypto').randomUUID()}`;
  const insert = async (table, options) => {
    const result = await rq(table, { ...options, method: 'POST', prefer: 'return=representation' });
    if (result.status >= 200 && result.status < 300) {
      const data = JSON.parse(result.text);
      if (!data[0]?.id) throw new Error(`Missing probe id from ${table}`);
      rows.push({ table, id: data[0].id });
    }
    return result;
  };
  const session = async () => {
    const response = await fetch(`${URL}/auth/v1/signup`, {
      method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: '{}',
    });
    const data = await response.json();
    if (data.user?.id) users.push(data.user.id);
    if (!response.ok || !data.access_token) throw new Error('Could not create probe session');
    return data;
  };
  try {
    const made = await insert('songs', {
      key: SVC, body: { title_en: marker, artist_en: marker, source: 'import', slug: marker, lyrics_chinese: 'x' },
    });
    if (made.status !== 201) throw new Error('Could not create probe song');
    const probe = JSON.parse(made.text)[0];
    const visitor = await session();
    const jwt = visitor.access_token;
    const uid = visitor.user.id;
    const otherSession = await session();
    const other = otherSession.user;
    // Even cross-user tests target only disposable content.
    const translation = await insert('line_translations', { key: SVC,
      body: { song_id: probe.id, line_index: 0, content: marker, user_id: other.id } });
    const comment = await insert('line_comments', { key: SVC,
      body: { song_id: probe.id, line_index: 0, content: marker, user_id: other.id } });
    if (translation.status !== 201 || comment.status !== 201) throw new Error('Could not create probe contributions');
    const translationId = JSON.parse(translation.text)[0].id;
    const commentId = JSON.parse(comment.text)[0].id;
    const fakeSong = await rq(`songs?select=id&id=eq.${FAKE_SONG}`, { key: SVC });
    if (fakeSong.status !== 200 || fakeSong.text.trim() !== '[]') throw new Error('FK probe id is not safely absent');

    console.log('\nsongs');
    check('anon CAN read songs',
      (await rq('songs?select=id&limit=1')).status === 200, 'public read is expected');

    let r = await rq(`songs?id=eq.${probe.id}`, {
      method: 'PATCH', prefer: 'return=representation', body: { lyrics_chinese: 'VERIFY' } });
    check('anon CANNOT update songs', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await insert('songs', { body: { title_en: marker, artist_en: marker, source: 'import' } });
    check('anon CANNOT insert songs', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    // An anonymous Supabase session holds the Postgres role `authenticated`, so
    // "authenticated" never meant "has a real account". This is the hole that let
    // a throwaway session rewrite the whole catalogue.
    r = await rq(`songs?id=eq.${probe.id}`, { jwt, method: 'PATCH',
      prefer: 'return=representation', body: { lyrics_chinese: 'VERIFY_ANON' } });
    check('anonymous session CANNOT update songs', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await insert('songs', { jwt, body: { title_en: marker, artist_en: marker } });
    check('anonymous session CANNOT insert songs', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    // The review path must keep working for everyone, or non-admins lose the
    // ability to suggest anything at all.
    r = await insert('song_submissions', { jwt,
      body: { title_en: marker, artist_en: marker, status: 'pending', user_id: uid } });
    check('anyone CAN still submit for review', allowed(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    console.log('\ntranslation vote counts');
    const firstVote = await insert('line_votes', { jwt,
      body: { song_id: probe.id, line_index: 0, translation_id: translationId, user_id: uid } });
    const secondVote = await insert('line_votes', { jwt: otherSession.access_token,
      body: { song_id: probe.id, line_index: 0, translation_id: translationId, user_id: other.id } });
    const counted = await rq(`line_translations?select=line_votes(count)&id=eq.${translationId}`);
    check('translation count includes both voters', firstVote.status === 201 && secondVote.status === 201 &&
      counted.status === 200 && JSON.parse(counted.text)[0]?.line_votes[0]?.count === 2, counted.text);
    r = await rq(`line_translations?id=eq.${translationId}`, { jwt: otherSession.access_token,
      method: 'PATCH', prefer: 'return=representation', body: { votes: 999999 } });
    check('author CANNOT overwrite translation vote counter', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

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
    r = await rq(`line_translations?id=eq.${translationId}`, { jwt, method: 'PATCH',
      prefer: 'return=representation', body: { content: 'PWNED' } });
    check('user CANNOT edit another user translation', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);

    r = await rq(`line_comments?id=eq.${commentId}`, { jwt, method: 'DELETE',
      prefer: 'return=representation' });
    check('user CANNOT delete another user comment', blocked(r), `got ${r.status} ${r.text.slice(0, 120)}`);
  } catch (error) {
    check('probe setup/execution completed', false, error.message);
  } finally {
    for (const { table, id } of rows.reverse()) {
      const removed = await rq(`${table}?id=eq.${id}`, { key: SVC, method: 'DELETE' });
      const remaining = await rq(`${table}?select=id&id=eq.${id}`, { key: SVC });
      check(`cleanup ${table} ${id}`, removed.status < 300 && remaining.status === 200 && remaining.text.trim() === '[]',
        `Could not confirm cleanup of ${table} ${id}`);
    }
    for (const uid of users.reverse()) {
      await rq(`profiles?id=eq.${uid}`, { key: SVC, method: 'DELETE' });
      const headers = { apikey: SVC, Authorization: `Bearer ${SVC}` };
      const removed = await fetch(`${URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers });
      const remaining = await fetch(`${URL}/auth/v1/admin/users/${uid}`, { headers });
      const profile = await rq(`profiles?select=id&id=eq.${uid}`, { key: SVC });
      check(`cleanup user ${uid}`, removed.ok && remaining.status === 404 && profile.status === 200 && profile.text.trim() === '[]',
        `Could not confirm cleanup of probe user ${uid}`);
    }
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
