import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import CommentItem from './CommentItem';

/**
 * A Reddit-style thread viewer shared by song comments, lyric comments, and
 * translation discussions. Deep conversations open in place with their parent
 * shown for context, rather than continuously pushing content to the right.
 *
 * maxDepth is a number of visible comment LEVELS, including the parent:
 * 3 on desktop, 2 on mobile, and always 2 inside the narrow lyric sidebar.
 */
const ThreadedComments = ({
  roots, user, onReply, onDelete, showLike = true,
  onToggleLike, likedCommentIds, maxDepth,
}) => {
  const [narrow, setNarrow] = useState(false);
  const [focusPath, setFocusPath] = useState([]);
  const contentRef = useRef(null);

  useEffect(() => {
    if (maxDepth) return;
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [maxDepth]);

  const nodes = useMemo(() => {
    const index = new Map();
    const stack = [...roots];
    while (stack.length) {
      const node = stack.pop();
      index.set(node.id, node);
      stack.push(...(node.replies || []));
    }
    return index;
  }, [roots]);

  // If the focused comment is deleted, gracefully fall back to its last
  // available ancestor (or to the main discussion).
  const validPath = focusPath.filter(id => nodes.has(id));
  const focused = validPath.length ? nodes.get(validPath[validPath.length - 1]) : null;

  useEffect(() => {
    if (focusPath.length) {
      contentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusPath]);

  const visibleRoots = focused ? [focused] : roots;
  const visibleLevels = maxDepth || (narrow ? 2 : 3);

  return (
    <div ref={contentRef} className="min-w-0">
      {focused && (
        <div className="mb-4 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-3">
          <button type="button" aria-label="Back to previous discussion"
            onClick={() => setFocusPath(validPath.slice(0, -1))}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300">
            <ArrowLeft size={16} />
            {validPath.length === 1 ? 'Back to discussion' : 'Back to previous replies'}
          </button>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <MessageCircle size={13} />
            Continuing the thread with @{focused.profiles?.username || 'a community member'}
          </div>
        </div>
      )}
      <div className="space-y-4 min-w-0">
        {visibleRoots.map(root => (
          <CommentItem
            key={root.id}
            comment={root}
            user={user}
            onReply={onReply}
            onDelete={onDelete}
            showLike={showLike}
            onToggleLike={onToggleLike}
            likedCommentIds={likedCommentIds}
            depth={0}
            maxDepth={visibleLevels}
            onContinue={id => setFocusPath(previous => [...previous.filter(x => nodes.has(x)), id])}
          />
        ))}
      </div>
    </div>
  );
};

export default ThreadedComments;
