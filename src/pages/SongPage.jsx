import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Music, Youtube, Info, Type, Plus, Minus, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { tify, sify } from 'chinese-conv'; 
import { useTheme } from '../context/ThemeContext'; 
import { Helmet } from 'react-helmet-async'; 
import CommentsSection from '../components/CommentsSection';
import Navbar from '../components/Navbar';
import LyricLine from '../components/LyricLine';
import LineSidebar from '../components/LineSidebar';

// Color swatches for the picker
const colorSwatches = [
  { id: 'default', hex: null, label: 'Default' },
  { id: 'cyan',    hex: '#06b6d4', label: 'Cyan' },
  { id: 'rose',    hex: '#f43f5e', label: 'Rose' },
  { id: 'violet',  hex: '#8b5cf6', label: 'Violet' },
  { id: 'amber',   hex: '#f59e0b', label: 'Amber' },
  { id: 'emerald', hex: '#10b981', label: 'Emerald' },
  { id: 'blue',    hex: '#3b82f6', label: 'Blue' },
  { id: 'pink',    hex: '#ec4899', label: 'Pink' },
];

const SongPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { scriptMode, toggleScript, lyricColors, setLyricColors } = useTheme(); 
  
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);

  const [fontSettings, setFontSettings] = useState(() => {
    const saved = localStorage.getItem('lyric_font_settings');
    return saved ? JSON.parse(saved) : { pinyin: 1, zh: 3, en: 2 };
  });

  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
  
  const [selectedLine, setSelectedLine] = useState(null); 
  const [customTranslations, setCustomTranslations] = useState(() => {
    const saved = localStorage.getItem(`prefs_${slug}`);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(`prefs_${slug}`, JSON.stringify(customTranslations));
  }, [customTranslations, slug]);

  useEffect(() => {
    localStorage.setItem('lyric_font_settings', JSON.stringify(fontSettings));
  }, [fontSettings]);

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

  const updateSize = (type, increment) => {
    setFontSettings(prev => {
        const next = prev[type] + increment;
        if (next < 0 || next > 6) return prev;
        return { ...prev, [type]: next };
    });
  };

  const updateColor = (type, swatch) => {
    setLyricColors(prev => ({ ...prev, [type]: swatch.hex || 'default' }));
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

  const rawTitle = song.title_zh || song.title_en || "";
  const displayTitle = song.title_zh 
    ? (scriptMode === 'traditional' ? tify(rawTitle) : sify(rawTitle))
    : rawTitle;
  const primaryArtist = song.artist_en || song.artist_zh || 'Unknown';
  const displayArtist = song.artist_zh 
    ? (scriptMode === 'traditional' ? tify(song.artist_zh) : sify(song.artist_zh))
    : '';
  // Skip showing secondary name if it's essentially the same as primary
  const showSecondaryArtist = displayArtist 
    && song.artist_en 
    && song.artist_zh
    && sify(song.artist_en) !== sify(song.artist_zh);

  // Reusable size control
  const SizeControl = ({ label, type }) => (
    <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider w-16">{label}</span>
        <div className="flex items-center gap-3 bg-slate-950 rounded-lg p-1 border border-slate-700">
            <button onClick={() => updateSize(type, -1)} className="p-1 hover:text-white text-slate-500 transition-colors" disabled={fontSettings[type] <= 0}>
                <Minus size={14} />
            </button>
            <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className={`w-1.5 h-3 rounded-full ${i <= fontSettings[type] ? 'bg-primary' : 'bg-slate-800'}`} />
                ))}
            </div>
            <button onClick={() => updateSize(type, 1)} className="p-1 hover:text-white text-slate-500 transition-colors" disabled={fontSettings[type] >= 6}>
                <Plus size={14} />
            </button>
        </div>
    </div>
  );

  // Reusable color picker row
  const ColorRow = ({ label, type }) => {
    const current = lyricColors[type];
    return (
      <div className="flex items-center justify-between gap-4 mb-3">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider w-16">{label}</span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {colorSwatches.map(s => {
            const isSelected = s.hex ? current === s.hex : current === 'default';
            return (
              <button
                key={s.id}
                onClick={() => updateColor(type, s)}
                title={s.label}
                className={`w-5 h-5 rounded-full transition-all ${
                  isSelected 
                    ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110' 
                    : 'opacity-60 hover:opacity-100 hover:scale-105'
                }`}
                style={{ 
                  backgroundColor: s.hex || 'transparent',
                  border: !s.hex ? '2px dashed rgb(71 85 105)' : 'none'
                }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 dark:text-white pb-20">
      <Helmet>
        <title>{displayTitle} - {primaryArtist} | CN Lyric Hub</title>
        <meta name="description" content={`Read ${displayTitle} by ${primaryArtist} with character-by-character Pinyin and English translation on CN Lyric Hub.`} />
        <link rel="canonical" href={`https://cn-lyric-hub.vercel.app/song/${song.slug}`} />
        <meta property="og:title" content={`${displayTitle} - ${primaryArtist}`} />
        <meta property="og:description" content={`Learn the lyrics to ${displayTitle} with Pinyin and English translations.`} />
        <meta property="og:image" content={song.cover_url || 'https://cn-lyric-hub.vercel.app/logo.png'} />
        <meta property="og:type" content="music.song" />
        <meta property="og:url" content={`https://cn-lyric-hub.vercel.app/song/${song.slug}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'MusicComposition',
          name: song.title_zh || song.title_en,
          alternativeHeadline: song.title_en || undefined,
          inLanguage: 'zh',
          url: `https://cn-lyric-hub.vercel.app/song/${song.slug}`,
          image: song.cover_url || undefined,
          datePublished: song.year ? String(song.year) : undefined,
          composer: primaryArtist !== 'Unknown' ? { '@type': 'MusicGroup', name: primaryArtist } : undefined,
        })}</script>
      </Helmet>

      <Navbar />

      {/* HERO SECTION */}
      <div className="relative h-[50vh] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-950 hero-gradient z-10 pointer-events-none" />
        {song.cover_url ? (
          <img src={song.cover_url} className="w-full h-full object-cover opacity-50 blur-xl scale-110" alt="Background" />
        ) : (
          <div className="w-full h-full bg-slate-900" />
        )}
        <div className="absolute bottom-0 left-0 z-20 p-6 md:p-12 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-end gap-8">
          {song.cover_url ? (
            <img src={song.cover_url} className="w-48 h-48 rounded-2xl shadow-2xl border border-white/10" alt={displayTitle} />
          ) : (
            <div className="w-48 h-48 rounded-2xl shadow-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <Music className="w-16 h-16 text-slate-600" />
            </div>
          )}
          <div className="mb-4 flex-1">
            <h1 className="text-4xl md:text-6xl font-black mb-2 tracking-tight text-white">{displayTitle}</h1>
            {song.title_en && song.title_en !== song.title_zh && (
              <p className="text-2xl text-slate-400 font-medium mb-4 italic">{song.title_en}</p>
            )}
            <p className="text-2xl font-medium">
              {primaryArtist.split(',').map((artist, i, arr) => (
                <span key={i}>
                  <Link to={`/artist/${artist.trim()}`} className="text-primary hover:underline transition-colors">
                    {artist.trim()}
                  </Link>
                  {i < arr.length - 1 && ', '}
                </span>
              ))}
              {showSecondaryArtist && (
                <span className="text-slate-300 text-lg ml-2">
                  {displayArtist}
                </span>
              )}
            </p>
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
                      <div className="absolute right-0 top-full mt-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 w-80 animate-in fade-in zoom-in-95 duration-200">
                          
                          {/* SIZE CONTROLS */}
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-3">Size</p>
                          <SizeControl label="Pinyin" type="pinyin" />
                          <SizeControl label="Hanzi" type="zh" />
                          <SizeControl label="English" type="en" />
                          
                          <div className="h-px bg-slate-800 my-4" />
                          
                          {/* COLOR CONTROLS */}
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-3">Colors</p>
                          <ColorRow label="Pinyin" type="pinyin" />
                          <ColorRow label="Hanzi" type="hanzi" />
                          <ColorRow label="English" type="english" />

                          {/* Reset colors */}
                          {(lyricColors.pinyin !== 'default' || lyricColors.hanzi !== 'default' || lyricColors.english !== 'default') && (
                            <button 
                              onClick={() => setLyricColors({ pinyin: 'default', hanzi: 'default', english: 'default' })}
                              className="w-full mt-2 text-[10px] text-slate-500 hover:text-white flex items-center justify-center gap-1 py-1 transition-colors"
                            >
                              <RotateCcw size={10} /> Reset colors
                            </button>
                          )}

                          <div className="h-px bg-slate-800 my-4" />
                          
                          {/* SCRIPT TOGGLE */}
                          <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Script</span>
                              <button onClick={toggleScript} className="text-sm bg-slate-950 border border-slate-700 px-4 py-1.5 rounded-lg text-white hover:border-primary hover:text-primary transition-colors font-medium">
                                {scriptMode === 'simplified' ? '简体字' : '繁体字'}
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
              const py = pinyinLines[index] || ""; 
              const defaultEnglish = englishLines[index] || "";
              const activeTranslation = customTranslations[index] || defaultEnglish;

              if (!line.trim() && !activeTranslation.trim()) return <div key={index} className="h-6"></div>;

              return (
                <LyricLine
                    key={index}
                    index={index}
                    originalText={line}
                    pinyin={py}
                    translatedText={activeTranslation}
                    isActive={selectedLine === index}
                    fontSettings={fontSettings}
                    lyricColors={lyricColors}
                    onClick={handleLineClick}
                />
              );
            })}
           </div>

           {/* Bio */}
           {song.bio && (
             <div className="mt-16 pt-10 border-t border-slate-800/50">
               <h3 className="text-xl font-bold text-slate-400 flex items-center gap-2 mb-6"><Info className="w-5 h-5" /> About This Song</h3>
               <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap">{song.bio}</div>
             </div>
           )}

           {/* Credits */}
           {song.credits && (
             <div className="mt-10 pt-10 border-t border-slate-800/50">
               <h3 className="text-xl font-bold text-slate-400 flex items-center gap-2 mb-6"><Info className="w-5 h-5" /> Credits</h3>
               <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap">{song.credits}</div>
             </div>
           )}

           <div className="mt-16 border-t border-slate-800 pt-12">
              <CommentsSection songId={song.id} />
           </div>
        </div>

        {/* SIDEBAR */}
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
                   <div className="flex justify-between text-slate-400">
                     <span>Added</span>
                     <span className="text-slate-300">{new Date(song.created_at).toLocaleDateString()}</span>
                   </div>
                   {song.year && (
                     <div className="flex justify-between text-slate-400">
                       <span>Released</span>
                       <span className="text-slate-300">{song.year}</span>
                     </div>
                   )}
                   {song.submitted_by && (
                     <div className="flex justify-between text-slate-400">
                       <span>Submitted by</span>
                       <Link to={`/user/${song.submitted_by}`} className="text-primary hover:underline">{song.submitted_by}</Link>
                     </div>
                   )}
                   {song.last_edited_by && (
                     <div className="flex justify-between text-slate-400">
                       <span>Last edited by</span>
                       <Link to={`/user/${song.last_edited_by}`} className="text-primary hover:underline">{song.last_edited_by}</Link>
                     </div>
                   )}
                   <div className="flex justify-between text-slate-400">
                     <span>Lines</span>
                     <span className="text-slate-300">{chineseLines.filter(l => l.trim()).length}</span>
                   </div>
                   {englishLines.some(l => l.trim()) && (
                     <div className="flex justify-between text-slate-400">
                       <span>Translation</span>
                       <span className="text-emerald-400 text-xs font-bold">Available</span>
                     </div>
                   )}
                   {song.tags && song.tags.length > 0 && (
                     <>
                       <div className="h-px bg-slate-800 my-1" />
                       <div className="flex flex-wrap gap-2">
                         {song.tags.map((tag, i) => <span key={i} className="text-xs bg-slate-800 text-primary px-2 py-1 rounded border border-slate-700">#{tag}</span>)}
                       </div>
                     </>
                   )}
                </div>
            </div>
          </div>
        </div>

        {selectedLine !== null && (
            <LineSidebar 
                songId={song.id}
                lineIndex={selectedLine}
                originalContent={chineseLines[selectedLine]}
                pinyinContent={pinyinLines[selectedLine]}
                defaultTranslation={englishLines[selectedLine] || ""} 
                onClose={() => setSelectedLine(null)}
                onSelectTranslation={handleSelectTranslation}
            />
        )}
      </div>
    </div>
  );
};

export default SongPage;