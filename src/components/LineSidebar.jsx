import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { ThumbsUp, MessageSquare, Globe, X, Send, Loader2, Trash2, RotateCcw, Copy, Flag, Heart } from 'lucide-react';
import CommentItem from './CommentItem';

const LineSidebar = ({ songId, lineIndex, originalContent, defaultTranslation, onClose, onSelectTranslation }) => {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('translations');
  const [translations, setTranslations] = useState([]);
  const [comments, setComments] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Voting States
  const [myVotes, setMyVotes] = useState(new Set()); 
  const [myCommentVotes, setMyCommentVotes] = useState(new Set()); // New: Track comment likes
  const [originalVotes, setOriginalVotes] = useState(0); 
  const [hasLikedOriginal, setHasLikedOriginal] = useState(false); 

  // Inputs
  const [transInput, setTransInput] = useState('');
  const [mainCommentInput, setMainCommentInput] = useState('');
  const [threadInput, setThreadInput] = useState({}); 
  const [submitting, setSubmitting] = useState(false);

  // UI States
  const [expandedThreads, setExpandedThreads] = useState(new Set()); 

  useEffect(() => {
    fetchData();
  }, [lineIndex, user]);

  // Load Anonymous Votes
  useEffect(() => {
    if (!user) {
        // Translation Votes
        const savedVotes = JSON.parse(localStorage.getItem(`votes_${songId}`) || '[]');
        const savedSet = new Set(savedVotes);
        setMyVotes(savedSet);
        if (savedSet.has(`ORG_${lineIndex}`)) setHasLikedOriginal(true);

        // Comment Votes
        const savedCommentVotes = JSON.parse(localStorage.getItem(`comment_votes_${songId}`) || '[]');
        setMyCommentVotes(new Set(savedCommentVotes));
    }
  }, [user, songId, lineIndex]);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Get Translations
    const { data: trans } = await supabase
      .from('line_translations')
      .select('*, profiles(username, avatar_url)')
      .eq('song_id', songId)
      .eq('line_index', lineIndex)
      .order('votes', { ascending: false });

    // 2. Get Comments
    const { data: comms } = await supabase
      .from('line_comments')
      .select('*, profiles(username, avatar_url)')
      .eq('song_id', songId)
      .eq('line_index', lineIndex)
      .order('created_at', { ascending: true }); 

    // 3. Get Vote Counts for ORIGINAL
    const { count: orgVoteCount } = await supabase
      .from('line_votes')
      .select('*', { count: 'exact', head: true })
      .eq('song_id', songId)
      .eq('line_index', lineIndex)
      .is('translation_id', null);

    // 4. Check user votes
    let myVotedIds = new Set();
    let myCommentVotedIds = new Set();
    let likedOrg = false;

    if (user) {
        // Translations
        const { data: userVotes } = await supabase
            .from('line_votes')
            .select('translation_id')
            .eq('user_id', user.id)
            .eq('song_id', songId)
            .eq('line_index', lineIndex);
            
        if (userVotes) {
            userVotes.forEach(v => {
                if (v.translation_id) myVotedIds.add(v.translation_id);
                else likedOrg = true;
            });
        }

        // Comments
        // Note: For efficiency, we usually fetch this better, but this works for small scale
        const { data: commentVotes } = await supabase
            .from('comment_votes')
            .select('comment_id')
            .eq('user_id', user.id);
            
        if (commentVotes) {
            commentVotes.forEach(v => myCommentVotedIds.add(v.comment_id));
        }
    }

    setTranslations(trans || []);
    setComments(comms || []);
    setOriginalVotes(orgVoteCount || 0);
    if(user) {
        setMyVotes(myVotedIds);
        setMyCommentVotes(myCommentVotedIds);
        setHasLikedOriginal(likedOrg);
    }
    setLoading(false);
  };

  // --- ACTIONS ---

  const toggleThread = (transId) => {
    setExpandedThreads(prev => {
        const newSet = new Set(prev);
        if (newSet.has(transId)) newSet.delete(transId);
        else newSet.add(transId);
        return newSet;
    });
  };

  // --- VOTE: TRANSLATION ---
  const toggleVoteCommunity = async (translationId, currentCount) => {
    const isLiked = myVotes.has(translationId);
    
    setTranslations(prev => prev.map(t => {
        if (t.id !== translationId) return t;
        return { ...t, votes: isLiked ? (t.votes || 0) - 1 : (t.votes || 0) + 1 };
    }));
    
    setMyVotes(prev => {
        const newSet = new Set(prev);
        if (isLiked) newSet.delete(translationId);
        else newSet.add(translationId);
        localStorage.setItem(`votes_${songId}`, JSON.stringify([...newSet]));
        return newSet;
    });

    if (isLiked) {
        if (user) await supabase.from('line_votes').delete().eq('user_id', user.id).eq('translation_id', translationId);
        await supabase.from('line_translations').update({ votes: currentCount - 1 }).eq('id', translationId);
    } else {
        await supabase.from('line_votes').insert({ user_id: user ? user.id : null, song_id: songId, line_index: lineIndex, translation_id: translationId });
        await supabase.from('line_translations').update({ votes: currentCount + 1 }).eq('id', translationId);
    }
  };

  // --- VOTE: COMMENT ---
  const toggleVoteComment = async (commentId, currentVotes) => {
    const isLiked = myCommentVotes.has(commentId);

    // Optimistic UI
    setComments(prev => prev.map(c => {
        if (c.id !== commentId) return c;
        return { ...c, votes: isLiked ? (c.votes || 0) - 1 : (c.votes || 0) + 1 };
    }));

    setMyCommentVotes(prev => {
        const newSet = new Set(prev);
        if (isLiked) newSet.delete(commentId);
        else newSet.add(commentId);
        localStorage.setItem(`comment_votes_${songId}`, JSON.stringify([...newSet]));
        return newSet;
    });

    if (isLiked) {
        if (user) await supabase.from('comment_votes').delete().eq('user_id', user.id).eq('comment_id', commentId);
        await supabase.from('line_comments').update({ votes: currentVotes - 1 }).eq('id', commentId);
    } else {
        await supabase.from('comment_votes').insert({ user_id: user ? user.id : null, comment_id: commentId });
        await supabase.from('line_comments').update({ votes: currentVotes + 1 }).eq('id', commentId);
    }
  };

  // --- VOTE: ORIGINAL ---
  const toggleVoteOriginal = async () => {
    setOriginalVotes(prev => hasLikedOriginal ? prev - 1 : prev + 1);
    setHasLikedOriginal(!hasLikedOriginal);

    const isLiked = hasLikedOriginal;
    setMyVotes(prev => {
        const newSet = new Set(prev);
        const key = `ORG_${lineIndex}`;
        if (isLiked) newSet.delete(key);
        else newSet.add(key);
        localStorage.setItem(`votes_${songId}`, JSON.stringify([...newSet]));
        return newSet;
    });

    if (hasLikedOriginal) {
        if (user) await supabase.from('line_votes').delete().eq('user_id', user.id).eq('song_id', songId).eq('line_index', lineIndex).is('translation_id', null);
    } else {
        await supabase.from('line_votes').insert({ user_id: user ? user.id : null, song_id: songId, line_index: lineIndex, translation_id: null });
    }
  };

  // --- DELETE HANDLERS ---
  const handleDelete = async (id) => {
    if (!confirm("Delete your translation?")) return;
    setTranslations(translations.filter(t => t.id !== id));
    await supabase.from('line_translations').delete().eq('id', id);
  };

  const handleDeleteComment = async (id) => {
    if (!confirm("Delete your comment?")) return;
    setComments(comments.filter(c => c.id !== id));
    await supabase.from('line_comments').delete().eq('id', id);
  };

  // --- SUBMIT HANDLERS ---
  const handleSubmitTranslation = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login to contribute.");
    if (!transInput.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from('line_translations').insert({
        song_id: songId, line_index: lineIndex, content: transInput, user_id: user.id, language: 'en', votes: 0
    });
    if (error) alert(error.message);
    else { setTransInput(''); fetchData(); }
    setSubmitting(false);
  };

    const handleSubmitComment = async (e, translationId = null) => {
        e.preventDefault();
        if (!user) return alert("Please login to comment.");

        const content = translationId ? threadInput[translationId] : mainCommentInput;
        if (!content?.trim()) return;

        setSubmitting(true);
        // Delegate to the new handler which supports parent_id. Keep translation association.
        await handlePostComment(null, content, translationId);

        if (translationId) setThreadInput({...threadInput, [translationId]: ''});
        else setMainCommentInput('');
        fetchData();
        setSubmitting(false);
    };

    // allow parentId to be passed in (it defaults to null for main comments)
    const handlePostComment = async (parentId = null, text = null, translationId = null) => {
        const contentToPost = text || mainCommentInput;
        if (!contentToPost.trim() || !user) return;

        const { data, error } = await supabase
                .from('line_comments')
                .insert({
                        song_id: songId,
                        line_index: lineIndex,
                        user_id: user.id,
                        content: contentToPost,
                        translation_id: translationId,
                        parent_id: parentId // <--- THIS IS THE ONLY NEW FIELD
                })
                .select('*, profiles(username, avatar_url)')
                .single();

        // Optimistically refresh or append - for simplicity we'll refetch
        if (error) {
                console.error(error);
                alert(error.message);
        } else {
                fetchData();
        }
    };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const generalComments = comments.filter(c => !c.translation_id);

  return (
    <div className="fixed right-0 top-0 h-full w-full md:w-[450px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col">
      
      {/* HEADER */}
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
         <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">Line #{lineIndex + 1}</h3>
            <p className="text-xs text-slate-500">Community Contributions</p>
         </div>
         <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
           <X size={20} />
         </button>
      </div>

      {/* CONTEXT */}
      <div className="p-4 bg-slate-950 border-b border-slate-800">
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50 italic text-slate-300 text-sm border-l-4 border-l-primary relative group">
            "{originalContent}"
            <button onClick={() => handleCopy(originalContent)} className="absolute right-2 top-2 text-slate-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Copy size={14} />
            </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-800">
        <button 
          onClick={() => setActiveTab('translations')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'translations' ? 'text-primary bg-primary/5 border-b-2 border-primary' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Globe size={14} /> Translations
        </button>
        <button 
          onClick={() => setActiveTab('comments')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'comments' ? 'text-primary bg-primary/5 border-b-2 border-primary' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <MessageSquare size={14} /> Discussion ({generalComments.length})
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : activeTab === 'translations' ? (
            <div className="space-y-6">
                
                {/* 1. OFFICIAL TRANSLATION CARD */}
                <div className="bg-slate-900 p-4 rounded-xl border border-primary/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg">OFFICIAL</div>
                    
                    <p className="text-slate-400 text-xs font-bold uppercase mb-2">Original Translation</p>
                    <p className="text-white text-base font-medium mb-3 leading-relaxed italic opacity-90">
                        {defaultTranslation || "(No translation provided)"}
                    </p>

                    {/* ACTIONS ROW (Clean & Subtle) */}
                    <div className="flex items-center gap-4 mb-4">
                         <button 
                            onClick={toggleVoteOriginal}
                            className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                                hasLikedOriginal ? 'text-primary' : 'text-slate-500 hover:text-white'
                            }`}
                        >
                            <ThumbsUp size={14} fill={hasLikedOriginal ? "currentColor" : "none"} /> 
                            {originalVotes}
                        </button>
                    </div>

                    <button 
                        onClick={() => onSelectTranslation(null)}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={14} /> Use Original
                    </button>
                </div>

                <div className="w-full h-px bg-slate-800/50"></div>

                {/* 2. COMMUNITY TRANSLATIONS */}
                {translations.map(t => {
                    const isLiked = myVotes.has(t.id);
                    const threadComments = comments.filter(c => c.translation_id === t.id);
                    const isExpanded = expandedThreads.has(t.id);

                    return (
                        <div key={t.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-primary/30 transition-all group">
                            
                            {/* Author Info */}
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <img src={t.profiles?.avatar_url || '/default-avatar.png'} className="w-6 h-6 rounded-full object-cover" />
                                    <span className="text-xs text-slate-400 font-medium">@{t.profiles?.username}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {user && user.id === t.user_id && (
                                        <button onClick={() => handleDelete(t.id)} className="text-slate-600 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Content */}
                            <p className="text-white text-base font-medium mb-3 leading-relaxed">{t.content}</p>
                            
                            {/* ACTIONS ROW (Clean & Subtle) */}
                            <div className="flex items-center gap-4 mb-4 pl-1">
                                <button 
                                    onClick={() => toggleVoteCommunity(t.id, t.votes || 0)}
                                    className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                                        isLiked ? 'text-primary' : 'text-slate-500 hover:text-white'
                                    }`}
                                >
                                    <ThumbsUp size={14} fill={isLiked ? "currentColor" : "none"} /> {t.votes || 0}
                                </button>
                                
                                <button 
                                    onClick={() => toggleThread(t.id)}
                                    className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                                        isExpanded || threadComments.length > 0 ? 'text-blue-400' : 'text-slate-500 hover:text-white'
                                    }`}
                                >
                                    <MessageSquare size={14} /> {threadComments.length} Reply
                                </button>
                            </div>

                            {/* THREADED COMMENTS AREA */}
                            {isExpanded && (
                                <div className="mb-4 bg-slate-950/30 rounded-lg p-3 border border-slate-800/50">
                                    {threadComments.length > 0 && (
                                        <div className="space-y-3 mb-3 pl-1">
                                            {threadComments.map(tc => {
                                                const commentLiked = myCommentVotes.has(tc.id);
                                                return (
                                                    <div key={tc.id} className="text-xs group/comment">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-400">@{tc.profiles?.username}</span>
                                                                <span className="text-[10px] text-slate-600">{new Date(tc.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                            
                                                            {/* COMMENT ACTIONS (Like/Delete) */}
                                                            <div className="flex items-center gap-2 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={() => toggleVoteComment(tc.id, tc.votes || 0)}
                                                                    className={`flex items-center gap-1 ${commentLiked ? 'text-pink-500' : 'text-slate-600 hover:text-pink-500'}`}
                                                                >
                                                                    <Heart size={10} fill={commentLiked ? "currentColor" : "none"} /> {tc.votes || 0}
                                                                </button>
                                                                {user && user.id === tc.user_id && (
                                                                    <button onClick={() => handleDeleteComment(tc.id)} className="text-slate-600 hover:text-red-500">
                                                                        <Trash2 size={10} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-slate-300 ml-1">{tc.content}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    
                                    {/* Reply Input */}
                                    <form onSubmit={(e) => handleSubmitComment(e, t.id)} className="flex gap-2 mt-2">
                                        <input
                                            value={threadInput[t.id] || ''}
                                            onChange={(e) => setThreadInput({...threadInput, [t.id]: e.target.value})}
                                            placeholder="Write a reply..."
                                            className="flex-1 bg-slate-900 border border-slate-800 rounded text-xs px-2 py-1.5 text-white focus:border-primary outline-none"
                                        />
                                        <button type="submit" disabled={submitting} className="text-primary hover:text-white p-1"><Send size={14} /></button>
                                    </form>
                                </div>
                            )}

                            <button 
                                onClick={() => onSelectTranslation(t.content)}
                                className="w-full py-2.5 bg-slate-800 hover:bg-primary hover:text-white text-slate-400 rounded-lg text-xs font-bold transition-all border border-slate-700 hover:border-primary"
                            >
                                Use this translation
                            </button>
                        </div>
                    );
                })}
            </div>
        ) : (
            /* GENERAL DISCUSSION TAB */
            <div className="space-y-4">
                {(() => {
                    const rootComments = comments.filter(c => !c.parent_id);
                    const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId);

                    return rootComments.map(comment => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            replies={getReplies(comment.id)}
                            user={user}
                            onReply={handlePostComment}
                            onDelete={handleDeleteComment}
                        />
                    ));
                })()}

                {generalComments.length === 0 && <p className="text-slate-500 text-sm text-center italic">No general comments yet.</p>}
            </div>
        )}
      </div>

      {/* FOOTER INPUT */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        {activeTab === 'translations' ? (
            <form onSubmit={handleSubmitTranslation} className="relative">
                <input
                    type="text"
                    value={transInput}
                    onChange={(e) => setTransInput(e.target.value)}
                    placeholder={user ? "Propose a translation..." : "Log in to contribute"}
                    disabled={!user || submitting}
                    className="w-full bg-slate-900 border border-slate-800 text-white placeholder-slate-600 text-sm rounded-xl py-3 pl-4 pr-12 outline-none focus:border-primary transition-colors"
                />
                <button disabled={!user || submitting} type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </form>
        ) : (
             <form onSubmit={(e) => handleSubmitComment(e, null)} className="relative">
                <input
                    type="text"
                    value={mainCommentInput}
                    onChange={(e) => setMainCommentInput(e.target.value)}
                    placeholder={user ? "Ask a general question..." : "Log in to comment"}
                    disabled={!user || submitting}
                    className="w-full bg-slate-900 border border-slate-800 text-white placeholder-slate-600 text-sm rounded-xl py-3 pl-4 pr-12 outline-none focus:border-primary transition-colors"
                />
                <button disabled={!user || submitting} type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </form>
        )}
      </div>

    </div>
  );
};

export default LineSidebar;