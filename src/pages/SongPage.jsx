import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Youtube, Info, Globe, Type, Settings, Plus, Minus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { tify, sify } from 'chinese-conv'; 
import { useTheme } from '../context/ThemeContext'; 
import { Helmet } from 'react-helmet-async'; 
import CommentsSection from '../components/CommentsSection';

import LyricLine from '../components/LyricLine';
import LineSidebar from '../components/LineSidebar';

const SongPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme(); 
  
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scriptMode, setScriptMode] = useState('simplified'); 

  // --- NEW GRANULAR FONT STATE ---
  // We use numbers 0-4 to represent sizes: XS, S, M, L, XL
  const [fontSettings, setFontSettings] = useState(() => {
    const saved = localStorage.getItem('lyric_font_settings');
    return saved ? JSON.parse(saved) : { pinyin: 1, zh: 2, en: 1 }; // Default values
  });

  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
  
  const [selectedLine, setSelectedLine] = useState(null); 
  const [customTranslations, setCustomTranslations] = useState(() => {
    const saved = localStorage.getItem(`prefs_${slug}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Save prefs
  useEffect(() => {
    localStorage.setItem(`prefs_${slug}`, JSON.stringify(customTranslations));
  }, [customTranslations, slug]);

  useEffect(() => {
    localStorage.setItem('lyric_font_settings', JSON.stringify(fontSettings));
  }, [fontSettings]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSong = async () => {
      const { data } = await supabase.from('songs').select('*').eq('slug', slug).single();
      if (data) setSong(data);
      setLoading(false);
    };
    fetchSong();
  }, [slug]);

  // Helper to safely update size
  const updateSize = (type, increment) => {
    setFontSettings(prev => {
        const current = prev[type];
        const next = current + increment;
        // Clamp between 0 (Tiny) and 4 (Huge)
        if (next < 0 || next > 4) return prev;
        return { ...prev, [type]: next };
    });
  };

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleLineClick = (index) => {
    setSelectedLine(prev => prev === index ? null : index);
  };

  const handleSelectTranslation = (newText) => {
    setCustomTranslations(prev => ({ ...prev, [selectedLine]: newText }));
  };

  if (loading) return <div className="text-slate-500 p-10">Loading lyrics...</div>;
  if (!song) return <div className="text-slate-500 p-10">Song not found.</div>;

  const videoId = getYoutubeId(song.youtube_url);
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

  // Reusable Control Row Component
  const ControlRow = ({ label, type }) => (
    <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider w-12">{label}</span>
        <div className="flex items-center gap-3 bg-slate-950 rounded-lg p-1 border border-slate-700">
            <button 
                onClick={() => updateSize(type, -1)}
                className="p-1 hover:text-white text-slate-500 transition-colors"
                disabled={fontSettings[type] <= 0}
            >
                <Minus size={14} />
            </button>
            
            {/* Visual Indicator of Size */}
            <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map(i => (
                    <div 
                        key={i} 
                        className={`w-1.5 h-3 rounded-full ${i <= fontSettings[type] ? 'bg-primary' : 'bg-slate-800'}`} 
                    />
                ))}
            </div>

            <button 
                onClick={() => updateSize(type, 1)}
                className="p-1 hover:text-white text-slate-500 transition-colors"
                disabled={fontSettings[type] >= 4}
            >
                <Plus size={14} />
            </button>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 dark:text-white pb-20 transition-colors duration-500">
      <Helmet>
        <title>{displayTitle} - {song.artist_en} | CN Lyric Hub</title>
        <meta name="description" content={`Chinese lyrics, Pinyin, and English translation for ${song.title_en} (${song.title_zh}) by ${song.artist_en}.`} />
        
        {/* Open Graph / Facebook / Discord Previews */}
        <meta property="og:title" content={`${displayTitle} - ${song.artist_en}`} />
        <meta property="og:description" content={`Learn the lyrics to ${song.title_en} with Pinyin and English translations.`} />
        <meta property="og:image" content={song.cover_url} />
        <meta property="og:type" content="music.song" />
      </Helmet>

      {/* HERO SECTION */}
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

      <div className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
        
        {/* LYRICS COLUMN */}
        <div className="lg:col-span-2 space-y-4">
           
           {/* Controls Header */}
           <div className="flex justify-between items-center mb-4 relative z-50">
             <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Music className="w-5 h-5" /> Lyrics
             </h3>
             <div className="flex gap-2 items-center">
                 
                 {/* SETTINGS DROPDOWN */}
                 <div className="relative" ref={settingsRef}>
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className={`flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border transition-all ${showSettings ? 'bg-primary text-white border-primary' : 'border-slate-700 text-slate-400 hover:border-primary hover:text-primary'}`}
                    >
                      <Type className="w-3 h-3" /> Appearance
                    </button>
                    
                    {showSettings && (
                      <div className="absolute right-0 top-full mt-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 w-64 animate-in fade-in zoom-in-95 duration-200">
                          <ControlRow label="Pinyin" type="pinyin" />
                          <ControlRow label="Hanzi" type="zh" />
                          <ControlRow label="English" type="en" />
                          
                          <div className="h-px bg-slate-800 my-3" />
                          
                          <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Script</span>
                              <button onClick={toggleScript} className="text-xs bg-slate-950 border border-slate-700 px-3 py-1 rounded-lg text-slate-300 hover:text-white">
                                {scriptMode === 'simplified' ? 'Simplified' : 'Traditional'}
                              </button>
                          </div>
                      </div>
                    )}
                 </div>

                 <button onClick={() => navigate(`/edit/${song.id}`)} className="text-xs text-slate-400 hover:text-primary ml-2">Suggest Edit</button>
             </div>
           </div>
           
           {/* LYRICS LIST */}
           <div className="space-y-4">
            {lines.map((_, index) => {
              const line = chineseLines[index] || ""; 
              const pinyin = pinyinLines[index] || ""; 
              const defaultEnglish = englishLines[index] || "";
              const activeTranslation = customTranslations[index] || defaultEnglish;

              if (!line.trim() && !activeTranslation.trim()) return <div key={index} className="h-6"></div>;

              return (
                <LyricLine
                    key={index}
                    index={index}
                    originalText={line}
                    pinyin={pinyin}
                    translatedText={activeTranslation}
                    isActive={selectedLine === index}
                    fontSettings={fontSettings} // <--- PASS THE WHOLE OBJECT
                    onClick={handleLineClick}
                />
              );
            })}
           </div>

           {/* Credits & Comments */}
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

        {/* Sidebar etc... (Keep existing Media Column & Sidebar) */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {videoId ? (
              <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
                <div className="aspect-video">
                  <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube" frameBorder="0" allowFullScreen></iframe>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center text-slate-500">No video available</div>
            )}
             <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-white mb-4">Song Details</h4>
                <div className="space-y-3 text-sm">
                   <div className="flex flex-wrap gap-2">
                      {song.tags?.map((tag, i) => <span key={i} className="text-xs bg-slate-800 text-primary px-2 py-1 rounded border border-slate-700">#{tag}</span>)}
                   </div>
                </div>
            </div>
          </div>
        </div>

        {selectedLine !== null && (
            <LineSidebar 
                songId={song.id}
                lineIndex={selectedLine}
                originalContent={chineseLines[selectedLine]}
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