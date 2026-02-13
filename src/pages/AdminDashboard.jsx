import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Check, Clock, AlertCircle, ArrowLeft, Trash2, Edit3, Sparkles, Music } from 'lucide-react';

const AdminDashboard = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Protect Route
  useEffect(() => {
    if (!authLoading) {
      if (!user || profile?.role !== 'admin') {
        navigate('/');
      }
    }
  }, [user, profile, authLoading, navigate]);

  // Fetch Pending Submissions & Original Songs for Diffing
  useEffect(() => {
    const fetchSubmissions = async () => {
      if (profile?.role !== 'admin') return;
      
      const { data: subs, error: subsError } = await supabase
        .from('song_submissions')
        .select('*')
        .in('status', ['pending', 'pending_edit'])
        .order('created_at', { ascending: false });

      if (subsError) {
        console.error('Fetch error:', subsError);
        setLoading(false);
        return;
      }

      const editSubs = subs.filter(s => s.original_song_id);
      const origIds = editSubs.map(s => s.original_song_id);

      let originalSongsMap = {};
      if (origIds.length > 0) {
          const { data: origSongs } = await supabase
            .from('songs')
            .select('*')
            .in('id', origIds);
          
          if (origSongs) {
              origSongs.forEach(song => {
                  originalSongsMap[song.id] = song;
              });
          }
      }

      const enrichedSubs = subs.map(sub => ({
          ...sub,
          originalData: sub.original_song_id ? originalSongsMap[sub.original_song_id] : null
      }));

      setSubmissions(enrichedSubs || []);
      setLoading(false);
    };

    fetchSubmissions();
  }, [profile]);

  const handleReject = async (id) => {
    if (!window.confirm("Permanently delete this submission?")) return;
    try {
      const { error } = await supabase.from('song_submissions').delete().eq('id', id);
      if (error) throw error;
      setSubmissions(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      alert("❌ Failed to delete: " + error.message);
    }
  };

  const getChangedFields = (sub, orig) => {
      if (!orig) return [];
      const changes = [];
      if (sub.title_en !== orig.title_en) changes.push("Title (EN)");
      if (sub.title_zh !== orig.title_zh) changes.push("Title (ZH)");
      if (sub.artist_en !== orig.artist_en || sub.artist_zh !== orig.artist_zh) changes.push("Artists");
      if (sub.lyrics_chinese !== orig.lyrics_chinese) changes.push("Chinese Lyrics");
      if (sub.lyrics_pinyin !== orig.lyrics_pinyin) changes.push("Pinyin");
      if (sub.lyrics_english !== orig.lyrics_english) changes.push("English Lyrics");
      if (sub.youtube_url !== orig.youtube_url) changes.push("YouTube URL");
      if (sub.cover_url !== orig.cover_url) changes.push("Cover URL");
      if (sub.credits !== orig.credits) changes.push("Credits");
      return changes;
  };

  if (authLoading || loading) return <div className="p-10 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col gap-6 mb-8">
            <button onClick={() => navigate('/')} className="self-start flex items-center text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
            </button>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <AlertCircle className="text-primary" /> Admin Dashboard
            </h1>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-slate-200">Queue ({submissions.length})</h2>
          </div>

          {submissions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Check className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>All caught up! No pending submissions.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {submissions.map((item) => {
                const isEdit = item.status === 'pending_edit' || item.original_song_id;
                const mainTitle = item.title_en || item.title_zh || "Untitled";
                const displayArtist = item.artist_en || item.artist_zh || "Unknown Artist";
                
                const changedFields = isEdit ? getChangedFields(item, item.originalData) : [];

                return (
                  <div key={item.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      
                      {/* --- UPGRADED LEFT SIDE (IMAGE + TEXT) --- */}
                      <div className="flex-1 flex flex-col sm:flex-row gap-5">
                        
                        {/* THE COVER IMAGE */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center shadow-lg">
                            {item.cover_url ? (
                                <img src={item.cover_url} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <Music className="w-8 h-8 text-slate-700" />
                            )}
                        </div>

                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-1">
                            <h3 className="text-xl font-bold text-white">{mainTitle}</h3>
                            {item.title_zh && item.title_zh !== mainTitle && (
                                <span className="text-sm text-slate-400 border border-slate-700 px-2 py-0.5 rounded bg-slate-800/50">
                                    {item.title_zh}
                                </span>
                            )}
                            
                            {isEdit ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-1 rounded">
                                    <Edit3 size={12} /> Edit Suggestion
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded">
                                    <Sparkles size={12} /> New Song
                                </span>
                            )}
                            </div>

                            <p className="text-slate-400 text-sm mb-4">
                            by <span className="text-slate-200 font-medium">{displayArtist}</span> • 
                            Submitted by <span className="text-primary font-medium">{item.submitted_by || 'Anonymous'}</span> on {new Date(item.created_at).toLocaleDateString()}
                            </p>
                            
                            {isEdit ? (
                                <div className="bg-purple-950/20 border border-purple-900/50 p-4 rounded-lg">
                                    <p className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <AlertCircle size={14} /> Modifications Detected
                                    </p>
                                    {changedFields.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {changedFields.map((field, idx) => (
                                                <span key={idx} className="bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs px-2 py-1 rounded">
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500 italic">No text changes detected.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-lg text-xs font-mono border border-slate-800">
                                <div>
                                    <p className="text-slate-500 mb-1">Chinese Sample</p>
                                    <p className="text-slate-300 line-clamp-2">{item.lyrics_chinese || "(No Chinese lyrics provided)"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 mb-1">English Sample</p>
                                    <p className="text-slate-300 line-clamp-2">{item.lyrics_english || "(No English lyrics provided)"}</p>
                                </div>
                                </div>
                            )}
                        </div>
                      </div>

                      {/* --- RIGHT SIDE (BUTTONS) --- */}
                      <div className="flex md:flex-col gap-3 justify-center min-w-[140px] pt-2 md:pt-0">
                        <button 
                          onClick={() => navigate(`/admin/review/${item.id}`)}
                          className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg ${isEdit ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20 text-white' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20 text-white'}`}
                        >
                          <Clock size={16} /> Review
                        </button>
                        
                        <button 
                          onClick={() => handleReject(item.id)}
                          className="bg-slate-800 hover:bg-red-500/10 hover:text-red-400 border border-slate-700 text-slate-400 px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all"
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;