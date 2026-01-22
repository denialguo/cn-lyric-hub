import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, Trash2, Info } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput';
import { pinyin } from 'pinyin-pro';
import { useAuth } from '../context/AuthContext';

// Helper Component for Text Areas
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
      <label className="text-slate-400 text-sm font-bold flex justify-between">
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

const AddSongPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // We just check the user, we DO NOT kick them out
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  
  // --- STATE ---
  const [tags, setTags] = useState([]);
  const [artistList, setArtistList] = useState([]);         
  const [artistChineseList, setArtistChineseList] = useState([]); 

  const [formData, setFormData] = useState({
    title: '', 
    title_chinese: '', 
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
    if (savedArtists) setArtistList(JSON.parse(savedArtists));
    if (savedArtistsCn) setArtistChineseList(JSON.parse(savedArtistsCn));
  }, []);

  // --- SAVE DRAFT ---
  useEffect(() => {
    const isNotEmpty = Object.values(formData).some(x => x !== '') || tags.length > 0 || artistList.length > 0;
    
    if (isNotEmpty) {
        localStorage.setItem('song_draft_form', JSON.stringify(formData));
        localStorage.setItem('song_draft_tags', JSON.stringify(tags));
        localStorage.setItem('song_draft_artists', JSON.stringify(artistList));
        localStorage.setItem('song_draft_artists_cn', JSON.stringify(artistChineseList));
    }
  }, [formData, tags, artistList, artistChineseList]);

  const clearDraft = () => {
    if (window.confirm("Are you sure? This will delete your current draft.")) {
        localStorage.removeItem('song_draft_form');
        localStorage.removeItem('song_draft_tags');
        localStorage.removeItem('song_draft_artists');
        localStorage.removeItem('song_draft_artists_cn');
        window.location.reload(); 
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAutoPinyin = () => {
    if (!formData.lyrics_chinese) return;
    const lines = formData.lyrics_chinese.split('\n');
    const pinyinLines = lines.map(line => pinyin(line, { toneType: 'symbol' }));
    setFormData(prev => ({ ...prev, lyrics_pinyin: pinyinLines.join('\n') }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; 
    
    if (artistList.length === 0) {
        alert("Please add at least one artist (English).");
        return;
    }

    setLoading(true);
    
    const finalArtistString = artistList.join(', ');
    const finalArtistChineseString = artistChineseList.join(', ');

    const pinyinTitle = pinyin(formData.title, { toneType: 'none', type: 'array' }).join(' ');
    const generatedSlug = pinyinTitle
      .trim().toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

    const songData = {
        ...formData, 
        artist: finalArtistString,            
        artist_chinese: finalArtistChineseString, 
        tags: tags,
        // If User exists, add slug + name. If Guest, leave blank (or add later).
        ...(user ? { slug: generatedSlug, submitted_by: user.user_metadata?.username || user.email } : {}) 
    };

    let error;

    if (user) {
        // LOGGED IN: Go Straight to Live DB
        const result = await supabase.from('songs').insert([songData]);
        error = result.error;
    } else {
        // GUEST: Go to Queue
        const result = await supabase.from('song_submissions').insert([{
            ...songData,
            status: 'pending'
        }]);
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

            {/* STATUS BANNER */}
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
                <label className="text-slate-400 text-sm">Song Title (English/Pinyin) <span className="text-primary">*</span></label>
                <input name="title" value={formData.title} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" required />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title (Chinese) <span className="text-transparent select-none">*</span></label>
                <input name="title_chinese" value={formData.title_chinese} onChange={handleChange} placeholder="e.g. 让风告诉你" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>

            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (English) <span className="text-primary">*</span></label>
                <TagInput tags={artistList} setTags={setArtistList} placeholder="Type artist & hit Enter..." />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (Chinese) <span className="text-transparent select-none">*</span></label>
                <TagInput tags={artistChineseList} setTags={setArtistChineseList} placeholder="Type Chinese name & hit Enter..." />
            </div>

            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Tags</label>
                <TagInput tags={tags} setTags={setTags} placeholder="Type tag & hit Enter..." />
            </div>
            
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Cover Image URL</label>
                <div>
                    <input name="cover_url" value={formData.cover_url} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
                    <p className="text-[10px] text-slate-500 mt-1 pl-1">
                        Portrait images work best.
                    </p>
                </div>
            </div>

            <div className="space-y-2 lg:col-span-2"> 
                <label className="text-slate-400 text-sm">YouTube Video URL</label>
                <input name="youtube_url" value={formData.youtube_url} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>
          </div>

          <div className="w-full">
             <LyricsEditor 
                label="Credits / About (Song Bio)" 
                name="credits" 
                value={formData.credits} 
                onChange={handleChange} 
                placeholder="Write whatever you want here..."
                minHeight="100px" 
             />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor label={<>Chinese Characters <span className="text-primary">*</span></>} name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} placeholder="Lyrics here..." />
             
             <div className="relative">
                 <button
                   type="button"
                   onClick={handleAutoPinyin}
                   className="absolute right-0 top-0 z-10 text-xs flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded hover:bg-primary hover:text-white transition-colors"
                 >
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