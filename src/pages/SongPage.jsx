import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Youtube, Info, Globe } from 'lucide-react'; 
import { supabase } from '../lib/supabaseClient';
import { tify, sify } from 'chinese-conv'; 
import { useTheme } from '../context/ThemeContext'; 
import { Helmet } from 'react-helmet-async'; 
import CommentsSection from '../components/CommentsSection';

// --- IMPORT NEW COMPONENTS ---
import LyricLine from '../components/LyricLine';
import LineSidebar from '../components/LineSidebar';

const SongPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme(); 
  
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scriptMode, setScriptMode] = useState('simplified'); 

  // --- NEW STATES FOR ANNOTATIONS ---
  const [selectedLine, setSelectedLine] = useState(null); // Which line is currently clicked?
  const [customTranslations, setCustomTranslations] = useState(() => {
    // Try to find saved settings for THIS specific song
    const saved = localStorage.getItem(`prefs_${slug}`);
    return saved ? JSON.parse(saved) : {};
  });

  // 2. Whenever the user changes a translation, save it instantly
  useEffect(() => {
    localStorage.setItem(`prefs_${slug}`, JSON.stringify(customTranslations));
  }, [customTranslations, slug]);
  // ----------------------------------

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

  // --- HANDLERS FOR TRANSLATION ---
  const handleLineClick = (index) => {
    // If clicking the same line, close it. Otherwise open new one.
    if (selectedLine === index) {
      setSelectedLine(null);
    } else {
      setSelectedLine(index);
    }
  };

  const handleSelectTranslation = (newText) => {
    setCustomTranslations(prev => ({
      ...prev,
      [selectedLine]: newText
    }));
  };
  // --------------------------------

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

  const rawTitle = song.title_zh || "";
  const displayTitle = scriptMode === 'traditional' ? tify(rawTitle) : sify(rawTitle);
  const displayArtist = scriptMode === 'traditional' ? tify(song.artist_zh) : sify(song.artist_zh);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 dark:text-white pb-20 transition-colors duration-500">
      
      <Helmet>
        <title>{displayTitle} - {song.artist_en} | CN Lyric Hub</title>
        {/* ... SEO Meta Tags (Keep existing) ... */}
      </Helmet>

      {/* HERO SECTION (Keep existing) */}
      <div className="relative h-[50vh] overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-b from-slate-900/50 ${isDarkMode ? 'to-slate-950' : 'to-[#f8fafc]'} z-10`} />
        <img src={song.cover_url} className="w-full h-full object-cover opacity-50 blur-xl scale-110" alt="Background" />
        <div className="absolute bottom-0 left-0 z-20 p-6 md:p-12 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-end gap-8">
          <img src={song.cover_url} className="w-48 h-48 rounded-2xl shadow-2xl border border-white/10" alt={displayTitle} />
          <div className="mb-4 flex-1">
             <button onClick={() => navigate('/')} className="text-slate-200 hover:text-white flex items-center mb-6 text-sm font-bold bg-white/10 w-fit px-4 py-2 rounded-full backdrop-blur-md transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Library
            </button>
            <h1 className="text-4xl md:text-6xl font-black mb-2 tracking-tight text-white">{displayTitle}</h1>
            {song.title_en && <p className="text-2xl text-slate-400 font-medium mb-4 italic">{song.title_en}</p>}
            <p className="text-2xl text-primary font-medium">{song.artist_en} <span className="text-slate-300 text-lg ml-2">{displayArtist}</span></p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
        
        {/* LYRICS COLUMN */}
        <div className="lg:col-span-2 space-y-4">
           {/* Controls Header */}
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Music className="w-5 h-5" /> Lyrics
             </h3>
             <div className="flex gap-4 items-center">
                 <button onClick={toggleScript} className="flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border border-slate-700 hover:border-primary hover:text-primary transition-all text-slate-400">
                    <Globe className="w-3 h-3" />
                    {scriptMode === 'simplified' ? '简 Simplified' : '繁 Traditional'}
                 </button>
                 <button onClick={() => navigate(`/edit/${song.id}`)} className="text-xs text-slate-400 hover:text-primary">Suggest Edit</button>
             </div>
           </div>
           
           {/* --- UPDATED LYRICS RENDERER --- */}
           <div className="space-y-4">
            {lines.map((_, index) => {
              const line = chineseLines[index] || ""; 
              // Note: We ignore Pinyin for the interaction, but you could pass it to LyricLine if you want to display it there
              const defaultEnglish = englishLines[index] || "";
              
              // LOGIC: Use User's Custom Translation OR Default English
              const activeTranslation = customTranslations[index] || defaultEnglish;

              if (!line.trim() && !activeTranslation.trim()) return <div key={index} className="h-6"></div>;

              return (
                <LyricLine
                    key={index}
                    index={index}
                    originalText={line}
                    translatedText={activeTranslation}
                    isActive={selectedLine === index}
                    // For now, we assume lines have options if they aren't empty. 
                    // In a future advanced version, you could pre-fetch which lines have translations.
                    hasOptions={true} 
                    onClick={handleLineClick}
                />
              );
            })}
           </div>
           {/* ------------------------------- */}

           {/* CREDITS & COMMENTS (Keep existing) */}
           {song.credits && (
             <div className="mt-16 pt-10 border-t border-slate-800/50">
               <h3 className="text-xl font-bold text-slate-400 flex items-center gap-2 mb-6"><Info className="w-5 h-5" /> About This Song</h3>
               <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap">{song.credits}</div>
             </div>
           )}

           <div className="mt-16 border-t border-slate-800 pt-12">
              <CommentsSection songId={song.id} />
           </div>

        </div>

        {/* MEDIA COLUMN */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {videoId ? (
              <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
                <div className="aspect-video">
                  <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube" frameBorder="0" allowFullScreen></iframe>
                </div>
                <div className="p-4 bg-slate-900 text-white">
                  <p className="text-sm text-slate-400 flex items-center gap-2"><Youtube className="w-4 h-4 text-red-500" /> Watch official video</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center text-slate-500">No video available</div>
            )}
            
            {/* Info Card (Keep existing) */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                {/* ... (Keep your existing Info Card code) ... */}
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-white">Song Details</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex flex-col gap-2">
                    <span className="text-slate-500 text-sm">Tags</span>
                    <div className="flex flex-wrap gap-2">
                      {song.tags?.map((tag, i) => <span key={i} className="text-xs bg-slate-800 text-primary px-2 py-1 rounded border border-slate-700">#{tag}</span>)}
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-slate-500">Added By</span><span className="text-slate-300">{song.submitted_by || "Community"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Added On</span><span className="text-slate-300">{new Date(song.created_at).toLocaleDateString()}</span></div>
                </div>
            </div>
          </div>
        </div>

        {/* --- SIDEBAR (CONDITIONAL RENDER) --- */}
        {selectedLine !== null && (
            <LineSidebar 
                songId={song.id}
                lineIndex={selectedLine}
                originalContent={chineseLines[selectedLine]}
                // ADD THIS LINE BELOW:
                defaultTranslation={englishLines[selectedLine] || "No default translation"} 
                onClose={() => setSelectedLine(null)}
                onSelectTranslation={handleSelectTranslation}
            />
        )}

      </div>
    </div>
  );
};

export default SongPage;