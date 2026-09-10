import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ThumbsUp, MessageSquare, Globe, X, Send, Loader2, Trash2, RotateCcw, Copy, Flag, Heart } from 'lucide-react';
import CommentItem from './CommentItem';
import { isRealAccount } from '../lib/identity';
import { readJson, writeJson } from '../lib/storage';

const LineSidebar = ({ songId, lineIndex, originalContent, pinyinContent, defaultTranslation, onClose, onSelectTranslation }) => {
  const { user, ensureUser } = useAuth();
  const { toast, confirm } = useToast();
  
  const [activeTab, setActiveTab] = useState('translations');
  const [translations, setTranslations] = useState([]);
  const [comments, setComments] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [myVotes, setMyVotes] = useState(new Set()); 
  const [myCommentVotes, setMyCommentVotes] = useState(new Set());
  const [originalVotes, setOriginalVotes] = useState(0); 
  const [hasLikedOriginal, setHasLikedOriginal] = useState(false); 

  const [transInput, setTransInput] = useState('');
  const [mainCommentInput, setMainCommentInput] = useState('');
  const [threadInput, setThreadInput] = useState({}); 
  const [submitting, setSubmitting] = useState(false);

  const [expandedThreads, setExpandedThreads] = useState(new Set()); 

  useEffect(() => {
    // songId belongs here: navigating between songs with the sidebar open kept the
    // same lineIndex, so this never re-ran and showed the previous song's data.
    fetchData();
  }, [songId, lineIndex, user]);

  useEffect(() => {
    if (!user) {
        const savedSet = new Set(readJson(`votes_${songId}`, []));
        setMyVotes(savedSet);
        if (savedSet.has(`ORG_${lineIndex}`)) setHasLikedOriginal(true);

        setMyCommentVotes(new Set(readJson(`comment_votes_${songId}`, [])));
    }
  }, [user, songId, lineIndex]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: trans, error: transError } = await supabase
      .from('line_translations')
      .select('*, profiles(username, avatar_url), line_votes(count)')
      .eq('song_id', songId)
      .eq('line_index', lineIndex);

    const { data: comms } = await supabase
      .from('line_comments')
      .select('*, profiles(username, avatar_url)')
      .eq('song_id', songId)
      .eq('line_index', lineIndex)
      .order('created_at', { ascending: true }); 

    const { count: orgVoteCount } = await supabase
      .from('line_votes')
      .select('*', { count: 'exact', head: true })
      .eq('song_id', songId)
      .eq('line_index', lineIndex)
      .is('translation_id', null);

    let myVotedIds = new Set();
    let myCommentVotedIds = new Set();
    let likedOrg = false;

    if (user) {
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

        // Only check votes for comments on THIS line (not the entire site)
        const commentIds = (comms || []).map(c => c.id);
        if (commentIds.length > 0) {
            const { data: commentVotes } = await supabase
                .from('comment_votes')
                .select('comment_id')
                .eq('user_id', user.id)
                .in('comment_id', commentIds);
                
            if (commentVotes) {
                commentVotes.forEach(v => myCommentVotedIds.add(v.comment_id));
            }
        }
    }

    if (transError) {
      toast.error('Could not load translations. Please try again.');
      setTranslations([]);
    } else {
      setTranslations((trans || []).map(t => ({ ...t, votes: t.line_votes[0].count }))
        .sort((a, b) => b.votes - a.votes));
    }
    setComments(comms || []);
    setOriginalVotes(orgVoteCount || 0);
    if(user) {
        setMyVotes(myVotedIds);
        setMyCommentVotes(myCommentVotedIds);
        setHasLikedOriginal(likedOrg);
    }
    setLoading(false);
  };

  const toggleThread = (transId) => {
    setExpandedThreads(prev => {
        const newSet = new Set(prev);
        if (newSet.has(transId)) newSet.delete(transId);
        else newSet.add(transId);
        return newSet;
    });
  };

  const toggleVoteCommunity = async (translationId) => {
    // Lazy auth — votes must carry a real uid so RLS can pin them to their owner
    const voter = await ensureUser();
    if (!voter) return;

    const isLiked = myVotes.has(translationId);

    // Snapshot for rollback if a write fails
    const prevTranslations = translations;
    const prevMyVotes = myVotes;

    setTranslations(prev => prev.map(t => {
        if (t.id !== translationId) return t;
        return { ...t, votes: isLiked ? (t.votes || 0) - 1 : (t.votes || 0) + 1 };
    }));

    setMyVotes(prev => {
        const newSet = new Set(prev);
        if (isLiked) newSet.delete(translationId);
        else newSet.add(translationId);
        writeJson(`votes_${songId}`, [...newSet]);
        return newSet;
    });

    let error;
    if (isLiked) {
        ({ error } = await supabase.from('line_votes').delete().eq('user_id', voter.id).eq('translation_id', translationId));
    } else {
        ({ error } = await supabase.from('line_votes').insert({ user_id: voter.id, song_id: songId, line_index: lineIndex, translation_id: translationId }));
    }

    if (error) {
        setTranslations(prevTranslations);
        setMyVotes(prevMyVotes);
        writeJson(`votes_${songId}`, [...prevMyVotes]);
        toast.error("Vote didn't save. Please try again.");
    }
  };

  const toggleVoteComment = async (commentId, currentVotes) => {
    const voter = await ensureUser();
    if (!voter) return;

    const isLiked = myCommentVotes.has(commentId);

    // Snapshot for rollback if a write fails
    const prevComments = comments;
    const prevMyCommentVotes = myCommentVotes;

    setComments(prev => prev.map(c => {
        if (c.id !== commentId) return c;
        return { ...c, votes: isLiked ? (c.votes || 0) - 1 : (c.votes || 0) + 1 };
    }));

    setMyCommentVotes(prev => {
        const newSet = new Set(prev);
        if (isLiked) newSet.delete(commentId);
        else newSet.add(commentId);
        writeJson(`comment_votes_${songId}`, [...newSet]);
        return newSet;
    });

    let error;
    if (isLiked) {
        ({ error } = await supabase.from('comment_votes').delete().eq('user_id', voter.id).eq('comment_id', commentId));
        if (!error) ({ error } = await supabase.from('line_comments').update({ votes: currentVotes - 1 }).eq('id', commentId));
    } else {
        ({ error } = await supabase.from('comment_votes').insert({ user_id: voter.id, comment_id: commentId }));
        if (!error) ({ error } = await supabase.from('line_comments').update({ votes: currentVotes + 1 }).eq('id', commentId));
    }

    if (error) {
        setComments(prevComments);
        setMyCommentVotes(prevMyCommentVotes);
        writeJson(`comment_votes_${songId}`, [...prevMyCommentVotes]);
        toast.error("Vote didn't save. Please try again.");
    }
  };

  const toggleVoteOriginal = async () => {
    const voter = await ensureUser();
    if (!voter) return;

    const isLiked = hasLikedOriginal;

    // Snapshot for rollback if the write fails
    const prevVotes = originalVotes;
    const prevLiked = hasLikedOriginal;
    const prevMyVotes = myVotes;

    setOriginalVotes(prev => isLiked ? prev - 1 : prev + 1);
    setHasLikedOriginal(!isLiked);

    setMyVotes(prev => {
        const newSet = new Set(prev);
        const key = `ORG_${lineIndex}`;
        if (isLiked) newSet.delete(key);
        else newSet.add(key);
        writeJson(`votes_${songId}`, [...newSet]);
        return newSet;
    });

    let error;
    if (isLiked) {
        ({ error } = await supabase.from('line_votes').delete().eq('user_id', voter.id).eq('song_id', songId).eq('line_index', lineIndex).is('translation_id', null));
    } else {
        ({ error } = await supabase.from('line_votes').insert({ user_id: voter.id, song_id: songId, line_index: lineIndex, translation_id: null }));
    }

    if (error) {
        setOriginalVotes(prevVotes);
        setHasLikedOriginal(prevLiked);
        setMyVotes(prevMyVotes);
        writeJson(`votes_${songId}`, [...prevMyVotes]);
        toast.error("Vote didn't save. Please try again.");
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete your translation?", { destructive: true, confirmLabel: 'Delete' });
    if (!ok) return;
    const prev = translations;
    setTranslations(translations.filter(t => t.id !== id));
    const { error } = await supabase.from('line_translations').delete().eq('id', id);
    if (error) {
      setTranslations(prev);          // RLS refused it; it never left the DB
      toast.error("Couldn't delete that translation. Please try again.");
    }
  };

  const handleDeleteComment = async (id) => {
    const ok = await confirm("Delete your comment?", { destructive: true, confirmLabel: 'Delete' });
    if (!ok) return;
    const prev = comments;
    setComments(comments.filter(c => c.id !== id));
    const { error } = await supabase.from('line_comments').delete().eq('id', id);
    if (error) {
      setComments(prev);
      toast.error("Couldn't delete that comment. Please try again.");
    }
  };

  const handleSubmitTranslation = async (e) => {
    e.preventDefault();
    if (!isRealAccount(user)) return toast.info("Please log in to contribute.");
    if (!transInput.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from('line_translations').insert({
        song_id: songId, line_index: lineIndex, content: transInput.trim().slice(0, 1000), user_id: user.id, language: 'en'
    });
    if (error) toast.error(error.message);
    else { setTransInput(''); fetchData(); }
    setSubmitting(false);
  };

    const handleSubmitComment = async (e, translationId = null) => {
        e.preventDefault();
        if (!isRealAccount(user)) return toast.info("Please log in to comment.");

        const content = translationId ? threadInput[translationId] : mainCommentInput;
        if (!content?.trim()) return;

        setSubmitting(true);
        await handlePostComment(null, content, translationId);

        if (translationId) setThreadInput({...threadInput, [translationId]: ''});
        else setMainCommentInput('');
        fetchData();
        setSubmitting(false);
    };

    const handlePostComment = async (parentId = null, text = null, translationId = null) => {
        const contentToPost = text || mainCommentInput;
        if (!contentToPost.trim() || !isRealAccount(user)) return;

        const { error } = await supabase
                .from('line_comments')
                .insert({
                        song_id: songId,
                        line_index: lineIndex,
                        user_id: user.id,
                        content: contentToPost.trim().slice(0, 2000),
                        translation_id: translationId,
                        parent_id: parentId
                })
                .select('*, profiles(username, avatar_url)')
                .single();

        if (error) {
                console.error(error);
                toast.error(error.message);
        } else {
                fetchData();
        }
    };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const generalComments = comments.filter(c => !c.translation_id);

  return (
    <div className="fixed right-0 top-0 h-full w-full md:w-[450px] bg-slate-900 border-l border-slate-800 shadow-2xl z-[150] flex flex-col">
      
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
      <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-2">
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50 border-l-4 border-l-primary relative group">
            <p className="italic text-slate-300 text-sm pr-8">"{originalContent}"</p>
            <button onClick={() => handleCopy(originalContent)} className="absolute right-2 top-2 text-slate-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Copy characters">
                <Copy size={14} />
            </button>
        </div>
        {pinyinContent && (
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50 relative group">
            <p className="text-slate-500 text-xs font-mono pr-8">{pinyinContent}</p>
            <button onClick={() => handleCopy(pinyinContent)} className="absolute right-2 top-2 text-slate-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Copy pinyin">
                <Copy size={14} />
            </button>
          </div>
        )}
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
                
                {/* OFFICIAL TRANSLATION CARD — only when translation exists */}
                {defaultTranslation ? (
                  <div className="bg-slate-900 p-4 rounded-xl border border-primary/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg">OFFICIAL</div>
                    
                    <p className="text-slate-400 text-xs font-bold uppercase mb-2">Original Translation</p>
                    <p className="text-white text-base font-medium mb-3 leading-relaxed italic opacity-90">
                        {defaultTranslation}
                    </p>

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
                ) : null}

                <div className="w-full h-px bg-slate-800/50"></div>

                {/* COMMUNITY TRANSLATIONS */}
                {translations.map(t => {
                    const isLiked = myVotes.has(t.id);
                    const threadComments = comments.filter(c => c.translation_id === t.id);
                    const isExpanded = expandedThreads.has(t.id);

                    return (
                        <div key={t.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-primary/30 transition-all group">
                            
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
                            
                            <p className="text-white text-base font-medium mb-3 leading-relaxed">{t.content}</p>
                            
                            <div className="flex items-center gap-4 mb-4 pl-1">
                                <button 
                                    onClick={() => toggleVoteCommunity(t.id)}
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