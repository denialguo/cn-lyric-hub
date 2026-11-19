import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Reply, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { isRealAccount } from '../lib/identity';
import { countDescendants, shouldContinueThread } from '../lib/commentThreads';

const DEFAULT_SIBLINGS = 3;

/**
 * A comment can render as part of the progressively expanded inline tree,
 * or as one row of the flat focused traversal. No component here owns history,
 * scroll position or a navigation snapshot; ThreadedComments owns all of that.
 */
const CommentItem = ({
  comment, user, replies = comment.replies || [], onReply, onDelete,
  depth = 0, showLike = true, onToggleLike, likedCommentIds,
  depthLimit = 3, inlineExpansionUsed = false,
  expandedDepthIds, collapsedIds, siblingVisibleCounts,
  onExpandDepth, onToggleCollapse, onRevealSiblings, onContinue,
  focused = false, onFocusReplies, parentComment,
}) => {
  const { toast } = useToast();
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [liking, setLiking] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);

  const deleted = Boolean(comment.deleted);
  const delegatedLike = typeof onToggleLike === 'function';

  useEffect(() => {
    if (!showLike || delegatedLike || deleted) return;
    let active = true;
    const fetchLikes = async () => {
      const { count } = await supabase.from('comment_likes')
        .select('*', { count: 'exact', head: true }).eq('comment_id', comment.id);
      if (active) setLikesCount(count || 0);
      if (isRealAccount(user)) {
        const { data } = await supabase.from('comment_likes').select('comment_id')
          .eq('comment_id', comment.id).eq('user_id', user.id).maybeSingle();
        if (active) setIsLiked(Boolean(data));
      } else if (active) {
        setIsLiked(false);
      }
    };
    fetchLikes();
    return () => { active = false; };
  }, [comment.id, user?.id, showLike, delegatedLike, deleted]);

  const liked = delegatedLike ? Boolean(likedCommentIds?.has(comment.id)) : isLiked;
  const count = delegatedLike ? comment.votes || 0 : likesCount;
  const descendants = countDescendants(replies);
  const collapsed = Boolean(collapsedIds?.has(comment.id));
  const expandedHere = Boolean(expandedDepthIds?.has(comment.id));
  const atCutoff = !focused && shouldContinueThread(depth, depthLimit, replies);
  const canExpand = atCutoff && !inlineExpansionUsed && !expandedHere;
  const canContinue = atCutoff && inlineExpansionUsed;
  const childDepthLimit = expandedHere ? depthLimit + 2 : depthLimit;
  const childExpansionUsed = inlineExpansionUsed || expandedHere;
  const showChildren = !atCutoff || expandedHere;
  const siblingLimit = siblingVisibleCounts?.get(comment.id) ?? DEFAULT_SIBLINGS;
  const visibleReplies = replies.slice(0, siblingLimit);
  const hiddenSiblings = Math.max(0, replies.length - visibleReplies.length);
  const canCollapse = replies.length > 0 && !focused && (!atCutoff || expandedHere);

  const toggleLike = async () => {
    if (!isRealAccount(user)) return toast.info('Please sign in to like comments.');
    if (liking || deleted) return;
    if (delegatedLike) return onToggleLike(comment.id, comment.votes || 0);
    setLiking(true);
    const next = !isLiked;
    setIsLiked(next);
    setLikesCount(n => Math.max(0, n + (next ? 1 : -1)));
    const { error } = next
      ? await supabase.from('comment_likes').insert({ user_id: user.id, comment_id: comment.id })
      : await supabase.from('comment_likes').delete().eq('user_id', user.id).eq('comment_id', comment.id);
    if (error) {
      setIsLiked(!next);
      setLikesCount(n => Math.max(0, n + (next ? -1 : 1)));
      toast.error("Couldn't save that. Please try again.");
    }
    setLiking(false);
  };

  const submitReply = async event => {
    event.preventDefault();
    if (!isRealAccount(user)) return toast.info('Please sign in to reply.');
    if (!replyText.trim() || posting) return;
    setPosting(true);
    try {
      const saved = await onReply(comment.id, replyText.trim());
      if (saved !== false) {
        setReplyText('');
        setIsReplying(false);
      }
    } catch (error) {
      console.error('Reply failed:', error);
      toast.error("Couldn't save your reply. Your draft is still here.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div data-comment-id={comment.id}
      className={depth ? 'ml-2 pl-2 md:ml-3 md:pl-3 border-l-2 border-slate-700/70 min-w-0' : 'min-w-0'}>
      <div className="flex gap-3 group min-w-0">
        <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-slate-700">
          {!deleted && comment.profiles?.avatar_url ? (
            <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <span className="text-xs font-bold text-slate-400">
              {deleted ? '–' : comment.profiles?.username?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 min-w-0">
              <span className="text-sm font-bold text-slate-200 break-all">
                {deleted ? 'Deleted comment' : comment.profiles?.username || 'Unknown'}
              </span>
              {!deleted && <span className="text-xs text-slate-600">{new Date(comment.created_at).toLocaleDateString()}</span>}
            </div>
            {!deleted && user?.id === comment.user_id && (
              <button aria-label="Delete your comment" onClick={() => onDelete(comment.id)}
                className="text-slate-600 hover:text-red-500 opacity-70 md:opacity-0 group-hover:opacity-100 shrink-0">
                <Trash2 size={12} />
              </button>
            )}
          </div>
          {focused && parentComment && (
            <p className="text-xs text-slate-500 mt-1">
              Replying to @{parentComment.deleted ? 'deleted comment' : parentComment.profiles?.username || 'unknown'}
            </p>
          )}
          <p className={`text-sm mt-1 whitespace-pre-wrap break-words ${deleted ? 'text-slate-500 italic' : 'text-slate-300'}`}>
            {comment.content}
          </p>
          {!deleted && (
            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-2">
              {showLike && (
                <button onClick={toggleLike} disabled={liking} aria-label="Like comment" aria-pressed={liked}
                  className={`flex items-center gap-1 text-xs font-bold transition-colors disabled:opacity-60 ${liked ? 'text-pink-500' : 'text-slate-500 hover:text-pink-500'}`}>
                  <Heart size={12} fill={liked ? 'currentColor' : 'none'} /> {count || 'Like'}
                </button>
              )}
              <button onClick={() => setIsReplying(v => !v)} aria-expanded={isReplying}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-primary transition-colors">
                <MessageCircle size={12} /> Reply
              </button>
              {focused && (comment.replies || []).length > 0 && onFocusReplies && (
                <button type="button" onClick={() => onFocusReplies(comment.id)}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300">
                  Focus replies
                </button>
              )}
              {canCollapse && (
                <button type="button" onClick={() => onToggleCollapse(comment.id)} aria-expanded={!collapsed}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-400">
                  {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  {collapsed ? `Show ${descendants} ${descendants === 1 ? 'reply' : 'replies'}` : 'Collapse replies'}
                </button>
              )}
            </div>
          )}
          {isReplying && !deleted && (
            <form onSubmit={submitReply} className="mt-3 flex gap-2">
              <input autoFocus aria-label={`Reply to ${comment.profiles?.username || 'comment'}`}
                value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder={`Reply to @${comment.profiles?.username || 'user'}...`}
                maxLength={2000} disabled={posting}
                className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none" />
              <button type="submit" aria-label="Post reply" disabled={posting || !replyText.trim()}
                className="bg-slate-800 hover:bg-primary text-white p-2 rounded-lg transition-colors disabled:opacity-50">
                <Reply size={16} />
              </button>
            </form>
          )}
        </div>
      </div>

      {!focused && replies.length > 0 && !collapsed && (
        <div className="mt-3 space-y-4 min-w-0">
          {canExpand ? (
            <button type="button" onClick={() => onExpandDepth(comment.id)}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-blue-400 hover:bg-slate-800/60 hover:text-blue-300">
              <ChevronDown size={14} />
              Show next 2 levels · {descendants} {descendants === 1 ? 'reply' : 'replies'}
            </button>
          ) : canContinue ? (
            <button type="button" onClick={() => onContinue(comment.id)}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-blue-400 hover:bg-slate-800/60 hover:text-blue-300">
              <MessageCircle size={14} />
              Continue this thread · {descendants} {descendants === 1 ? 'reply' : 'replies'}
            </button>
          ) : showChildren ? (
            <>
              {visibleReplies.map(reply => (
                <CommentItem key={reply.id} comment={reply} user={user}
                  onReply={onReply} onDelete={onDelete} depth={depth + 1}
                  depthLimit={childDepthLimit} inlineExpansionUsed={childExpansionUsed}
                  expandedDepthIds={expandedDepthIds} collapsedIds={collapsedIds}
                  siblingVisibleCounts={siblingVisibleCounts}
                  onExpandDepth={onExpandDepth} onToggleCollapse={onToggleCollapse}
                  onRevealSiblings={onRevealSiblings} onContinue={onContinue}
                  showLike={showLike} onToggleLike={onToggleLike}
                  likedCommentIds={likedCommentIds} />
              ))}
              {hiddenSiblings > 0 && (
                <button type="button" onClick={() => onRevealSiblings(comment.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm font-semibold text-blue-400 hover:text-blue-300">
                  <ChevronDown size={14} /> View {Math.min(DEFAULT_SIBLINGS, hiddenSiblings)} more {hiddenSiblings === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default CommentItem;
