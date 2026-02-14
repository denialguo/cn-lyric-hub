import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Reply, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const CommentItem = ({ comment, user, replies = [], onReply, onDelete }) => {
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');

  // 1. Fetch Likes on Mount
  useEffect(() => {
    const fetchLikes = async () => {
      // Get count
      const { count } = await supabase
        .from('comment_likes')
        .select('*', { count: 'exact', head: true })
        .eq('comment_id', comment.id);
      setLikesCount(count || 0);

      // Check if WE liked it
      if (user) {
        const { data } = await supabase
          .from('comment_likes')
          .select('*')
          .eq('comment_id', comment.id)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsLiked(!!data);
      }
    };
    fetchLikes();
  }, [comment.id, user]);

  // 2. Handle Like Click
  const toggleLike = async () => {
    if (!user) return alert("Please sign in to like comments!");
    
    const newStatus = !isLiked;
    setIsLiked(newStatus);
    setLikesCount(prev => newStatus ? prev + 1 : prev - 1);

    if (newStatus) {
      await supabase.from('comment_likes').insert({ user_id: user.id, comment_id: comment.id });
    } else {
      await supabase.from('comment_likes').delete().eq('user_id', user.id).eq('comment_id', comment.id);
    }
  };

  // 3. Handle Reply Submission
  const submitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    await onReply(comment.id, replyText);
    setIsReplying(false);
    setReplyText('');
  };

  const isOwner = user?.id === comment.user_id;

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-slate-700">
        {comment.profiles?.avatar_url ? (
           <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" alt="avi" />
        ) : (
           <span className="text-xs font-bold text-slate-400">{comment.profiles?.username?.[0]?.toUpperCase() || "?"}</span>
        )}
      </div>

      <div className="flex-1">
        {/* Header */}
        <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-slate-200">{comment.profiles?.username || "Unknown"}</span>
                <span className="text-xs text-slate-600">{new Date(comment.created_at).toLocaleDateString()}</span>
            </div>
            {isOwner && (
                <button onClick={() => onDelete(comment.id)} className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                </button>
            )}
        </div>

        {/* Content */}
        <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">{comment.content}</p>

        {/* Actions Bar */}
        <div className="flex items-center gap-4 mt-2">
            <button 
                onClick={toggleLike}
                className={`flex items-center gap-1 text-xs font-bold transition-colors ${isLiked ? 'text-pink-500' : 'text-slate-500 hover:text-pink-500'}`}
            >
                <Heart size={12} fill={isLiked ? "currentColor" : "none"} /> {likesCount || "Like"}
            </button>
            
            <button 
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-primary transition-colors"
            >
                <MessageCircle size={12} /> Reply
            </button>
        </div>

        {/* Reply Input Box */}
        {isReplying && (
            <form onSubmit={submitReply} className="mt-3 flex gap-2 animate-in fade-in slide-in-from-top-1">
                <input 
                    autoFocus
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={`Reply to @${comment.profiles?.username}...`}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                />
                <button type="submit" className="bg-slate-800 hover:bg-primary text-white p-2 rounded-lg transition-colors">
                    <Reply size={16} />
                </button>
            </form>
        )}

        {/* NESTED REPLIES (Recursive Rendering) */}
        {replies.length > 0 && (
            <div className="mt-4 pl-4 border-l-2 border-slate-800 space-y-4">
                {replies.map(reply => (
                    <CommentItem 
                        key={reply.id} 
                        comment={reply} 
                        user={user} 
                        replies={[]} // We usually only go 1 level deep for simplicity
                        onReply={onReply} // Replies to replies just thread under parent
                        onDelete={onDelete}
                    />
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default CommentItem;