import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Youtube, Info, Globe } from 'lucide-react'; 
import { supabase } from '../lib/supabaseClient';
import { tify, sify } from 'chinese-conv'; 
import { useTheme } from '../context/ThemeContext'; 
import { Helmet } from 'react-helmet-async'; 

const SongPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme(); 
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className="text-slate-500 p-10">Loading lyrics...</div>;
  if (!song) return <div className="text-slate-500 p-10">Song not found.</div>;

  const videoId = getYoutubeId(song.youtube_url);

  // Script Conversion
  const rawChinese = song.lyrics_chinese || "";
  const convertedChinese = scriptMode === 'traditional' ? tify(rawChinese) : sify(rawChinese);

  const chineseLines = convertedChinese.split('\n');
  const pinyinLines = song.lyrics_pinyin ? song.lyrics_pinyin.split('\n') : [];
  const englishLines = song.lyrics_english ? song.lyrics_english.split('\n') : [];
  
  const maxLines = Math.max(chineseLines.length, pinyinLines.length, englishLines.length);
  const lines = Array.from({ length: maxLines });

  const toggleScript = () => {
    setScriptMode(prev => prev === 'simplified' ? 'traditional' : 'simplified');
  };

  // --- FIX 1: USE NEW COLUMN NAMES ---
  const rawTitle = song.title_chinese || "";
  const displayTitle = scriptMode === 'traditional' ? tify(rawTitle) : sify(rawTitle);
  const displayArtist = scriptMode === 'traditional' ? tify(song.artist_chinese) : sify(song.artist_chinese);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 dark:text-white pb-20 transition-colors duration-500">
      
      {/* --- SEO TAGS UPDATED --- */}
      <Helmet>
        <title>{displayTitle} - {song.artist_en} | CN Lyric Hub</title>
        <meta name="description" content={`Lyrics, Pinyin, and English translation for ${displayTitle} by ${song.artist_en}.`} />

        {/* Open Graph */}
        <meta property="og:type" content="music.song" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={`${displayTitle} - ${song.artist_en}`} />
        <meta property="og:description" content={`Learn the lyrics to ${displayTitle} with Pinyin and English translations.`} />
        <meta property="og:image" content={song.cover_url} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${displayTitle} - ${song.artist_en}`} />
        <meta name="twitter:description" content={`Learn the lyrics to ${displayTitle} with Pinyin and English translations.`} />
        <meta name="twitter:image" content={song.cover_url} />
      </Helmet>

      {/* HERO SECTION */}
      <div className="relative h-[50vh] overflow-hidden">
        <div 
          className={`absolute inset-0 bg-gradient-to-b from-slate-900/50 ${isDarkMode ? 'to-slate-950' : 'to-[#f8fafc]'} z-10`} 
        />
        
        <img src={song.cover_url} className="w-full h-full object-cover opacity-50 blur-xl scale-110" alt="Background" />
        
        <div className="absolute bottom-0 left-0 z-20 p-6 md:p-12 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-end gap-8">
          <img src={song.cover_url} className="w-48 h-48 rounded-2xl shadow-2xl border border-white/10" alt={displayTitle} />
          
          <div className="mb-4 flex-1">
             <button onClick={() => navigate('/')} className="text-slate-200 hover:text-white flex items-center mb-6 text-sm font-bold bg-white/10 w-fit px-4 py-2 rounded-full backdrop-blur-md transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Library
            </button>
            
            {/* --- FIX 2: TITLE DISPLAY LOGIC --- */}
            {/* Primary Chinese Title */}
            <h1 className="text-4xl md:text-6xl font-black mb-2 tracking-tight text-white">
                {displayTitle}
            </h1>
            
            {/* Secondary English Title (If exists) */}
            {song.title_en && (
                <p className="text-2xl text-slate-400 font-medium mb-4 italic">
                    {song.title_en}
                </p>
            )}

            <p className="text-2xl text-primary font-medium">{song.artist_en}
                <span className="text-slate-300 text-lg ml-2">
                    {displayArtist}
                </span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* LYRICS COLUMN */}
        <div className="lg:col-span-2 space-y-4">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Music className="w-5 h-5" /> Lyrics
             </h3>
             
             <div className="flex gap-4 items-center">
                 <button 
                    onClick={toggleScript}
                    className="flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border border-slate-700 hover:border-primary hover:text-primary transition-all text-slate-400"
                 >
                    <Globe className="w-3 h-3" />
                    {scriptMode === 'simplified' ? '简 Simplified' : '繁 Traditional'}
                 </button>

                 <button onClick={() => navigate(`/edit/${song.id}`)} className="text-xs text-slate-400 hover:text-primary">Suggest Edit</button>
             </div>
           </div>
           
           <div className="space-y-4">
            {lines.map((_, index) => {
              const line = chineseLines[index] || ""; 
              const pinyin = pinyinLines[index] || "";
              const english = englishLines[index] || "";
              
              if (!line.trim() && !pinyin.trim() && !english.trim()) return <div key={index} className="h-6"></div>;

              return (
                <div key={index} className="group hover:bg-slate-800 p-6 rounded-2xl transition-all border border-transparent hover:border-slate-800">
                  {pinyin && <div className="text-sm text-primary font-mono mb-2 tracking-wide opacity-80 group-hover:opacity-100">{pinyin}</div>}
                  {line && <div className="text-3xl md:text-4xl font-bold text-slate-100 mb-3 leading-relaxed">{line}</div>}
                  {english && <div className="text-slate-500 group-hover:text-slate-300 transition-colors text-lg italic">{english}</div>}
                </div>
              );
            })}
           </div>

           {/* CREDITS SECTION */}
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

        {/* MEDIA COLUMN */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            
            {/* YouTube Player */}
            {videoId ? (
              <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
                <div className="aspect-video">
                  <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                </div>
                <div className="p-4 bg-slate-900 text-white">
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-500" /> Watch official video
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center text-slate-500">No video available</div>
            )}
            
            {/* Info Card */}
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
                      <span className="text-slate-400 text-sm italic">No tags added</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Added By</span>
                  <span 
                    className="text-slate-300 font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={() => {
                        const name = song.submitted_by;
                        if (name && name !== 'Community' && !name.includes('@')) {
                            navigate(`/user/${name}`);
                        }
                    }}
                  >
                    {song.submitted_by || "Community"}
                  </span>
                </div>
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