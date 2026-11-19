/**
 * Build a real comment forest, regardless of the order returned by PostgREST.
 * Missing/deleted parents become roots so orphaned replies never disappear.
 * A cycle guard avoids infinite recursion if malformed historical rows exist.
 */
export function nestComments(comments = []) {
  const nodes = new Map(
    comments.map(comment => [comment.id, { ...comment, replies: [] }])
  );
  const roots = [];

  for (const node of nodes.values()) {
    const parent = nodes.get(node.parent_id);
    if (!parent || parent.id === node.id) {
      roots.push(node);
      continue;
    }

    // Parent links should form a DAG; avoid hiding whole conversations on
    // malformed imports or circular references.
    const visited = new Set([node.id]);
    let ancestor = parent;
    let cyclic = false;
    while (ancestor) {
      if (visited.has(ancestor.id)) {
        cyclic = true;
        break;
      }
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
