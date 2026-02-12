import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, Trash2, Info, X, UserPlus, Search } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput';
import { pinyin } from 'pinyin-pro';
import { useAuth } from '../context/AuthContext';

// --- CUSTOM LYRICS EDITOR (Keep existing) ---
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
      <label className="text-slate-400 text-sm font-bold flex justify-between items-center">{label}</label>
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

// --- NEW: PROFESSIONAL ARTIST SEARCH ---
// This searches your 'artists' table instead of just string matching
const ArtistSearch = ({ selectedArtists, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search DB when user types
  useEffect(() => {
    const searchDB = async () => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        setSearching(true);
        // Search matches in either English OR Chinese name
        const { data } = await supabase
            .from('artists')
            .select('*')
            .or(`name_en.ilike.%${query}%,name_zh.ilike.%${query}%`)
            .limit(5);
        
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
    // Create a temporary object for a new artist (will be inserted on submit)
    const newArtist = {
        id: null, // No ID yet (marks it as new)
        name_en: query, // Assume input is English name primarily
        name_zh: '',    // Can edit later
        isNew: true
    };
    onSelect(newArtist);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className="relative space-y-2" ref={wrapperRef}>
        <label className="text-slate-400 text-sm font-bold">Artists <span className="text-primary">*</span></label>
        
        {/* Selected Artists Chips */}
        <div className="flex flex-wrap gap-2 mb-2">
            {selectedArtists.map((artist, i) => (
                <div key={artist.id || i} className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border ${artist.isNew ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-primary/10 border-primary/50 text-primary'}`}>
                    <span>{artist.name_en || artist.name_zh} {artist.name_zh && artist.name_en ? `(${artist.name_zh})` : ''}</span>
                    <button type="button" onClick={() => onSelect(artist, true)}><X size={12} /></button>
                </div>
            ))}
        </div>

        {/* Search Input */}
        <div className="relative">
            <input
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search for artist..."
                className="w-full bg-slate-900 border border-slate-700 p-3 pl-10 rounded-lg text-white focus:border-primary outline-none"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
        </div>

        {/* Dropdown Results */}
        {showDropdown && query && (
            <div className="absolute z-50 w-full bg-slate-800 border border-slate-700 rounded-lg mt-1 shadow-xl overflow-hidden">
                {searching ? (
                    <div className="p-4 text-xs text-slate-500 text-center">Searching...</div>
                ) : (
                    <>
                        {results.map(artist => (
                            <div 
                                key={artist.id} 
                                onClick={() => handleSelect(artist)}
                                className="p-3 hover:bg-slate-700 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0"
                            >
                                <div className="w-8 h-8 bg-slate-600 rounded-full overflow-hidden flex-shrink-0">
                                    {artist.avatar_url ? <img src={artist.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">?</div>}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{artist.name_en}</p>
                                    <p className="text-xs text-slate-400">{artist.name_zh}</p>
                                </div>
                            </div>
                        ))}
                        
                        {/* Option to Create New */}
                        <div 
                            onClick={createNewArtist}
                            className="p-3 hover:bg-emerald-500/20 cursor-pointer flex items-center gap-2 text-emerald-400 border-t border-white/10"
                        >
                            <UserPlus size={16} />
                            <span className="text-sm font-bold">Create new artist "{query}"</span>
                        </div>
                    </>
                )}
            </div>
        )}
    </div>
  );
};

const AddSongPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); 
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // --- STATE ---
  const [tags, setTags] = useState([]);
  const [selectedArtists, setSelectedArtists] = useState([]); // Array of Artist Objects
  
  const [formData, setFormData] = useState({
    title_zh: '', title_en: '', cover_url: '', youtube_url: '',
    lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '', credits: ''
  });

  // --- LOAD DRAFT ---
  useEffect(() => {
    const savedData = localStorage.getItem('song_draft_form');
    const savedTags = localStorage.getItem('song_draft_tags');
    const savedArtists = localStorage.getItem('song_draft_artists_obj'); // Changed key

    if (savedData) {
        setFormData(JSON.parse(savedData));
        setDraftLoaded(true);
        setTimeout(() => setDraftLoaded(false), 3000);
    }
    if (savedTags) setTags(JSON.parse(savedTags));
    if (savedArtists) setSelectedArtists(JSON.parse(savedArtists));
  }, []);

  // --- SAVE DRAFT ---
  useEffect(() => {
    if (Object.values(formData).some(x => x) || tags.length || selectedArtists.length) {
        localStorage.setItem('song_draft_form', JSON.stringify(formData));
        localStorage.setItem('song_draft_tags', JSON.stringify(tags));
        localStorage.setItem('song_draft_artists_obj', JSON.stringify(selectedArtists));
    }
  }, [formData, tags, selectedArtists]);

  const clearDraft = () => {
    if (window.confirm("Delete draft?")) {
        localStorage.removeItem('song_draft_form');
        localStorage.removeItem('song_draft_tags');
        localStorage.removeItem('song_draft_artists_obj');
        window.location.reload(); 
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSelectArtist = (artist, remove = false) => {
      if (remove) {
          setSelectedArtists(prev => prev.filter(a => (a.id !== artist.id) || (a.isNew && a.name_en !== artist.name_en)));
      } else {
          // Prevent duplicates
          if (!selectedArtists.some(a => a.id === artist.id && !a.isNew)) {
            setSelectedArtists([...selectedArtists, artist]);
          }
      }
  };

  const handleAutoPinyin = () => {
    if (!formData.lyrics_chinese) return;
    const lines = formData.lyrics_chinese.split('\n');
    const pinyinLines = lines.map(line => {
      const cleanLine = line.replace(/，/g, ',').replace(/。/g, '.').replace(/！/g, '!').replace(/？/g, '?').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
      return pinyin(cleanLine, { toneType: 'symbol', nonZh: 'spaced' });
    });
    setFormData(prev => ({ ...prev, lyrics_pinyin: pinyinLines.join('\n') }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (selectedArtists.length === 0) return alert("Please add at least one artist.");
    if (!formData.title_zh.trim() && !formData.title_en.trim()) return alert("Please add a song title.");

    setLoading(true);

    try {
        // 1. Generate Slug
        let rawSlugSource = formData.title_en || "";
        if (!rawSlugSource) {
            rawSlugSource = pinyin(formData.title_zh, { toneType: 'none', nonZh: 'consecutive', separator: '-' });
        }
        const generatedSlug = rawSlugSource.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + Math.floor(Math.random() * 1000);

        // 2. Prepare Song Data
        // Note: We still save legacy artist strings to 'songs' table for backward compatibility/search if you want, 
        // but the real data is in the junction table now.
        const artistEnString = selectedArtists.map(a => a.name_en).join(', ');
        const artistZhString = selectedArtists.map(a => a.name_zh).join(', ');

        const songPayload = {
            ...formData,
            slug: generatedSlug,
            tags: tags,
            artist_en: artistEnString, // Legacy fallback
            artist_zh: artistZhString, // Legacy fallback
            submitted_by: user ? (user.user_metadata?.username || user.email.split('@')[0]) : 'Community',
            user_id: user ? user.id : null,
            status: user ? 'active' : 'pending' // Guests = Pending
        };

        // 3. Insert Song
        const { data: songData, error: songError } = await supabase
            .from(user ? 'songs' : 'song_submissions')
            .insert([songPayload])
            .select()
            .single();

        if (songError) throw songError;

        // 4. Handle Artists (ONLY IF LOGGED IN / DIRECT PUBLISH)
        // If it's a guest submission, we can't link tables yet easily, so we rely on the strings.
        if (user && songData) {
            
            for (const artist of selectedArtists) {
                let artistId = artist.id;

                // A. Create New Artist if needed
                if (artist.isNew) {
                    // Generate slug for artist
                    const artistSlug = artist.name_en.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
                    const { data: newArtist, error: createError } = await supabase
                        .from('artists')
                        .insert({ name_en: artist.name_en, name_zh: artist.name_zh, slug: artistSlug })
                        .select()
                        .single();
                    
                    if (createError) throw createError;
                    artistId = newArtist.id;
                }

                // B. Link Song <-> Artist
                const { error: linkError } = await supabase
                    .from('song_artists')
                    .insert({ song_id: songData.id, artist_id: artistId, role: 'main' });

                if (linkError) throw linkError;
            }
        }

        // 5. Success
        localStorage.removeItem('song_draft_form');
        localStorage.removeItem('song_draft_tags');
        localStorage.removeItem('song_draft_artists_obj');
        
        alert(user ? "Song published successfully!" : "Submitted for review!");
        navigate('/');

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-[1600px] mx-auto">
        
        <div className="flex justify-between items-start mb-6">
            <button onClick={() => navigate('/')} className="flex items-center text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
            </button>
            <button onClick={clearDraft} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                <Trash2 className="w-3 h-3" /> Clear Draft
            </button>
        </div>

        <h1 className="text-3xl font-bold text-white mb-8">Add New Song</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            
            {/* Titles */}
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title (Chinese) <span className="text-primary">*</span></label>
                <input name="title_zh" value={formData.title_zh} onChange={handleChange} placeholder="e.g. 有点甜" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" required />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title (English)</label>
                <input name="title_en" value={formData.title_en} onChange={handleChange} placeholder="e.g. A Little Sweet" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>

            {/* NEW ARTIST SEARCH (Spans 2 columns on large screens) */}
            <div className="lg:col-span-2">
                <ArtistSearch selectedArtists={selectedArtists} onSelect={handleSelectArtist} />
            </div>

            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Tags</label>
                <TagInput tags={tags} setTags={setTags} placeholder="Type tag & hit Enter..." />
            </div>
            
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Cover Image URL</label>
                <input name="cover_url" value={formData.cover_url} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>
            
            <div className="lg:col-span-2 space-y-2"> 
                <label className="text-slate-400 text-sm">YouTube Video URL</label>
                <input name="youtube_url" value={formData.youtube_url} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>
          </div>

          <div className="w-full">
             <LyricsEditor label="Credits / About" name="credits" value={formData.credits} onChange={handleChange} placeholder="Song bio..." />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor label={<>Chinese Characters <span className="text-primary">*</span></>} name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} placeholder="Lyrics here..." />
             
             <div className="relative">
                 <button type="button" onClick={handleAutoPinyin} className="absolute right-0 top-0 text-xs flex items-center gap-1 text-primary hover:underline z-10">
                   <Sparkles className="w-3 h-3" /> Auto-Fill
                 </button>
                 <LyricsEditor label="Pinyin" name="lyrics_pinyin" value={formData.lyrics_pinyin} onChange={handleChange} placeholder="Pinyin..." />
             </div>

             <LyricsEditor label="English Translation" name="lyrics_english" value={formData.lyrics_english} onChange={handleChange} placeholder="Translation..." />
          </div>

          <div className="fixed bottom-6 right-6 z-50">
             <button disabled={loading} className="bg-primary hover:bg-primary/90 text-white font-bold py-4 px-8 rounded-full shadow-2xl flex items-center gap-2 transition-transform hover:scale-105">
              <Save className="w-5 h-5" /> {loading ? "Saving..." : (user ? "Publish Song" : "Submit for Review")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSongPage;