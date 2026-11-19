import test from 'node:test';
import assert from 'node:assert/strict';
import { nestComments } from './commentThreads.js';

const row = (id, parent_id = null, created_at = '2026-11-18T00:00:00Z') => ({ id, parent_id, created_at, content: id });

test('three-level replies render under their exact parent independent of fetch order', () => {
  const root = row('root');
  const reply = row('reply', 'root');
  const grandchild = row('grandchild', 'reply');
  const great = row('great', 'grandchild');
  const thread = nestComments([great, grandchild, root, reply]);
  assert.equal(thread.length, 1);
  assert.equal(thread[0].replies[0].id, 'reply');
  assert.equal(thread[0].replies[0].replies[0].id, 'grandchild');
  assert.equal(thread[0].replies[0].replies[0].replies[0].id, 'great');
});

test('siblings have deterministic chronological order', () => {
  const children = [
    row('later', 'root', '2026-11-18T02:00:00Z'),
    row('earlier', 'root', '2026-11-18T01:00:00Z'),
    row('root')
  ];
  assert.deepEqual(nestComments(children)[0].replies.map(c => c.id), ['earlier', 'later']);
});

test('a missing parent becomes a visible root', () => {
  const [orphan] = nestComments([row('orphan', 'deleted-id')]);
  assert.equal(orphan.id, 'orphan');
});

test('self references and cycles cannot recurse indefinitely', () => {
  const result = nestComments([row('self', 'self'), row('one', 'two'), row('two', 'one')]);
  assert.equal(result.length, 3);
  assert.ok(result.every(r => Array.isArray(r.replies)));
});

test('empty rows have no roots', () => {
  assert.deepEqual(nestComments([]), []);
});
