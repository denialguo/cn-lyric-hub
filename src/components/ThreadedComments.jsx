import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, ChevronDown } from 'lucide-react';
import CommentItem from './CommentItem';
import { flattenFocusedTraversal, getCommentPath, indexComments } from '../lib/commentThreads';

const FOCUS_BATCH_SIZE = 5;
const SIBLING_BATCH_SIZE = 3;

function findScrollContainer(element) {
  let node = element?.parentElement;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Controls navigation and presentation only; all tree operations are pure.
 * One browser history entry and one return snapshot per focused session.
 * Further focused navigation never pushes additional history entries.
 */
const ThreadedComments = ({
  roots = [], user, onReply, onDelete, showLike = true,
  onToggleLike, likedCommentIds, maxDepth, scopeKey, context,
  onRestoreContext,
}) => {
  const [narrow, setNarrow] = useState(false);
  const storedReturn = typeof window !== 'undefined' ? window.history.state?.cnlyricsCommentReturn : null;
  const storedScope = storedReturn?.scopeKey === scopeKey ? storedReturn : null;
  const [expandedDepthIds, setExpandedDepthIds] = useState(() => new Set(storedScope?.expandedThreadIds || []));
  const [collapsedIds, setCollapsedIds] = useState(() => new Set(storedScope?.collapsedThreadIds || []));
  const [siblingVisibleCounts, setSiblingVisibleCounts] = useState(() => new Map(storedScope?.siblingVisibleCounts || []));
  const [focusAnchorId, setFocusAnchorId] = useState(null);
  const [focusedCount, setFocusedCount] = useState(FOCUS_BATCH_SIZE);
  const contentRef = useRef(null);
  const returnSnapshotRef = useRef(null);
  const focusPathRef = useRef([]);
  const focusAnchorIdRef = useRef(null);
  const markerRef = useRef('cnlyrics-thread-' + Math.random().toString(36).slice(2));
  const pendingReplyRef = useRef(null);
  const fallbackDescendantsRef = useRef([]);
  const returnFromPopstateRef = useRef(null);

  const nodes = useMemo(() => indexComments(roots), [roots]);
  const visibleLevels = maxDepth || (narrow ? 2 : 3);

  useEffect(() => {
    if (maxDepth || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [maxDepth]);

  const toggleCollapsed = id => setCollapsedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const expandBranch = id => setExpandedDepthIds(prev => new Set([...prev, id]));
  const revealSiblings = id => setSiblingVisibleCounts(prev => {
    const next = new Map(prev);
    next.set(id, (next.get(id) || SIBLING_BATCH_SIZE) + SIBLING_BATCH_SIZE);
    return next;
  });

  const restoreScroll = snapshot => {
    if (!snapshot) return;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (snapshot.scrollContainer?.isConnected) {
        snapshot.scrollContainer.scrollTop = snapshot.containerScrollTop;
      }
      window.scrollTo({ top: snapshot.scrollY, left: 0, behavior: 'instant' });
      if (snapshot.activeElement?.isConnected && snapshot.activeElement.focus) {
        snapshot.activeElement.focus({ preventScroll: true });
      }
    }));
  };

  const exitFocus = () => {
    const snapshot = returnSnapshotRef.current;
    focusAnchorIdRef.current = null;
    setFocusAnchorId(null);
    setFocusedCount(FOCUS_BATCH_SIZE);
    if (snapshot) {
      setExpandedDepthIds(new Set(snapshot.expandedThreadIds));
      setCollapsedIds(new Set(snapshot.collapsedThreadIds));
      setSiblingVisibleCounts(new Map(snapshot.siblingVisibleCounts));
      onRestoreContext?.(snapshot.context);
    }
    returnSnapshotRef.current = null;
    focusPathRef.current = [];
    restoreScroll(snapshot);
  };
  returnFromPopstateRef.current = exitFocus;

  useEffect(() => {
    const onPopState = event => {
      if (focusAnchorIdRef.current && event.state?.cnlyricsCommentFocus !== markerRef.current) {
        returnFromPopstateRef.current?.();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // A new lyric line/song has a different component scope. Do not retain the
  // previous line's focus or tree expansion states.
  const previousScopeRef = useRef(scopeKey);
  useEffect(() => {
    if (previousScopeRef.current === scopeKey) return;
    previousScopeRef.current = scopeKey;
    focusAnchorIdRef.current = null;
    returnSnapshotRef.current = null;
    focusPathRef.current = [];
    fallbackDescendantsRef.current = [];
    setFocusAnchorId(null);
    const saved = window.history.state?.cnlyricsCommentReturn;
    const scoped = saved?.scopeKey === scopeKey ? saved : null;
    setExpandedDepthIds(new Set(scoped?.expandedThreadIds || []));
    setCollapsedIds(new Set(scoped?.collapsedThreadIds || []));
    setSiblingVisibleCounts(new Map(scoped?.siblingVisibleCounts || []));
    setFocusedCount(FOCUS_BATCH_SIZE);
  }, [scopeKey]);

  const enterFocus = id => {
    if (!nodes.has(id)) return;

    if (!focusAnchorIdRef.current) {
      const scrollContainer = findScrollContainer(contentRef.current);
      returnSnapshotRef.current = {
        scrollY: window.scrollY,
        scrollContainer,
        containerScrollTop: scrollContainer?.scrollTop ?? 0,
        activeElement: document.activeElement,
        expandedThreadIds: [...expandedDepthIds],
        collapsedThreadIds: [...collapsedIds],
        siblingVisibleCounts: [...siblingVisibleCounts.entries()],
        context: { ...context },
      };
      fallbackDescendantsRef.current = flattenFocusedTraversal(nodes.get(id)).map(entry => entry.comment.id);
      // Same URL, one dedicated history step. Preserve router state keys.
      const currentState = window.history.state || {};
      window.history.replaceState(
        {
          ...currentState,
          cnlyricsCommentReturn: {
            ...context,
            scopeKey,
            scrollY: window.scrollY,
            sidebarScrollTop: scrollContainer?.scrollTop ?? 0,
            expandedThreadIds: [...expandedDepthIds],
            collapsedThreadIds: [...collapsedIds],
            siblingVisibleCounts: [...siblingVisibleCounts.entries()],
          },
        },
        '', window.location.href,
      );
      window.history.pushState(
        { ...window.history.state, cnlyricsCommentFocus: markerRef.current },
        '', window.location.href,
      );
    }

    // Re-entering a deeper node stays inside the same focused layer and
    // deliberately does NOT replace the original return snapshot.
    focusPathRef.current = getCommentPath(roots, id);
    fallbackDescendantsRef.current = flattenFocusedTraversal(nodes.get(id)).map(entry => entry.comment.id);
    focusAnchorIdRef.current = id;
    setFocusAnchorId(id);
    setFocusedCount(FOCUS_BATCH_SIZE);
    window.requestAnimationFrame(() => {
      const container = findScrollContainer(contentRef.current);
      if (container) container.scrollTop = 0;
      else contentRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  };

  const backToDiscussion = () => {
    if (window.history.state?.cnlyricsCommentFocus === markerRef.current) {
      window.history.back(); // Same original snapshot, regardless of focus movements.
    } else {
      exitFocus();
    }
  };

  // The focused anchor might be deleted while the user is reading. A locally
  // retained tombstone keeps its descendants attached; otherwise use the
  // nearest surviving ancestor, then the first surviving former descendant.
  let focused = focusAnchorId ? nodes.get(focusAnchorId) : null;
  if (focusAnchorId && !focused) {
    focused = [...focusPathRef.current].reverse()
      .map(id => nodes.get(id)).find(Boolean) || null;
    if (!focused) {
      focused = fallbackDescendantsRef.current.map(id => nodes.get(id)).find(Boolean) || null;
    }
  }
  const focusedRows = useMemo(() => flattenFocusedTraversal(focused), [focused]);
  const displayedRows = focusedRows.slice(0, focusedCount);

  const postReply = async (parentId, text) => {
    // Register before the async mutation completes, so a fast refetch cannot
    // render and miss the newly inserted reply.
    const tracking = focusAnchorIdRef.current
      ? { parentId, priorIds: new Set(nodes.keys()) }
      : null;
    pendingReplyRef.current = tracking;
    try {
      const saved = await onReply(parentId, text);
      if (saved === false) pendingReplyRef.current = null;
      return saved;
    } catch (error) {
      pendingReplyRef.current = null;
      throw error;
    }
  };

  useEffect(() => {
    const pending = pendingReplyRef.current;
    if (!pending || !focusAnchorId) return;
    const newRowIndex = focusedRows.findIndex(({ comment }) =>
      comment.parent_id === pending.parentId && !pending.priorIds.has(comment.id));
    if (newRowIndex < 0) return;
    setFocusedCount(n => Math.max(n, Math.ceil((newRowIndex + 1) / FOCUS_BATCH_SIZE) * FOCUS_BATCH_SIZE));
    pendingReplyRef.current = null;
    const commentId = focusedRows[newRowIndex].comment.id;
    window.requestAnimationFrame(() => {
      const item = [...contentRef.current.querySelectorAll('[data-comment-id]')]
        .find(element => element.dataset.commentId === commentId && !element.closest('[hidden]'));
      item?.scrollIntoView({ block: 'nearest' });
    });
  }, [roots, focusedRows, focusAnchorId]);

  return (
    <div ref={contentRef} className="min-w-0">
      <div hidden={Boolean(focusAnchorId)} className={focusAnchorId ? 'hidden' : 'space-y-4 min-w-0'}>
        {roots.map(root => (
          <CommentItem key={root.id} comment={root} user={user}
            onReply={onReply} onDelete={onDelete}
            showLike={showLike} onToggleLike={onToggleLike}
            likedCommentIds={likedCommentIds}
            depth={0} depthLimit={visibleLevels}
            expandedDepthIds={expandedDepthIds} collapsedIds={collapsedIds}
            siblingVisibleCounts={siblingVisibleCounts}
            onExpandDepth={expandBranch} onToggleCollapse={toggleCollapsed}
            onRevealSiblings={revealSiblings} onContinue={enterFocus}
          />
        ))}
      </div>

      {focusAnchorId && (
        <section role="region" aria-label="Focused comment thread" className="min-w-0">
          <div className="mb-4 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-3">
            <button type="button" aria-label="Back to original discussion" onClick={backToDiscussion}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300">
              <ArrowLeft size={16} /> Back to original discussion
            </button>
            {focused ? (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-slate-400">
                  Continuing with @{focused.deleted ? 'deleted comment' : focused.profiles?.username || 'a community member'}
                </p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                  {focused.deleted ? '[Deleted comment]' : focused.content}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">This comment was deleted. Return to the discussion.</p>
            )}
          </div>

          <div className="space-y-4 min-w-0">
            {displayedRows.map(({ comment, logicalDepth }) => (
              <CommentItem key={comment.id} comment={comment} user={user}
                replies={[]} focused depth={Math.min(logicalDepth, visibleLevels - 1)}
                parentComment={nodes.get(comment.parent_id)}
                onReply={postReply} onDelete={onDelete}
                showLike={showLike} onToggleLike={onToggleLike}
                likedCommentIds={likedCommentIds}
                onFocusReplies={enterFocus}
              />
            ))}
          </div>

          {displayedRows.length < focusedRows.length && (
            <button type="button"
              onClick={() => setFocusedCount(n => n + FOCUS_BATCH_SIZE)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-blue-400 hover:bg-slate-800/60 hover:text-blue-300">
              <ChevronDown size={15} />
              Load {Math.min(FOCUS_BATCH_SIZE, focusedRows.length - displayedRows.length)} more comments
              <span className="text-slate-500">({displayedRows.length} of {focusedRows.length})</span>
            </button>
          )}
          {focusedRows.length === 0 && focused && (
            <p className="text-sm text-slate-500 italic">No replies in this thread yet.</p>
          )}
        </section>
      )}
    </div>
  );
};

export default ThreadedComments;
