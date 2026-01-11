import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Youtube, Info, Globe } from 'lucide-react'; 
import { supabase } from '../lib/supabaseClient';
import { tify, sify } from 'chinese-conv'; // <--- 1. IMPORT THIS

const SongPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // <--- 2. ADD STATE FOR SCRIPT (Default to Simplified or Traditional)
  const [scriptMode, setScriptMode] = useState('simplified'); 

  useEffect(() => {
    const fetchSong = async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('slug', slug)
        .single();
        
      if (data) setSong(data);
      setLoading(false);
    };
    fetchSong();
  }, [slug]);

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (loading) return <div className="text-white p-10">Loading lyrics...</div>;
  if (!song) return <div className="text-white p-10">Song not found.</div>;

  const videoId = getYoutubeId(song.youtube_url);

  // <--- 3. CONVERT LYRICS BEFORE SPLITTING
  // If the DB has mixed text, this cleans it up instantly based on the toggle.
  const rawChinese = song.lyrics_chinese || "";
  const convertedChinese = scriptMode === 'traditional' ? tify(rawChinese) : sify(rawChinese);

  const chineseLines = convertedChinese.split('\n'); // Split the CONVERTED text
  const pinyinLines = song.lyrics_pinyin ? song.lyrics_pinyin.split('\n') : [];
  const englishLines = song.lyrics_english ? song.lyrics_english.split('\n') : [];
  
  const maxLines = Math.max(chineseLines.length, pinyinLines.length, englishLines.length);
  const lines = Array.from({ length: maxLines });

  // Helper to toggle the mode
  const toggleScript = () => {
    setScriptMode(prev => prev === 'simplified' ? 'traditional' : 'simplified');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">

      {/* 1. HERO SECTION */}
      <div className="relative h-[50vh] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-950 z-10" />
        <img src={song.cover_url} className="w-full h-full object-cover opacity-50 blur-xl scale-110" alt="Background" />
        
        <div className="absolute bottom-0 left-0 z-20 p-6 md:p-12 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-end gap-8">
          <img src={song.cover_url} className="w-48 h-48 rounded-2xl shadow-2xl border border-white/10" alt={song.title} />
          
          <div className="mb-4 flex-1">
             <button onClick={() => navigate('/')} className="text-slate-300 hover:text-white flex items-center mb-6 text-sm font-bold bg-white/10 w-fit px-4 py-2 rounded-full backdrop-blur-md transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Library
            </button>
            {/* Convert Title and Artist too! */}
            <h1 className="text-4xl md:text-6xl font-black mb-2 tracking-tight">
                {scriptMode === 'traditional' ? tify(song.title) : sify(song.title)}
            </h1>
            <p className="text-2xl text-primary font-medium">{song.artist} 
                <span className="text-slate-500 text-lg ml-2">
                    {scriptMode === 'traditional' ? tify(song.artist_chinese) : sify(song.artist_chinese)}
                </span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* 2. LYRICS COLUMN */}
        <div className="lg:col-span-2 space-y-4">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-bold text-slate-400 flex items-center gap-2">
              <Music className="w-5 h-5" /> Lyrics
             </h3>
             
             <div className="flex gap-4 items-center">
                 {/* <--- 4. THE TOGGLE BUTTON ---> */}
                 <button 
                    onClick={toggleScript}
                    className="flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border border-slate-700 hover:border-primary hover:text-primary transition-all"
                 >
                    <Globe className="w-3 h-3" />
                    {scriptMode === 'simplified' ? '简 Simplified' : '繁 Traditional'}
                 </button>

                 <button onClick={() => navigate(`/edit/${song.id}`)} className="text-xs text-slate-500 hover:text-primary">Suggest Edit</button>
             </div>
           </div>
           
           <div className="space-y-4">
            {lines.map((_, index) => {
              const line = chineseLines[index] || ""; // This is now auto-converted
              const pinyin = pinyinLines[index] || "";
              const english = englishLines[index] || "";
              
              if (!line.trim() && !pinyin.trim() && !english.trim()) return <div key={index} className="h-6"></div>;

              return (
                <div key={index} className="group hover:bg-slate-900/80 p-6 rounded-2xl transition-all border border-transparent hover:border-slate-800">
                  {pinyin && <div className="text-sm text-primary font-mono mb-2 tracking-wide opacity-80 group-hover:opacity-100">{pinyin}</div>}
                  {line && <div className="text-3xl md:text-4xl font-bold text-slate-100 mb-3 leading-relaxed">{line}</div>}
                  {english && <div className="text-slate-500 group-hover:text-slate-300 transition-colors text-lg italic">{english}</div>}
                </div>
              );
            })}
           </div>

           {/* --- CREDITS / ABOUT SECTION --- */}
           {song.credits && (
             <div className="mt-16 pt-10 border-t border-slate-800/50">
               <h3 className="text-xl font-bold text-slate-400 flex items-center gap-2 mb-6">
                 <Info className="w-5 h-5" /> About This Song
               </h3>
               <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap">
                 {song.credits}
               </div>
             </div>
           )}

        </div>

        {/* 3. MEDIA COLUMN */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            
            {/* YouTube Player */}
            {videoId ? (
              <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
                <div className="aspect-video">
                  <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                </div>
                <div className="p-4 bg-slate-800/50">
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-500" /> Watch official video
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center text-slate-500">No video available</div>
            )}
            
            {/* Additional Info Card */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-white">Song Details</h4>
                <button onClick={() => navigate(`/edit/${song.id}`)} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-300 transition-colors">Edit Song</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex flex-col gap-2">
                  <span className="text-slate-500 text-sm">Tags</span>
                  <div className="flex flex-wrap gap-2">
                    {song.tags && song.tags.length > 0 ? (
                      song.tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-slate-800 text-primary px-2 py-1 rounded border border-slate-700">#{tag}</span>
                      ))
                    ) : (
                      <span className="text-slate-600 text-sm italic">No tags added</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-slate-500">Added By</span><span className="text-slate-300">{song.submitted_by || "Community"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Added On</span><span className="text-slate-300">{new Date(song.created_at).toLocaleDateString()}</span></div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default SongPage;