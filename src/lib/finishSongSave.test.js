import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finishSongSave } from './finishSongSave.js';

test('publication adds artists before cleanup and never reports success after a failed step', async () => {
  for (const failedStep of [null, 'link', 'cleanup', 'status']) {
    const calls = [];
    const result = step => {
      calls.push(step);
      return { error: failedStep === step ? new Error(`${step} failed`) : null };
    };
    const client = { from(table) {
      return {
        async upsert(rows) {
          assert.equal(table, 'song_artists');
          assert.deepEqual(rows, [{ song_id: 42, artist_id: 'artist-a' }]);
          return result('link');
        },
        delete() { assert.equal(table, 'song_artists'); return this; },
        update(value) {
          assert.equal(table, 'song_submissions');
          assert.deepEqual(value, { status: 'approved' });
          return this;
        },
        eq(column, value) {
          assert.equal(column, table === 'song_artists' ? 'song_id' : 'id');
          assert.equal(value, table === 'song_artists' ? 42 : 7);
          return this;
        },
        async not(column, operator, value) {
          assert.deepEqual([column, operator, value], ['artist_id', 'in', '(artist-a)']);
          return result('cleanup');
        },
        select() { return this; },
        async single() { return result('status'); },
      };
    } };
    const save = finishSongSave(client, 42, ['artist-a', 'artist-a'], 7);
    if (failedStep) await assert.rejects(save, new RegExp(`${failedStep} failed`));
    else await save;
    const steps = ['link', 'cleanup', 'status'];
    assert.deepEqual(calls, failedStep ? steps.slice(0, steps.indexOf(failedStep) + 1) : steps);
  }
  await assert.rejects(finishSongSave({}, 42, [], 7), /at least one artist/);
});
