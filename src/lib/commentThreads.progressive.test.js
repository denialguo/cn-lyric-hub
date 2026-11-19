import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nestComments, indexComments, flattenFocusedTraversal, getDescendants,
  countDescendants, getMaxDescendantDepth, getVisibleSubtree,
  getCommentPath, shouldContinueThread, retainDeletedParents,
} from './commentThreads.js';

const makeRow = (id, parent_id = null, rank = 0) => ({
  id, parent_id, content: id,
  created_at: new Date(1794950000000 + rank * 1000).toISOString(),
});

const makeChain = (length) => Array.from({ length }, (_, i) =>
  makeRow('n' + i, i === 0 ? null : 'n' + (i - 1), i));

test('a 12-level chain remains traversable with unlimited logical depth', () => {
  const [root] = nestComments(makeChain(12).reverse());
  assert.equal(getMaxDescendantDepth(root), 11);
  const rows = flattenFocusedTraversal(root);
  assert.equal(rows.length, 11);
  assert.deepEqual(rows.map(entry => entry.comment.id), Array.from({ length: 11 }, (_, i) => 'n' + (i + 1)));
  assert.deepEqual(rows.map(entry => entry.logicalDepth), Array.from({ length: 11 }, (_, i) => i));
  assert.deepEqual(rows.slice(0, 5).map(entry => entry.comment.id), ['n1', 'n2', 'n3', 'n4', 'n5']);
  assert.deepEqual(rows.slice(5, 10).map(entry => entry.comment.id), ['n6', 'n7', 'n8', 'n9', 'n10']);
  assert.equal(rows.slice(10).length, 1);
});

test('20 direct siblings do not count as a deeply nested thread', () => {
  const children = Array.from({ length: 20 }, (_, i) => makeRow('c' + i, 'root', i + 1));
  const [root] = nestComments([makeRow('root'), ...children.reverse()]);
  assert.equal(countDescendants(root.replies), 20);
  assert.equal(getMaxDescendantDepth(root), 1);
  assert.equal(shouldContinueThread(0, 3, root.replies), false);
  assert.deepEqual(flattenFocusedTraversal(root).slice(0, 5).map(entry => entry.comment.id),
    ['c0', 'c1', 'c2', 'c3', 'c4']);
});

test('a two-level expansion is scoped to the clicked branch', () => {
  const [root] = nestComments(makeChain(8));
  assert.equal(shouldContinueThread(2, 3, root.replies), true);
  const initial = getVisibleSubtree(root, 3);
  const expanded = getVisibleSubtree(root, 5);
  assert.equal(getMaxDescendantDepth(initial), 2);
  assert.equal(getMaxDescendantDepth(expanded), 4);
  assert.equal(getMaxDescendantDepth(root), 7);
  assert.equal(shouldContinueThread(4, 5, [root]), true);
  assert.equal(shouldContinueThread(2, 3, []), false);
  assert.equal(shouldContinueThread(1, 2, [root]), true);
});

test('depth-first traversal preserves sibling display order', () => {
  const rows = [
    makeRow('root'),
    makeRow('a', 'root', 1),
    makeRow('a1', 'a', 2),
    makeRow('b', 'root', 3),
    makeRow('b1', 'b', 4),
  ];
  const [root] = nestComments([rows[4], rows[2], rows[3], rows[0], rows[1]]);
  assert.deepEqual(getDescendants(root).map(c => c.id), ['a', 'a1', 'b', 'b1']);
  assert.equal(indexComments([root]).get('b1').parent_id, 'b');
  assert.deepEqual(getCommentPath([root], 'b1'), ['root', 'b', 'b1']);
});

test('deleting a parent yields a tombstone preserving child and grandchild', () => {
  const before = [
    makeRow('root'),
    makeRow('reply', 'root', 1),
    makeRow('grandchild', 'reply', 2),
  ];
  // ON DELETE SET NULL clears reply.parent_id in the database.
  const after = [
    makeRow('reply', null, 1),
    makeRow('grandchild', 'reply', 2),
  ];
  const retained = retainDeletedParents(before, after);
  const tombstone = retained.find(c => c.id === 'root');
  assert.ok(tombstone);
  assert.equal(tombstone.deleted, true);
  assert.equal(tombstone.content, '[Deleted comment]');
  assert.equal(tombstone.user_id, null);
  assert.equal(retained.find(c => c.id === 'reply').parent_id, 'root');
  const [tree] = nestComments(retained);
  assert.equal(tree.replies[0].replies[0].id, 'grandchild');

  // Repeated refetches must keep the tree intact.
  const twice = retainDeletedParents(retained, after);
  assert.equal(twice.filter(c => c.id === 'root').length, 1);
  assert.deepEqual(getCommentPath(nestComments(twice), 'grandchild'), ['root', 'reply', 'grandchild']);
});

test('deleting an ancestor while focused preserves deeper ancestry', () => {
  const original = makeChain(6);
  const withoutAncestor = original.filter(c => c.id !== 'n2').map(c =>
    c.id === 'n3' ? { ...c, parent_id: null } : c);
  const recovered = retainDeletedParents(original, withoutAncestor);
  assert.deepEqual(getCommentPath(nestComments(recovered), 'n5'),
    ['n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
  assert.ok(recovered.find(c => c.id === 'n2')?.deleted);
});

test('a focused comment without remaining descendants does not fabricate replies', () => {
  const [tree] = nestComments([makeRow('root')]);
  assert.deepEqual(flattenFocusedTraversal(tree), []);
  assert.equal(getMaxDescendantDepth(tree), 0);
});

test('unrelated comments are not rewritten as tombstones', () => {
  const prior = [makeRow('old'), makeRow('oldchild', 'old')];
  const current = [makeRow('fresh')];
  assert.deepEqual(retainDeletedParents(prior, current), current);
});
