import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput'; 
import { pinyin } from 'pinyin-pro';

// --- HELPER COMPONENT ---
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
      
      <div className="relative flex border border-slate-700 rounded-xl overflow-hidden bg-slate-900 focus-within:border-emerald-500 transition-colors">
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

const EditSongPage = () => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // --- STATE ARRAYS ---
  const [tags, setTags] = useState([]);
  const [artistList, setArtistList] = useState([]);         
  const [artistChineseList, setArtistChineseList] = useState([]); 

  const [formData, setFormData] = useState({
    title: '', 
    title_chinese: '', 
    cover_url: '', 
    youtube_url: '', 
    slug: '', 
    lyrics_chinese: '', 
    lyrics_pinyin: '', 
    lyrics_english: '',
    credits: '' 
  });

  // --- 1. FETCH DATA & CONVERT STRINGS TO ARRAYS ---
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from('songs').select('*').eq('id', id).single();
      
      if (error) {
        alert("Error loading song");
        navigate('/');
      } else {
        setFormData(data);
        
        // Restore Arrays
        if (data.tags) setTags(data.tags);
        
        // Split "Jay Chou, Jolin Tsai" back into ['Jay Chou', 'Jolin Tsai']
        if (data.artist) setArtistList(data.artist.split(', ')); 
        if (data.artist_chinese) setArtistChineseList(data.artist_chinese.split(', '));
        
        setFetching(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // --- AUTO-FILL LOGIC ---
  const handleAutoPinyin = () => {
    if (!formData.lyrics_chinese) return;
    const lines = formData.lyrics_chinese.split('\n');
    const pinyinLines = lines.map(line => pinyin(line, { toneType: 'symbol' }));
    setFormData(prev => ({ ...prev, lyrics_pinyin: pinyinLines.join('\n') }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Validate
    if (artistList.length === 0) {
        alert("Please add at least one artist (English).");
        setLoading(false);
        return;
    }

    // Join Arrays back into Strings for Database
    const finalArtistString = artistList.join(', ');
    const finalArtistChineseString = artistChineseList.join(', ');

    const { error } = await supabase
      .from('songs')
      .update({ 
        ...formData, 
        artist: finalArtistString,
        artist_chinese: finalArtistChineseString,
        tags: tags 
      })
      .eq('id', id);

    if (error) {
      alert('Error updating: ' + error.message);
    } else {
      navigate(`/song/${formData.slug}`);
    }
    
    setLoading(false);
  };

  if (fetching) return <div className="text-white p-10">Loading song data...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-[1600px] mx-auto">
        
        <button 
          onClick={() => navigate(`/song/${formData.slug}`)} 
          className="flex items-center text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> Cancel Edit
        </button>

        <h1 className="text-3xl font-bold text-white mb-8">Edit Song</h1>

        <form onSubmit={handleUpdate} className="space-y-8">
          
          {/* --- THE GRID LAYOUT (Exact match to AddPage) --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            
            {/* ROW 1: TITLES */}
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title (English/Pinyin) <span className="text-emerald-500">*</span></label>
                <input name="title" value={formData.title} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title (Chinese) <span className="text-transparent select-none">*</span></label>
                <input name="title_chinese" value={formData.title_chinese || ''} onChange={handleChange} placeholder="e.g. 让风告诉你" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>

            {/* ROW 2: ARTISTS */}
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (English) <span className="text-emerald-500">*</span></label>
                <TagInput tags={artistList} setTags={setArtistList} placeholder="Type artist & hit Enter..." />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (Chinese) <span className="text-transparent select-none">*</span></label>
                <TagInput tags={artistChineseList} setTags={setArtistChineseList} placeholder="Type Chinese name & hit Enter..." />
            </div>

            {/* ROW 3: TAGS & COVER */}
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Tags</label>
                <TagInput tags={tags} setTags={setTags} placeholder="Type tag & hit Enter..." />
            </div>
            
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Cover Image URL</label>
                <div>
                    <input name="cover_url" value={formData.cover_url || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
                    <p className="text-[10px] text-slate-500 mt-1 pl-1">
                        Portrait images work best.
                    </p>
                </div>
            </div>

            {/* ROW 4: YOUTUBE & SLUG */}
            <div className="space-y-2"> 
                <label className="text-slate-400 text-sm">YouTube Video URL</label>
                <input name="youtube_url" value={formData.youtube_url || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>

            <div className="space-y-2"> 
                <label className="text-slate-400 text-sm">URL Slug (Read-only)</label>
                <input name="slug" value={formData.slug || ''} disabled className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-slate-500 w-full cursor-not-allowed" />
            </div>
          </div>

          {/* CREDITS */}
          <div className="w-full">
             <LyricsEditor 
                label="Credits / About (Song Bio)" 
                name="credits" 
                value={formData.credits || ''} 
                onChange={handleChange} 
                placeholder="Write whatever you want here..."
                minHeight="100px" 
             />
          </div>

          {/* LYRICS EDITORS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor label={<>Chinese Characters <span className="text-emerald-500">*</span></>} name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} placeholder="Paste Chinese text..." />
             
             <div className="relative">
                 <button
                   type="button"
                   onClick={handleAutoPinyin}
                   className="absolute right-0 top-0 z-10 text-xs flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded hover:bg-emerald-500 hover:text-white transition-colors"
                 >
                   <Sparkles className="w-3 h-3" /> Auto-Fill
                 </button>
                 <LyricsEditor label="Pinyin" name="lyrics_pinyin" value={formData.lyrics_pinyin} onChange={handleChange} placeholder="Paste Pinyin..." />
                 <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                    <span className="text-yellow-500/80">⚠</span> 
                    Always double-check auto-fill for accuracy.
                 </p>
             </div>

             <LyricsEditor label="English Translation" name="lyrics_english" value={formData.lyrics_english} onChange={handleChange} placeholder="Paste English..." />
          </div>

          <div className="fixed bottom-6 right-6 z-50">
             <button disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-8 rounded-full shadow-2xl flex items-center gap-2 transition-transform hover:scale-105">
              <Save className="w-5 h-5" /> {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSongPage;