import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recentActivityIds } from './recentActivity.js';

test('recent activity merges public events, pages past repeated songs, and fails on read errors', async () => {
  const date = day => `2026-01-${String(day).padStart(2, '0')}T00:00:00Z`;
  const rows = {
    songs: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, created_at: date(i === 1 ? 8 : 1), updated_at: date(31) })),
    song_revisions: [{ id: 1, song_id: 3, revised_at: date(9) }],
    line_translations: [{ id: 1, song_id: 4, created_at: date(10) }],
    line_comments: [
      ...Array.from({ length: 105 }, (_, i) => ({ id: i + 1, song_id: 5, created_at: date(11) })),
      { id: 106, song_id: 6, created_at: date(7) },
    ],
    comments: [{ id: 1, song_id: 7, created_at: date(12) }, { id: 2, song_id: 4, created_at: date(13) }],
  };
  const requests = [];
  let failingTable;
  const client = { from(table) {
    assert.ok(Object.hasOwn(rows, table), `Unexpected activity source: ${table}`);
    const order = [];
    return {
      select(columns) {
        assert.equal(columns, table === 'songs' ? 'id,created_at' : `song_id,${table === 'song_revisions' ? 'revised_at' : 'created_at'}`);
        return this;
      },
      order(column, { ascending }) { assert.equal(ascending, false); order.push(column); return this; },
      async range(from, to) {
        requests.push([table, from]);
        if (table === failingTable) return { error: new Error('Activity unavailable') };
        const sorted = [...rows[table]].sort((a, b) => {
          for (const column of order) {
            if (a[column] !== b[column]) return a[column] < b[column] ? 1 : -1;
          }
          return 0;
        });
        return { data: sorted.slice(from, to + 1), error: null };
      },
    };
  } };
  assert.deepEqual(await recentActivityIds(client, 7), [4, 7, 5, 3, 2, 6, 1]);
  assert.ok(requests.some(([table, from]) => table === 'line_comments' && from === 100));
  assert.deepEqual(await recentActivityIds(client, 3), [4, 7, 5]);
  // Equal timestamps use song id as a stable tiebreaker.
  assert.deepEqual(await recentActivityIds({ from: table => table === 'songs' ? client.from(table) : {
    select() { return this; }, order() { return this; }, async range() { return { data: [] }; },
  } }, 4), [2, 7, 6, 5]);
  failingTable = 'line_translations';
  await assert.rejects(recentActivityIds(client, 7), /Activity unavailable/);
});
