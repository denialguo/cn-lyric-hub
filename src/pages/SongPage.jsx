import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Music, Info, Type, Plus, Minus, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { tify, sify } from 'chinese-conv'; 
import { useAuth } from '../context/AuthContext';
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
      <button type="button" onClick={() => updateSize(type, -1)} className="p-2.5 hover:text-white text-slate-400 transition-colors" disabled={fontSettings[type] <= 0} aria-label={`Decrease ${label} size`}>
        <Minus size={14} />
      </button>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`w-1.5 h-3 rounded-full ${i <= fontSettings[type] ? 'bg-primary' : 'bg-slate-800'}`} />
        ))}
      </div>
      <button type="button" onClick={() => updateSize(type, 1)} className="p-2.5 hover:text-white text-slate-400 transition-colors" disabled={fontSettings[type] >= 6} aria-label={`Increase ${label} size`}>
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
              aria-pressed={isSelected}
              aria-label={`${label} colour: ${sw.label}`}
              className={`w-6 h-6 shrink-0 rounded-full transition-all ${
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { scriptMode, toggleScript, lyricColors, setLyricColors } = useTheme(); 
  
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
    setLoadError(false);
    const fetchSong = async () => {
      const { data, error } = await supabase.from('songs').select('*').eq('slug', slug).maybeSingle();
      if (cancelled) return;
      if (error) console.error('Song fetch failed:', error.message);
      setLoadError(Boolean(error));
      setSong(data ?? null);
      setLoading(false);
    };
    fetchSong();
    return () => { cancelled = true; };
  }, [slug, reloadKey]);

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
          <h1 className="text-2xl font-bold text-white mb-2">{loadError ? 'Couldn’t load the lyrics' : 'We couldn’t find that song'}</h1>
          <p className="text-slate-400 mb-8">{loadError ? 'Check your connection and try again.' : 'The link may be out of date, or the song may have been removed.'}</p>
          {loadError && <button onClick={() => setReloadKey(key => key + 1)} className="block mx-auto mb-6 min-h-11 px-6 text-primary">Try again</button>}
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
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-950 hero-gradient z-10 pointer-events-none" />
        {song.cover_url && !coverFailed ? (
          <img src={song.cover_url} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-xl scale-110" alt="" loading="lazy" decoding="async" onError={() => setCoverFailed(true)} />
        ) : (
          <div className="absolute inset-0 bg-slate-900" />
        )}
        <div className="relative z-20 px-6 py-8 md:py-12 w-full max-w-5xl mx-auto flex items-center gap-5 md:gap-8">
          {song.cover_url && !coverFailed ? (
            <img src={song.cover_url} className="w-24 h-24 sm:w-40 sm:h-40 shrink-0 rounded-xl shadow-2xl border border-white/10" alt={`Album cover for ${displayTitle} by ${primaryArtist}`} onError={() => setCoverFailed(true)} />
          ) : (
            <div className="w-24 h-24 sm:w-40 sm:h-40 shrink-0 rounded-xl shadow-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <Music className="w-16 h-16 text-slate-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl md:text-5xl font-black mb-2 tracking-tight text-white">{displayTitle}</h1>
            {song.title_en && song.title_en !== song.title_zh && (
              <p className="text-base sm:text-xl text-slate-400 font-medium mb-3 italic">{song.title_en}</p>
            )}
            <p className="text-base sm:text-xl font-medium">
              {primaryArtist.split(',').map((artist, i, arr) => (
                <span key={i}>
                  <Link to={`/artist/${encodeURIComponent(artist.trim())}`} className="text-primary hover:underline transition-colors">
                    {artist.trim()}
                  </Link>
                  {i < arr.length - 1 && ', '}
                </span>
              ))}
              {showSecondaryArtist && (
                <span className="text-slate-300 text-sm ml-2">
                  {displayArtist}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 relative">
        
        {/* LYRICS COLUMN */}
        <div className="order-2 lg:order-1 lg:col-span-2 min-w-0 space-y-4">
           
           {/* Controls Header */}
           <div className="flex flex-wrap justify-between items-center gap-2 mb-4 relative z-50">
             <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Music className="w-5 h-5" /> Lyrics
             </h3>
             <div className="flex gap-2 items-center">
                 
                 {/* SETTINGS DROPDOWN */}
                 <div ref={settingsRef}>
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      aria-expanded={showSettings}
                      aria-controls="lyric-appearance"
                      className={`flex items-center gap-2 text-xs font-bold px-3 min-h-11 rounded-full border transition-all ${showSettings ? 'bg-primary text-white border-primary' : 'border-slate-700 text-slate-400 hover:border-primary hover:text-primary'}`}
                    >
                      <Type className="w-3 h-3" /> Appearance
                    </button>
                    
                    {showSettings && (
                      <div id="lyric-appearance" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setShowSettings(false); settingsRef.current?.querySelector('button')?.focus(); } }} className="fixed right-4 top-20 sm:absolute sm:right-0 sm:top-full mt-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 w-80 max-w-[calc(100vw-2rem)] sm:max-w-full max-h-[calc(100dvh-7rem)] sm:max-h-[70dvh] overflow-y-auto">
                          
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

                 <button onClick={() => navigate(`/edit/${song.id}`)} className="min-h-11 text-xs text-slate-400 hover:text-primary ml-2">Suggest Edit</button>
             </div>
           </div>
           
           <p className="text-xs text-slate-400">Select a line to compare translations or join the discussion.</p>
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
        <div className="contents lg:block lg:order-2">
          <div className="contents lg:block lg:sticky lg:top-24 lg:space-y-6">
            {videoId && <div className="order-1 aspect-video bg-black rounded-xl overflow-hidden border border-slate-800">
              <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={`${displayTitle} music video`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
            </div>}
             <div className="order-3 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
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
                       <span className="text-primary text-xs font-bold">Available</span>
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
                key={`${song.id}:${selectedLine}:${user?.id || 'guest'}`}
                selectedTranslation={customTranslations[selectedLine] || null}
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
