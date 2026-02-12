import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- NEW: SMART TIME FORMATTER ---
const timeAgo = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Just now";
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString(); // Fallback to normal date for old stuff
};
// ---------------------------------

const CommentsSection = ({ songId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [myProfile, setMyProfile] = useState(null);

  // 1. Fetch User Profile
  useEffect(() => {
    const fetchMyProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setMyProfile(data);
    };
    fetchMyProfile();
  }, [user]);

  // 2. Fetch Comments
  useEffect(() => {
    if (songId) fetchComments();
  }, [songId]);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`*, profiles (username, avatar_url)`)
      .eq('song_id', songId)
      .order('created_at', { ascending: false });

    if (error) console.error("Error fetching comments:", error);
    else setComments(data || []);
  };

  // 3. Post Comment
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
        if(confirm("You need to login to comment. Go to login?")) navigate('/auth');
        return;
    }
    if (!newComment.trim()) return;

    setLoading(true);

    const { error } = await supabase
      .from('comments')
      .insert([{ 
          content: newComment, 
          song_id: songId, 
          user_id: user.id 
      }]);

    if (error) {
      alert("Error posting: " + error.message);
    } else {
      setNewComment('');
      fetchComments(); 
    }
    setLoading(false);
  };

  const handleDelete = async (commentId) => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (!error) setComments(comments.filter(c => c.id !== commentId));
  };

  const myAvatar = myProfile?.avatar_url || user?.user_metadata?.avatar_url || "/default-avatar.png";

  return (
    <div className="max-w-2xl">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <MessageSquare className="text-primary" /> 
        Comments <span className="text-slate-500 text-sm">({comments.length})</span>
      </h3>

      {/* INPUT FORM */}
      <form onSubmit={handleSubmit} className="mb-8 flex gap-4">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700">
             <img src={user ? myAvatar : "/default-avatar.png"} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 relative">
            <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={user ? "Share your thoughts..." : "Log in to comment..."}
                disabled={!user}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white focus:border-primary outline-none transition-colors min-h-[100px] resize-none"
            />
            <button 
                disabled={loading || !newComment.trim()}
                type="submit"
                className="absolute bottom-3 right-3 bg-primary hover:bg-primary/90 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Send size={16} />
            </button>
        </div>
      </form>

      {/* COMMENTS LIST */}
      <div className="space-y-6">
        {comments.length === 0 ? (
            <p className="text-slate-600 italic text-sm ml-14">Be the first to comment!</p>
        ) : (
            comments.map(comment => (
                <div key={comment.id} className="flex gap-4 group">
                    <img 
                        src={comment.profiles?.avatar_url || "/default-avatar.png"} 
                        className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-slate-700 flex-shrink-0"
                    />
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-bold text-sm">
                                {comment.profiles?.username || 'Unknown'}
                            </span>
                            
                            {/* --- UPDATED: USE SMART TIME --- */}
                            <span className="text-slate-500 text-xs">
                                {timeAgo(comment.created_at)}
                            </span>
                            {/* ------------------------------- */}

                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {comment.content}
                        </p>
                    </div>
                    
                    {user && user.id === comment.user_id && (
                        <button 
                            onClick={() => handleDelete(comment.id)}
                            className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                            title="Delete comment"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default CommentsSection;