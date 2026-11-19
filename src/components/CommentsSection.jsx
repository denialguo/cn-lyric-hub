import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isRealAccount, ownAvatarUrl } from '../lib/identity';
import { Send, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CommentItem from './CommentItem';
import { nestComments } from '../lib/commentThreads';

const MAX_COMMENT = 2000;

const CommentsSection = ({ songId }) => {
  const { user, profile } = useAuth();
  const { toast, confirm } = useToast();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const threads = useMemo(() => nestComments(comments), [comments]);

  const fetchComments = async (id = songId) => {
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles(username, avatar_url)')
      .eq('song_id', id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching comments:', error);
      toast.error('Could not load song comments.');
      return;
    }
    setComments(data || []);
  };

  useEffect(() => {
    if (!songId) { setComments([]); return; }
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.from('comments')
        .select('*, profiles(username, avatar_url)')
        .eq('song_id', songId).order('created_at', { ascending: true });
      if (!active) return;
      if (error) console.error('Error fetching song comments:', error);
      else setComments(data || []);
    };
    setComments([]);
    load();
    return () => { active = false; };
  }, [songId]);

  const ensureSignedIn = async () => {
    if (isRealAccount(user)) return true;
    const ok = await confirm('You need an account to comment. Go to login?', { confirmLabel: 'Log In' });
    if (ok) navigate('/login');
    return false;
  };

  const postComment = async (content, parentId = null) => {
    if (!content?.trim() || loading) return false;
    if (!await ensureSignedIn()) return false;
    setLoading(true);
    try {
      const { error } = await supabase.from('comments').insert({
        content: content.trim().slice(0, MAX_COMMENT),
        song_id: songId, user_id: user.id, parent_id: parentId,
      });
      if (error) throw error;
      await fetchComments();
      return true;
    } catch (error) {
      toast.error('Could not post comment: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const saved = await postComment(newComment);
    if (saved) setNewComment('');
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Delete this comment? Replies will remain visible.', { destructive: true, confirmLabel: 'Delete' });
    if (!ok) return;
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) toast.error("Couldn't delete that comment. Please try again.");
    else await fetchComments();
  };

  const canComment = isRealAccount(user);
  const myAvatar = ownAvatarUrl(user, profile);

  return (
    <div className="max-w-2xl">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <MessageSquare className="text-primary" /> Comments
        <span className="text-slate-500 text-sm">({comments.length})</span>
      </h3>
      <form onSubmit={handleSubmit} className="mb-8 flex gap-4">
        <div className="w-10 h-10 bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700 rounded-full">
          <img src={canComment ? myAvatar : '/default-avatar.png'} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 relative">
          <textarea value={newComment} onChange={event => setNewComment(event.target.value)}
            placeholder={canComment ? 'Share your thoughts...' : 'Log in to comment...'}
            disabled={!canComment || loading} maxLength={MAX_COMMENT}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 pr-12 text-white focus:border-primary outline-none transition-colors min-h-[100px] resize-none" />
          <button disabled={loading || !newComment.trim()} type="submit" aria-label="Post song comment"
            className="absolute bottom-3 right-3 bg-primary hover:bg-primary/90 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Send size={16} />
          </button>
        </div>
      </form>
      <div className="space-y-6">
        {comments.length === 0 ? (
          <p className="text-slate-600 italic text-sm ml-14">Be the first to comment!</p>
        ) : threads.map(comment => (
          <CommentItem key={comment.id} comment={comment} user={user}
            onReply={(parentId, replyText) => postComment(replyText, parentId)}
            onDelete={handleDelete} showLike={false} />
        ))}
      </div>
    </div>
  );
};

export default CommentsSection;
