import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, Trash2, Info, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput';
import { pinyin } from 'pinyin-pro';
import { useAuth } from '../context/AuthContext';

// --- RESTORED: Your Custom Lyrics Editor with Line Numbers ---
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
      <label className="text-slate-400 text-sm font-bold flex justify-between items-center">
        {label}
      </label>
      
      <div className="relative flex border border-slate-700 rounded-xl overflow-hidden bg-slate-900 focus-within:border-primary transition-colors">
        <div className="bg-slate-800 text-slate-500 text-right pr-3 pt-4 font-mono text-sm leading-6 select-none w-10 flex-shrink-0 border-r border-slate-700">
          <pre>{lineNumbers}</pre>
        </div>
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={onChange}
          rows={1}
          className="w-full bg-slate-900 text-white p-4 font-mono text-sm leading-6 outline-none resize-none whitespace-pre overflow-x-auto overflow-y-hidden"
          placeholder={placeholder}
          style={{ minHeight: minHeight }}
        />
      </div>
    </div>
  );
};
// -----------------------------------------------------------

// --- NEW: ARTIST INPUT WITH AUTOCOMPLETE ---
const ArtistInput = ({ label, value, onChange, placeholder, suggestions, onSelect }) => {
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

  const filtered = suggestions.filter(s => 
    s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
  ).slice(0, 5);

  return (
    <div className="space-y-2 relative" ref={wrapperRef}>
      <label className="text-slate-400 text-sm">{label}</label>
      <input
        value={value}
        onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
        }}
        onKeyDown={(e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onSelect(value);
            }
        }}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
        className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none transition-colors"
      />
      
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-slate-800 border border-slate-700 rounded-lg mt-1 shadow-xl overflow-hidden">
          {filtered.map((item, i) => (
            <div 
              key={i}
              onClick={() => {
                onSelect(item);
                setShowDropdown(false);
              }}
              className="p-3 hover:bg-slate-700 cursor-pointer text-sm text-slate-200 flex items-center justify-between group"
            >
              {item}
              <span className="text-xs text-slate-500 group-hover:text-primary">Add</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
// -------------------------------------------

const AddSongPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); 
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // --- STATE ---
  const [tags, setTags] = useState([]);
  const [artistEnList, setArtistEnList] = useState([]);
  const [artistZhList, setArtistZhList] = useState([]);
  const [enInput, setEnInput] = useState('');
  const [zhInput, setZhInput] = useState('');
  const [knownArtists, setKnownArtists] = useState([]);

  const [formData, setFormData] = useState({
    title_zh: '', 
    title_en: '', 
    cover_url: '',
    youtube_url: '',
    lyrics_chinese: '',
    lyrics_pinyin: '',
    lyrics_english: '',
    credits: ''
  });

  // --- LOAD DRAFT ---
  useEffect(() => {
    const savedData = localStorage.getItem('song_draft_form');
    const savedTags = localStorage.getItem('song_draft_tags');
    const savedArtists = localStorage.getItem('song_draft_artists');
    const savedArtistsCn = localStorage.getItem('song_draft_artists_cn');

    if (savedData) {
        setFormData(JSON.parse(savedData));
        setDraftLoaded(true);
        setTimeout(() => setDraftLoaded(false), 3000);
    }
    if (savedTags) setTags(JSON.parse(savedTags));
    if (savedArtists) setArtistEnList(JSON.parse(savedArtists));
    if (savedArtistsCn) setArtistZhList(JSON.parse(savedArtistsCn));
  }, []);

  // --- SAVE DRAFT ---
  useEffect(() => {
    const isNotEmpty = Object.values(formData).some(x => x !== '') || tags.length > 0 || artistEnList.length > 0;
    if (isNotEmpty) {
        localStorage.setItem('song_draft_form', JSON.stringify(formData));
        localStorage.setItem('song_draft_tags', JSON.stringify(tags));
        localStorage.setItem('song_draft_artists', JSON.stringify(artistEnList));
        localStorage.setItem('song_draft_artists_cn', JSON.stringify(artistZhList));
    }
  }, [formData, tags, artistEnList, artistZhList]);

  const clearDraft = () => {
    if (window.confirm("Are you sure? This will delete your current draft.")) {
        localStorage.removeItem('song_draft_form');
        localStorage.removeItem('song_draft_tags');
        localStorage.removeItem('song_draft_artists');
        localStorage.removeItem('song_draft_artists_cn');
        window.location.reload(); 
    }
  };

  // --- FETCH ARTISTS ---
  useEffect(() => {
    const fetchArtists = async () => {
      const { data } = await supabase.from('songs').select('artist_en, artist_zh');
      if (data) {
        const pairs = [];
        data.forEach(row => {
          const ens = (row.artist_en || "").split(',').map(s => s.trim());
          const zhs = (row.artist_zh || "").split(',').map(s => s.trim());
          ens.forEach((en, i) => {
            if (en && !pairs.find(p => p.en === en)) {
               pairs.push({ en: en, zh: zhs[i] || "" });
            }
          });
        });
        setKnownArtists(pairs);
      }
    };
    fetchArtists();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // --- SMART ARTIST HANDLERS ---
  const addEnglishArtist = (name) => {
    if (!name.trim()) return;
    const cleanName = name.trim();
    if (!artistEnList.includes(cleanName)) setArtistEnList([...artistEnList, cleanName]);
    setEnInput(''); 

    const match = knownArtists.find(k => k.en.toLowerCase() === cleanName.toLowerCase());
    if (match && match.zh && !artistZhList.includes(match.zh)) {
        setArtistZhList(prev => [...prev, match.zh]);
    }
  };

  const addChineseArtist = (name) => {
    if (!name.trim()) return;
    const cleanName = name.trim();
    if (!artistZhList.includes(cleanName)) setArtistZhList([...artistZhList, cleanName]);
    setZhInput(''); 

    const match = knownArtists.find(k => k.zh === cleanName);
    if (match && match.en && !artistEnList.includes(match.en)) {
        setArtistEnList(prev => [...prev, match.en]);
    }
  };

  const removeArtist = (list, setList, item) => {
    setList(list.filter(i => i !== item));
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

    if (artistEnList.length === 0 && artistZhList.length === 0) {
        alert("Please add at least one artist.");
        return;
    }

    if (!formData.title_zh.trim() && !formData.title_en.trim()) {
        alert("Please add a song title.");
        return;
    }

    setLoading(true);

    let rawSlugSource = formData.title_en || "";
    if (!rawSlugSource) {
        rawSlugSource = pinyin(formData.title_zh, { toneType: 'none', nonZh: 'consecutive', separator: '-' });
    }
    const generatedSlug = rawSlugSource.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '').replace(/^-|-$/g, '');

    const songData = {
        ...formData,
        artist_en: artistEnList.join(', '),
        artist_zh: artistZhList.join(', '),
        tags: tags,
        slug: generatedSlug + '-' + Math.floor(Math.random() * 1000) 
    };

    let error;
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        const submitterName = profile?.username || user.email.split('@')[0];
        const result = await supabase.from('songs').insert([{ ...songData, submitted_by: submitterName, user_id: user.id }]);
        error = result.error;
    } else {
        const result = await supabase.from('song_submissions').insert([{ ...songData, submitted_by: 'Community', status: 'pending' }]);
        error = result.error;
    }

    if (error) {
      alert('Error: ' + error.message);
      setLoading(false);
    } else {
      localStorage.removeItem('song_draft_form');
      localStorage.removeItem('song_draft_tags');
      localStorage.removeItem('song_draft_artists');
      localStorage.removeItem('song_draft_artists_cn');
      if (user) {
          alert("Song published!");
          navigate('/');
      } else {
          alert("Thank you! Your song has been submitted for review.");
          navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header Row */}
        <div className="flex justify-between items-start mb-6">
            <button onClick={() => navigate('/')} className="flex items-center text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
            </button>
            <button onClick={clearDraft} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                <Trash2 className="w-3 h-3" /> Clear Draft
            </button>
        </div>

        <div className="flex flex-col gap-2 mb-8">
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-white">Add New Song</h1>
                {draftLoaded && <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded animate-fade-in">Draft Restored</span>}
            </div>

            {!user ? (
                <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-4 py-2 rounded-lg w-fit">
                    <Info className="w-4 h-4" />
                    <span className="text-xs font-bold">You are posting as a Guest. Your song will be reviewed before going live.</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-lg w-fit">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-bold">You are verified. Your song will go live immediately.</span>
                </div>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title (Chinese) <span className="text-primary">*</span></label>
                <input name="title_zh" value={formData.title_zh} onChange={handleChange} placeholder="e.g. 有点甜" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" required />
            </div>

            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title (English)</label>
                <input name="title_en" value={formData.title_en} onChange={handleChange} placeholder="e.g. A Little Sweet" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>

            <div className="space-y-2">
                <ArtistInput 
                    label="Artist (English) *" 
                    value={enInput}
                    onChange={setEnInput}
                    placeholder="Type & Enter (e.g. Jay Chou)"
                    suggestions={knownArtists.map(k => k.en).filter(Boolean)}
                    onSelect={addEnglishArtist}
                />
                <div className="flex flex-wrap gap-2 min-h-[28px]">
                    {artistEnList.map(artist => (
                        <span key={artist} className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                            {artist}
                            <button type="button" onClick={() => removeArtist(artistEnList, setArtistEnList, artist)}><X size={12} /></button>
                        </span>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <ArtistInput 
                    label="Artist (Chinese)" 
                    value={zhInput}
                    onChange={setZhInput}
                    placeholder="Type & Enter (e.g. 周杰伦)"
                    suggestions={knownArtists.map(k => k.zh).filter(Boolean)}
                    onSelect={addChineseArtist}
                />
                <div className="flex flex-wrap gap-2 min-h-[28px]">
                    {artistZhList.map(artist => (
                        <span key={artist} className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                            {artist}
                            <button type="button" onClick={() => removeArtist(artistZhList, setArtistZhList, artist)}><X size={12} /></button>
                        </span>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Tags</label>
                <TagInput tags={tags} setTags={setTags} placeholder="Type tag & hit Enter..." />
            </div>
            
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Cover Image URL</label>
                <input name="cover_url" value={formData.cover_url} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>

            <div className="space-y-2 lg:col-span-2"> 
                <label className="text-slate-400 text-sm">YouTube Video URL</label>
                <input name="youtube_url" value={formData.youtube_url} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>
          </div>

          <div className="w-full">
             <LyricsEditor label="Credits / About (Song Bio)" name="credits" value={formData.credits} onChange={handleChange} placeholder="Write whatever you want here..." minHeight="100px" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor label={<>Chinese Characters <span className="text-primary">*</span></>} name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} placeholder="Lyrics here..." />
             
             <div className="relative">
                 <button type="button" onClick={handleAutoPinyin} className="absolute right-0 top-0 text-xs flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded hover:bg-primary hover:text-white transition-colors z-10">
                   <Sparkles className="w-3 h-3" /> Auto-Fill
                 </button>
                 <LyricsEditor label="Pinyin" name="lyrics_pinyin" value={formData.lyrics_pinyin} onChange={handleChange} placeholder="Click Auto-Fill or type..." />
                 <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                    <span className="text-yellow-500/80">⚠</span> 
                    Always double-check auto-fill for accuracy.
                 </p>
             </div>

             <LyricsEditor label="English Translation" name="lyrics_english" value={formData.lyrics_english} onChange={handleChange} placeholder="Translation here..." />
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