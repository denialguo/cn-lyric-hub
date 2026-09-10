import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmLineEdit } from './lineEdits.js';

test('line edits warn with exact counts, respect cancellation, and fail closed', async () => {
  const calls = [];
  const results = {
    songs: { data: { lyrics_chinese: '一\n二' } },
    line_translations: { count: 4 },
    line_comments: { count: 7 },
  };
  const db = { from(table) {
    calls.push(table);
    return { select() { return this; }, eq(column, id) {
      assert.equal(id, 391);
      assert.equal(column, table === 'songs' ? 'id' : 'song_id');
      return table === 'songs' ? { single: async () => results[table] } : Promise.resolve(results[table]);
    } };
  } };
  let message;
  const cancel = async text => { message = text; return false; };
  assert.equal(await confirmLineEdit(db, null, '一', cancel), true);
  assert.equal(calls.length, 0);
  assert.equal(await confirmLineEdit(db, 391, '一\n二', cancel), true);
  assert.deepEqual(calls, ['songs']);
  assert.equal(message, undefined);
  assert.equal(await confirmLineEdit(db, 391, '一\n二\n三', cancel), false);
  assert.match(message, /4 community translations and 7 line comments/);
  assert.equal(await confirmLineEdit(db, 391, '一', async () => true), true);
  results.line_translations = { count: 0 };
  results.line_comments = { count: 0 };
  assert.equal(await confirmLineEdit(db, 391, '一', () => assert.fail('unnecessary warning')), true);
  results.line_comments = { error: new Error('count unavailable') };
  await assert.rejects(confirmLineEdit(db, 391, '一', cancel), /count unavailable/);
  results.songs = { error: new Error('song unavailable') };
  await assert.rejects(confirmLineEdit(db, 391, '一', cancel), /song unavailable/);
});
