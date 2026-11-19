/**
 * Pure comment-tree utilities. No scrolling, navigation, React or persistence.
 * Children are sorted in display order and every parent/child edge is retained.
 */
export function nestComments(comments = []) {
  const nodes = new Map(comments.map(comment => [comment.id, { ...comment, replies: [] }]));
  const roots = [];

  for (const node of nodes.values()) {
    const parent = nodes.get(node.parent_id);
    if (!parent || parent.id === node.id) {
      roots.push(node);
      continue;
    }
    const visited = new Set([node.id]);
    let ancestor = parent;
    let cyclic = false;
    while (ancestor) {
      if (visited.has(ancestor.id)) { cyclic = true; break; }
      visited.add(ancestor.id);
      ancestor = nodes.get(ancestor.parent_id);
    }
    if (cyclic) roots.push(node);
    else parent.replies.push(node);
  }

  const sort = (left, right) => {
    const diff = Date.parse(left.created_at || 0) - Date.parse(right.created_at || 0);
    return diff || String(left.id).localeCompare(String(right.id));
  };
  roots.sort(sort);
  for (const node of nodes.values()) node.replies.sort(sort);
  return roots;
}

/** A flat map of every visible tree node, including roots. */
export function indexComments(roots = []) {
  const index = new Map();
  const stack = [...roots].reverse();
  while (stack.length) {
    const node = stack.pop();
    index.set(node.id, node);
    const children = node.replies || [];
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  return index;
}

/** All descendants in depth-first, sibling-display order. Excludes the anchor. */
export function flattenFocusedTraversal(anchor) {
  if (!anchor) return [];
  const items = [];
  const stack = (anchor.replies || []).map(node => ({ comment: node, logicalDepth: 0 })).reverse();
  while (stack.length) {
    const entry = stack.pop();
    items.push(entry);
    const children = entry.comment.replies || [];
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ comment: children[i], logicalDepth: entry.logicalDepth + 1 });
    }
  }
  return items;
}

export function getDescendants(anchor) {
  return flattenFocusedTraversal(anchor).map(entry => entry.comment);
}

export function countDescendants(replies = []) {
  // Iterative so a long thread cannot overflow the JS call stack.
  let count = 0;
  const stack = [...replies];
  while (stack.length) {
    const node = stack.pop();
    count++;
    stack.push(...(node.replies || []));
  }
  return count;
}

/** Root itself is depth zero; a leaf therefore has descendant depth zero. */
export function getMaxDescendantDepth(anchor) {
  if (!anchor) return 0;
  let max = 0;
  for (const { logicalDepth } of flattenFocusedTraversal(anchor)) max = Math.max(max, logicalDepth + 1);
  return max;
}

/** A non-mutating depth-limited tree; level 1 is the root. */
export function getVisibleSubtree(root, levels) {
  if (!root || !Number.isInteger(levels) || levels < 1) return null;
  return {
    ...root,
    replies: levels === 1 ? [] : (root.replies || []).map(child => getVisibleSubtree(child, levels - 1)),
  };
}

/** A stable path of ancestor IDs, inclusive of the requested comment. */
export function getCommentPath(roots, id) {
  const parents = new Map();
  const stack = [...roots].map(comment => ({ comment, parent: null }));
  while (stack.length) {
    const { comment, parent } = stack.pop();
    parents.set(comment.id, parent);
    if (comment.id === id) {
      const path = [id];
      let next = parent;
      while (next != null) { path.unshift(next); next = parents.get(next); }
      return path;
    }
    for (const child of comment.replies || []) stack.push({ comment: child, parent: comment.id });
  }
  return [];
}

/** Initial visible levels count the root as level one. */
export function shouldContinueThread(depth, maxDepth, replies = []) {
  return Number.isInteger(maxDepth) && maxDepth > 0 && depth + 1 >= maxDepth && replies.length > 0;
}

/**
 * A deleted parent can be represented as a tombstone for the current session
 * using the previous fetch. FK ON DELETE SET NULL clears the stored link, so
 * an entirely fresh page load cannot recover the old ancestry without a DB
 * change. This helper never changes stored data.
 */
export function retainDeletedParents(previous = [], current = []) {
  if (!previous.length || !current.length) return current;
  const prior = new Map(previous.map(comment => [comment.id, comment]));
  const present = new Map(current.map(comment => [comment.id, comment]));
  const result = current.map(comment => {
    const old = prior.get(comment.id);
    if (old?.parent_id && !comment.parent_id && !present.has(old.parent_id)) {
      return { ...comment, parent_id: old.parent_id };
    }
    return comment;
  });
  const linked = new Map(result.map(comment => [comment.id, comment]));
  const pending = [...result];
  while (pending.length) {
    const comment = pending.pop();
    const parentId = comment.parent_id;
    if (!parentId || linked.has(parentId) || !prior.has(parentId)) continue;
    const old = prior.get(parentId);
    const tombstone = {
      ...old, parent_id: old.parent_id, user_id: null, profiles: null,
      content: '[Deleted comment]', deleted: true, votes: 0,
    };
    linked.set(parentId, tombstone);
    result.push(tombstone);
    pending.push(tombstone);
  }
  return result;
}
