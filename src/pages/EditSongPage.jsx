import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, CheckCircle, XCircle, Search, X, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput'; 
import { pinyin } from 'pinyin-pro';

// --- REUSED COMPONENTS (LyricsEditor + ArtistSearch) ---
const LyricsEditor = ({ label, name, value, onChange, placeholder, minHeight = '150px' }) => {
  const textareaRef = useRef(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);
  
  const lineCount = value ? value.split('\n').length : 1;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 5) }, (_, i) => i + 1).join('\n');

  return (
    <div className="flex flex-col gap-2">
      <label className="text-slate-400 text-sm font-bold flex justify-between">{label}</label>
      <div className="relative flex border border-slate-700 rounded-xl overflow-hidden bg-slate-900 focus-within:border-primary transition-colors">
        <div className="bg-slate-800 text-slate-500 text-right pr-3 pt-4 font-mono text-sm leading-6 select-none w-10 flex-shrink-0 border-r border-slate-700">
          <pre>{lineNumbers}</pre>
        </div>
        <textarea
          ref={textareaRef} name={name} value={value} onChange={onChange} rows={1}
          className="w-full bg-slate-900 text-white p-4 font-mono text-sm leading-6 outline-none resize-none whitespace-pre overflow-x-auto overflow-y-hidden"
          placeholder={placeholder} style={{ minHeight: minHeight }}
        />
      </div>
    </div>
  );
};

const ArtistSearch = ({ selectedArtists, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchDB = async () => {
        if (!query.trim()) { setResults([]); return; }
        setSearching(true);
        const { data } = await supabase.from('artists').select('*').or(`name_en.ilike.%${query}%,name_zh.ilike.%${query}%`).limit(5);
        setResults(data || []);
        setSearching(false);
    };
    const debounce = setTimeout(searchDB, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (artist) => {
    onSelect(artist);
    setQuery('');
    setShowDropdown(false);
  };

  const createNewArtist = () => {
    const newArtist = { id: null, name_en: query, name_zh: '', isNew: true };
    onSelect(newArtist);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className="relative space-y-2" ref={wrapperRef}>
        <label className="text-slate-400 text-sm font-bold">Artists <span className="text-primary">*</span></label>
        <div className="flex flex-wrap gap-2 mb-2">
            {selectedArtists.map((artist, i) => (
                <div key={artist.id || i} className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border ${artist.isNew ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-primary/10 border-primary/50 text-primary'}`}>
                    <span>{artist.name_en || artist.name_zh} {artist.name_zh && artist.name_en ? `(${artist.name_zh})` : ''}</span>
                    <button type="button" onClick={() => onSelect(artist, true)}><X size={12} /></button>
                </div>
            ))}
        </div>
        <div className="relative">
            <input value={query} onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} placeholder="Search for artist..." className="w-full bg-slate-900 border border-slate-700 p-3 pl-10 rounded-lg text-white focus:border-primary outline-none" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
        </div>
        {showDropdown && query && (
            <div className="absolute z-50 w-full bg-slate-800 border border-slate-700 rounded-lg mt-1 shadow-xl overflow-hidden">
                {searching ? <div className="p-4 text-xs text-slate-500 text-center">Searching...</div> : (
                    <>
                        {results.map(artist => (
                            <div key={artist.id} onClick={() => handleSelect(artist)} className="p-3 hover:bg-slate-700 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0">
                                <div className="w-8 h-8 bg-slate-600 rounded-full overflow-hidden flex-shrink-0">
                                    {artist.avatar_url ? <img src={artist.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">?</div>}
                                </div>
                                <div><p className="text-sm font-bold text-white">{artist.name_en}</p><p className="text-xs text-slate-400">{artist.name_zh}</p></div>
                            </div>
                        ))}
                        <div onClick={createNewArtist} className="p-3 hover:bg-emerald-500/20 cursor-pointer flex items-center gap-2 text-emerald-400 border-t border-white/10">
                            <UserPlus size={16} /><span className="text-sm font-bold">Create new artist "{query}"</span>
                        </div>
                    </>
                )}
            </div>
        )}
    </div>
  );
};
// ----------------------------------------------------

const EditSongPage = ({ isReviewMode = false }) => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [tags, setTags] = useState([]);
  const [selectedArtists, setSelectedArtists] = useState([]); // List of Artist Objects

  const [formData, setFormData] = useState({
    title_en: '', title_zh: '', cover_url: '', youtube_url: '', slug: '',
    lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '', credits: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      const tableName = isReviewMode ? 'song_submissions' : 'songs';
      
      // 1. Fetch Basic Song Data
      const { data: song, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      
      if (error) {
        alert("Error loading data");
        navigate('/admin');
        return;
      }
      
      setFormData(song);
      if (song.tags) setTags(song.tags);

      // 2. Fetch Linked Artists (The "Professional" Way)
      // Only applicable for live songs. Submissions usually rely on the legacy strings unless you built robust linking for them too.
      if (!isReviewMode) {
          const { data: linkedArtists } = await supabase
            .from('song_artists')
            .select('artist_id, artists(*)') // Join to get full artist details
            .eq('song_id', id);
          
          if (linkedArtists) {
              const artistObjects = linkedArtists.map(link => link.artists).filter(Boolean);
              setSelectedArtists(artistObjects);
          }
      } else {
          // Fallback for Review Mode (Parsing Legacy Strings if needed)
          // Ideally your submission system should also store artist objects, but parsing is a safe fallback
          // For now, we leave it empty or you can implement parsing logic here if needed.
      }
      
      setFetching(false);
    };
    fetchData();
  }, [id, navigate, isReviewMode]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSelectArtist = (artist, remove = false) => {
      if (remove) {
          setSelectedArtists(prev => prev.filter(a => (a.id !== artist.id) || (a.isNew && a.name_en !== artist.name_en)));
      } else {
          if (!selectedArtists.some(a => a.id === artist.id && !a.isNew)) {
            setSelectedArtists([...selectedArtists, artist]);
          }
      }
  };

  const handleAutoPinyin = () => {
    if (!formData.lyrics_chinese) return;
    const lines = formData.lyrics_chinese.split('\n');
    const pinyinLines = lines.map(line => {
      const clean = line.replace(/，/g, ',').replace(/。/g, '.').replace(/！/g, '!').replace(/？/g, '?');
      return pinyin(clean, { toneType: 'symbol' });
    });
    setFormData(prev => ({ ...prev, lyrics_pinyin: pinyinLines.join('\n') }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (selectedArtists.length === 0) {
        setLoading(false);
        return alert("Please add at least one artist.");
    }

    // 1. Generate Legacy Strings (For search compatibility)
    const artistEnString = selectedArtists.map(a => a.name_en).join(', ');
    const artistZhString = selectedArtists.map(a => a.name_zh).join(', ');

    let finalSlug = formData.slug;
    if (!finalSlug) {
       const source = formData.title_en || formData.title_zh || "untitled";
       const pinyinTitle = pinyin(source, { toneType: 'none', nonZh: 'consecutive' });
       finalSlug = pinyinTitle.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-') + '-' + Math.floor(Math.random() * 1000);
    }

    const basePayload = {
        ...formData,
        artist_en: artistEnString,
        artist_zh: artistZhString,
        tags: tags,
        slug: finalSlug
    };

    try {
        if (isReviewMode) {
            // --- APPROVE LOGIC ---
            // 1. Insert into Live 'songs'
            const { id: _ignoreId, created_at, status, submitter_ip, ...cleanPayload } = basePayload;
            const { data: newSong, error: insertError } = await supabase.from('songs').insert([cleanPayload]).select().single();
            if (insertError) throw insertError;

            // 2. Link Artists to New Song
            for (const artist of selectedArtists) {
                let artistId = artist.id;
                if (artist.isNew) {
                    const artistSlug = artist.name_en.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
                    const { data: createdArtist } = await supabase.from('artists').insert({ name_en: artist.name_en, name_zh: artist.name_zh, slug: artistSlug }).select().single();
                    artistId = createdArtist.id;
                }
                await supabase.from('song_artists').insert({ song_id: newSong.id, artist_id: artistId });
            }

            // 3. Delete Submission
            await supabase.from('song_submissions').delete().eq('id', id);
            alert("Approved & Published!");
            navigate('/admin');
            
        } else {
            // --- NORMAL EDIT LOGIC ---
            
            // 1. Update Song Data
            const { error } = await supabase.from('songs').update(basePayload).eq('id', id);
            if (error) throw error;

            // 2. Sync Artists (The Hard Part)
            // Strategy: Delete all existing links for this song, then re-insert current ones.
            // This is brute-force but safe and easy for a CMS.
            await supabase.from('song_artists').delete().eq('song_id', id);

            for (const artist of selectedArtists) {
                let artistId = artist.id;
                if (artist.isNew) {
                     const artistSlug = artist.name_en.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
                     const { data: createdArtist } = await supabase.from('artists').insert({ name_en: artist.name_en, name_zh: artist.name_zh, slug: artistSlug }).select().single();
                     artistId = createdArtist.id;
                }
                await supabase.from('song_artists').insert({ song_id: id, artist_id: artistId });
            }

            navigate(`/song/${formData.slug}`);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const handleReject = async () => {
    if (!window.confirm("Delete this submission?")) return;
    setLoading(true);
    await supabase.from('song_submissions').delete().eq('id', id);
    navigate('/admin');
    setLoading(false);
  };

  if (fetching) return <div className="text-white p-10">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-[1600px] mx-auto">
        
        <div className="flex justify-between items-start mb-6">
            <button onClick={() => navigate(isReviewMode ? '/admin' : `/song/${formData.slug}`)} className="flex items-center text-slate-400 hover:text-white">
                <ArrowLeft className="w-5 h-5 mr-2" /> 
                {isReviewMode ? "Back to Dashboard" : "Cancel Edit"}
            </button>
            {isReviewMode && <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-1 rounded text-xs font-bold animate-pulse">Reviewing Submission</span>}
        </div>

        <h1 className="text-3xl font-bold text-white mb-8">{isReviewMode ? "Approve Submission" : "Edit Song"}</h1>

        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Title (English) <span className="text-primary">*</span></label>
                <input name="title_en" value={formData.title_en} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Title (Chinese)</label>
                <input name="title_zh" value={formData.title_zh || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>

            {/* UPGRADED ARTIST SEARCH */}
            <div className="lg:col-span-2">
                <ArtistSearch selectedArtists={selectedArtists} onSelect={handleSelectArtist} />
            </div>

            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Tags</label>
                <TagInput tags={tags} setTags={setTags} placeholder="Type tag & Enter..." />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Cover URL</label>
                <input name="cover_url" value={formData.cover_url || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>
            <div className="space-y-2 lg:col-span-2"> 
                <label className="text-slate-400 text-sm">YouTube URL</label>
                <input name="youtube_url" value={formData.youtube_url || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>
            {!isReviewMode && (
                <div className="space-y-2 lg:col-span-2"> 
                    <label className="text-slate-400 text-sm">Slug</label>
                    <input name="slug" value={formData.slug || ''} disabled className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-slate-500 w-full" />
                </div>
            )}
          </div>

          <div className="w-full">
             <LyricsEditor label="Credits" name="credits" value={formData.credits || ''} onChange={handleChange} placeholder="Credits..." minHeight="100px" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor label="Chinese Characters" name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} />
             <div className="relative">
                 <button type="button" onClick={handleAutoPinyin} className="absolute right-0 top-0 z-10 text-xs flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded hover:bg-primary hover:text-white transition-colors">
                   <Sparkles className="w-3 h-3" /> Auto-Fill
                 </button>
                 <LyricsEditor label="Pinyin" name="lyrics_pinyin" value={formData.lyrics_pinyin} onChange={handleChange} />
             </div>
             <LyricsEditor label="English Translation" name="lyrics_english" value={formData.lyrics_english} onChange={handleChange} />
          </div>

          <div className="fixed bottom-6 right-6 z-50 flex gap-4">
             {isReviewMode && (
                 <button type="button" onClick={handleReject} disabled={loading} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold py-4 px-6 rounded-full border border-red-500/50 flex items-center gap-2 backdrop-blur-md transition-all">
                    <XCircle className="w-5 h-5" /> Reject
                 </button>
             )}
             <button type="submit" disabled={loading} className={`text-white font-bold py-4 px-8 rounded-full shadow-2xl flex items-center gap-2 transition-transform hover:scale-105 ${isReviewMode ? 'bg-primary hover:bg-primary/90' : 'bg-blue-600 hover:bg-blue-500'}`}>
                {isReviewMode ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />} 
                {loading ? "Processing..." : (isReviewMode ? "Approve & Publish" : "Save Changes")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSongPage;