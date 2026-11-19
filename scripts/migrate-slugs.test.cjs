const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertAliasTable, baselineProblems, loadBaseline } = require('./migrate-slugs.cjs');

// A fake supabase client whose select() resolves to whatever the case needs.
const dbReturning = result => ({ from: table => { assert.equal(table, 'song_slug_aliases'); return { select: columns => { assert.equal(columns, 'old_slug,song_id,created_at'); return { limit: async () => result }; } }; } });

test('alias guard needs a real successful SELECT of the expected columns', async () => {
  await assert.rejects(assertAliasTable(dbReturning({ data: null, error: { message: "Could not find the table 'public.song_slug_aliases'" } })), /not usable/);
  await assert.rejects(assertAliasTable(dbReturning({ data: null, error: null })), /no rows array/);   // what a HEAD-style miss looks like
  await assert.rejects(assertAliasTable(dbReturning({ data: null, error: { message: 'column song_slug_aliases.created_at does not exist' } })), /not usable/);
  await assert.doesNotReject(assertAliasTable(dbReturning({ data: [], error: null })));
});

test('baseline must match every live column exactly', () => {
  const base = [{ id: 1, slug: 'a', updated_at: 't1', tags: ['x'] }, { id: 2, slug: 'b', updated_at: 't2', tags: [] }];
  assert.deepEqual(baselineProblems(base, JSON.parse(JSON.stringify(base))), []);
  assert.match(baselineProblems(base, [{ ...base[0], updated_at: 't9' }, base[1]])[0], /#1 differs.*updated_at/);   // the incident: timestamps drifted
  assert.match(baselineProblems(base, [base[0]])[0], /baseline has 2 songs, live has 1/);
  assert.match(baselineProblems(base, [base[0], { id: 3 }]).join(), /#3 is not in the baseline/);
  assert.deepEqual(baselineProblems(undefined, []), ['baseline has no songs table']);
});

test('baseline file must be a full timestamped backup, and --write demands one', () => {
  assert.throws(() => loadBaseline(null), /needs --baseline/);
  assert.throws(() => loadBaseline('backups/songs-784-941-1795069000181.json'), /not a full backup/);
});
