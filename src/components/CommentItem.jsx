import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Reply, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { isRealAccount } from '../lib/identity';

/**
 * One comment at any depth. Each node owns its reply form; nested replies
 * receive the same callbacks and keep their exact parent rather than being
 * flattened into the first root or silently omitted.
 *
 * In line-translation threads, the parent sidebar handles comment_votes.
 * General line comments continue to use the existing comment_likes table.
 * Song-wide comments have no like facility and opt out of the heart control.
 */
const CommentItem = ({
  comment, user, replies = comment.replies || [], onReply, onDelete,
  depth = 0, showLike = true, onToggleLike, likedCommentIds,
}) => {
  const { toast } = useToast();
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [liking, setLiking] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);

  const delegatedLike = typeof onToggleLike === 'function';
  useEffect(() => {
    if (!showLike || delegatedLike) return;
    let active = true;
    const fetchLikes = async () => {
      const { count } = await supabase
        .from('comment_likes')
        .select('*', { count: 'exact', head: true })
        .eq('comment_id', comment.id);
      if (active) setLikesCount(count || 0);
      if (isRealAccount(user)) {
        const { data } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('comment_id', comment.id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (active) setIsLiked(Boolean(data));
      } else if (active) {
        setIsLiked(false);
      }
    };
    fetchLikes();
    return () => { active = false; };
  }, [comment.id, user?.id, showLike, delegatedLike]);

  const liked = delegatedLike ? Boolean(likedCommentIds?.has(comment.id)) : isLiked;
  const count = delegatedLike ? comment.votes || 0 : likesCount;

  const toggleLike = async () => {
    if (!isRealAccount(user)) return toast.info('Please sign in to like comments.');
    if (liking) return;
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

  const submitReply = async (event) => {
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
    <div className={depth ? 'ml-2 md:ml-4 pl-2 md:pl-4 border-l-2 border-slate-700/70 min-w-0' : 'min-w-0'}>
      <div className="flex gap-3 group min-w-0">
        <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-slate-700">
          {comment.profiles?.avatar_url ? (
            <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <span className="text-xs font-bold text-slate-400">{comment.profiles?.username?.[0]?.toUpperCase() || '?'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 min-w-0">
              <span className="text-sm font-bold text-slate-200 break-all">{comment.profiles?.username || 'Unknown'}</span>
              <span className="text-xs text-slate-600">{new Date(comment.created_at).toLocaleDateString()}</span>
            </div>
            {user?.id === comment.user_id && (
              <button aria-label="Delete your comment" onClick={() => onDelete(comment.id)}
                className="text-slate-600 hover:text-red-500 opacity-70 md:opacity-0 group-hover:opacity-100 shrink-0">
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
          <div className="flex items-center gap-4 mt-2">
            {showLike && (
              <button onClick={toggleLike} disabled={liking}
                aria-label="Like comment" aria-pressed={liked}
                className={`flex items-center gap-1 text-xs font-bold transition-colors disabled:opacity-60 ${liked ? 'text-pink-500' : 'text-slate-500 hover:text-pink-500'}`}>
                <Heart size={12} fill={liked ? 'currentColor' : 'none'} /> {count || 'Like'}
              </button>
            )}
            <button onClick={() => setIsReplying(v => !v)} aria-expanded={isReplying}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-primary transition-colors">
              <MessageCircle size={12} /> Reply
            </button>
          </div>
          {isReplying && (
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
      {replies.length > 0 && (
        <div className="mt-3 space-y-4">
          {replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} user={user}
              onReply={onReply} onDelete={onDelete} depth={depth + 1}
              showLike={showLike} onToggleLike={onToggleLike} likedCommentIds={likedCommentIds} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;
