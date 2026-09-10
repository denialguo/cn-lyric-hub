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
import { readJson, writeJson } from '../lib/storage';

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

// Defined at module scope on purpose: declaring these inside SongPage's body made
// them a new component type every render, remounting the panel on each keystroke.
const SizeControl = ({ label, type, fontSettings, updateSize }) => (
  <div className="flex items-center justify-between gap-4 mb-2">
    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider w-16">{label}</span>
    <div className="flex items-center gap-3 bg-slate-950 rounded-lg p-1 border border-slate-700">
      <button type="button" onClick={() => updateSize(type, -1)} className="p-1 hover:text-white text-slate-500 transition-colors" disabled={fontSettings[type] <= 0} aria-label={`Decrease ${label} size`}>
        <Minus size={14} />
      </button>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`w-1.5 h-3 rounded-full ${i <= fontSettings[type] ? 'bg-primary' : 'bg-slate-800'}`} />
        ))}
      </div>
      <button type="button" onClick={() => updateSize(type, 1)} className="p-1 hover:text-white text-slate-500 transition-colors" disabled={fontSettings[type] >= 6} aria-label={`Increase ${label} size`}>
        <Plus size={14} />
      </button>
    </div>
  </div>
);

const ColorRow = ({ label, type, lyricColors, updateColor }) => {
  const current = lyricColors[type];
  return (
    <div className="flex items-center justify-between gap-4 mb-3">
      <span className="text-slate-400 text-xs font-bold uppercase tracking-wider w-16">{label}</span>
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {colorSwatches.map(sw => {
          const isSelected = sw.hex ? current === sw.hex : current === 'default';
          return (
            <button
              key={sw.id}
              type="button"
              onClick={() => updateColor(type, sw)}
              title={sw.label}
              aria-label={`${label} colour: ${sw.label}`}
              className={`w-5 h-5 rounded-full transition-all ${
                isSelected
                  ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110'
                  : 'opacity-60 hover:opacity-100 hover:scale-105'
              }`}
              style={{ backgroundColor: sw.hex || 'transparent', border: !sw.hex ? '2px dashed rgb(71 85 105)' : 'none' }}
            />
          );
        })}
      </div>
    </div>
  );
};

const SongPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { scriptMode, toggleScript, lyricColors, setLyricColors } = useTheme(); 
  
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);

  const [fontSettings, setFontSettings] = useState(() =>
    readJson('lyric_font_settings', { pinyin: 1, zh: 3, en: 2 })
  );

  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
  
  const [selectedLine, setSelectedLine] = useState(null); 
  const [customTranslations, setCustomTranslations] = useState({});
  const [submitterUsername, setSubmitterUsername] = useState(null);
  const [coverFailed, setCoverFailed] = useState(false);

  // Reload per-song line preferences whenever the slug changes. This must be an
  // effect, not a useState initializer — an initializer runs once per mount, and
  // SongPage stays mounted while navigating between songs.
  useEffect(() => {
    setCustomTranslations(readJson(`prefs_${slug}`, {}));
  }, [slug]);

  useEffect(() => {
    // Don't persist the empty object the slug-change reset briefly holds, or it
    // would wipe the stored prefs for the song we're navigating to.
    if (Object.keys(customTranslations).length) writeJson(`prefs_${slug}`, customTranslations);
  }, [customTranslations, slug]);

  useEffect(() => {
    writeJson('lyric_font_settings', fontSettings);
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
    // Guard against a slow response for an old slug landing after a newer one
    let cancelled = false;
    // Clear the previous song first: without this, a failed fetch left the old
    // song's lyrics on screen under the new URL.
    setSong(null);
    setSelectedLine(null);
    setCoverFailed(false);
    setLoading(true);
    const fetchSong = async () => {
      const { data, error } = await supabase.from('songs').select('*').eq('slug', slug).single();
      if (cancelled) return;
      if (error) console.error('Song fetch failed:', error.message);
      setSong(data ?? null);
      setLoading(false);
    };
    fetchSong();
    return () => { cancelled = true; };
  }, [slug]);

  // Resolve the submitter to a real profile so we only ever link somewhere that
  // exists. songs.user_id references auth.users, not profiles, so there is no FK
  // to embed through — this is a deliberate second query.
  useEffect(() => {
    if (!song?.user_id) { setSubmitterUsername(null); return; }
    let cancelled = false;
    supabase.from('profiles').select('username').eq('id', song.user_id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setSubmitterUsername(data?.username ?? null); });
    return () => { cancelled = true; };
  }, [song?.user_id]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="max-w-5xl mx-auto px-6 py-20 text-slate-500">Loading lyrics…</div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Helmet>
          <title>Song not found | CN Lyric Hub</title>
          {/* Bad slugs must not be indexed as thin duplicates of each other */}
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-full border border-slate-800 mb-6">
            <Music className="w-7 h-7 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">We couldn't find that song</h1>
          <p className="text-slate-400 mb-8">The link may be out of date, or the song may have been removed.</p>
          <Link to="/" className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-full hover:opacity-90 transition-opacity">
            Browse the library
          </Link>
        </div>
      </div>
    );
  }

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


  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 dark:text-white pb-20">
      <Helmet>
        <title>{displayTitle} - {primaryArtist} | CN Lyric Hub</title>
        <meta name="description" content={`Read ${displayTitle} by ${primaryArtist} with character-by-character Pinyin and English translation on CN Lyric Hub.`} />
        <link rel="canonical" href={`https://cnlyrichub.vercel.app/song/${song.slug}`} />
        <meta property="og:title" content={`${displayTitle} - ${primaryArtist}`} />
        <meta property="og:description" content={`Learn the lyrics to ${displayTitle} with Pinyin and English translations.`} />
        <meta property="og:image" content={song.cover_url || 'https://cnlyrichub.vercel.app/logo.png'} />
        <meta property="og:type" content="music.song" />
        <meta property="og:url" content={`https://cnlyrichub.vercel.app/song/${song.slug}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'MusicComposition',
          name: song.title_zh || song.title_en,
          alternativeHeadline: song.title_en || undefined,
          inLanguage: 'zh',
          url: `https://cnlyrichub.vercel.app/song/${song.slug}`,
          image: song.cover_url || undefined,
          datePublished: song.year ? String(song.year) : undefined,
          composer: primaryArtist !== 'Unknown' ? { '@type': 'MusicGroup', name: primaryArtist } : undefined,
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://cnlyrichub.vercel.app/' },
            ...(primaryArtist !== 'Unknown' ? [{
              '@type': 'ListItem', position: 2, name: primaryArtist,
              item: `https://cnlyrichub.vercel.app/artist/${encodeURIComponent(primaryArtist)}`,
            }] : []),
            {
              '@type': 'ListItem', position: primaryArtist !== 'Unknown' ? 3 : 2, name: displayTitle,
              item: `https://cnlyrichub.vercel.app/song/${song.slug}`,
            },
          ],
        })}</script>
      </Helmet>

      <Navbar />

      {/* HERO SECTION */}
      <div className="relative h-[50vh] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-950 hero-gradient z-10 pointer-events-none" />
        {song.cover_url && !coverFailed ? (
          <img src={song.cover_url} className="w-full h-full object-cover opacity-50 blur-xl scale-110" alt="" loading="lazy" decoding="async" onError={() => setCoverFailed(true)} />
        ) : (
          <div className="w-full h-full bg-slate-900" />
        )}
        <div className="absolute bottom-0 left-0 z-20 p-6 md:p-12 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-end gap-8">
          {song.cover_url && !coverFailed ? (
            <img src={song.cover_url} className="w-48 h-48 rounded-2xl shadow-2xl border border-white/10" alt={`Album cover for ${displayTitle} by ${primaryArtist}`} onError={() => setCoverFailed(true)} />
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
                  <Link to={`/artist/${encodeURIComponent(artist.trim())}`} className="text-primary hover:underline transition-colors">
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
                          <SizeControl label="Pinyin" type="pinyin" fontSettings={fontSettings} updateSize={updateSize} />
                          <SizeControl label="Hanzi" type="zh" fontSettings={fontSettings} updateSize={updateSize} />
                          <SizeControl label="English" type="en" fontSettings={fontSettings} updateSize={updateSize} />
                          
                          <div className="h-px bg-slate-800 my-4" />
                          
                          {/* COLOR CONTROLS */}
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-3">Colors</p>
                          <ColorRow label="Pinyin" type="pinyin" lyricColors={lyricColors} updateColor={updateColor} />
                          <ColorRow label="Hanzi" type="hanzi" lyricColors={lyricColors} updateColor={updateColor} />
                          <ColorRow label="English" type="english" lyricColors={lyricColors} updateColor={updateColor} />

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
                  <iframe width="100%" height="100%" src={`https://www.youtube-nocookie.com/embed/${videoId}`} title="YouTube" frameBorder="0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>
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
                   <div className="flex justify-between text-slate-400">
                     <span>Source</span>
                     {/* submitted_by holds free-text display names ('Anonymous', 'admin'),
                         not usernames, so linking it blindly produced ~1600 dead links
                         to "User not found". Link only a confirmed profile. */}
                     {song.source === 'import' ? (
                       <span className="text-slate-300">Imported</span>
                     ) : submitterUsername ? (
                       <Link to={`/user/${encodeURIComponent(submitterUsername)}`} className="text-primary hover:underline">
                         {submitterUsername}
                       </Link>
                     ) : (
                       <span className="text-slate-300">{song.submitted_by || 'Community'}</span>
                     )}
                   </div>
                   {song.last_edited_by && (
                     <div className="flex justify-between text-slate-400">
                       <span>Last edited by</span>
                       <span className="text-slate-300">{song.last_edited_by}</span>
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