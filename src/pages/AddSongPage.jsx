import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput';
import { pinyin } from 'pinyin-pro';

// --- HELPER COMPONENT: Auto-Growing Textarea ---
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
        {/* Optional: Remove line numbers if you want it to look EXACTLY like a bio box. 
            I kept them for consistency, but you can delete this div to remove the sidebar numbers. */}
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
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState([]);

  const [formData, setFormData] = useState({
    title: '', 
    artist: '', 
    artist_chinese: '', 
    cover_url: '', 
    youtube_url: '', 
    lyrics_chinese: '', 
    lyrics_pinyin: '', 
    lyrics_english: '',
    credits: '' // <--- JUST ONE BIG BLOCK NOW
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; 
    setLoading(true);
    
    // 1. Convert title to Pinyin (handling Chinese characters)
    // 'toneType: none' removes the tone numbers/marks (ni3 -> ni)
    const pinyinTitle = pinyin(formData.title, { toneType: 'none', type: 'array' }).join(' ');

    // 2. Clean it up for the URL (standard slugify)
    const generatedSlug = pinyinTitle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove non-English chars
      .replace(/\s+/g, '-')         // Replace spaces with dashes
      .replace(/-+/g, '-')          // Remove double dashes
      .replace(/^-+|-+$/g, '');     // Trim dashes from ends

    // Insert with the Pinyin slug
    const { error } = await supabase
      .from('songs')
      .insert([{ 
        ...formData, 
        slug: generatedSlug, // Uses the clean pinyin version
        tags: tags 
      }]);

    if (error) {
      alert('Error adding song: ' + error.message);
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-[1600px] mx-auto">
        <button onClick={() => navigate('/')} className="flex items-center text-slate-400 hover:text-white mb-6">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
        </button>

        <h1 className="text-3xl font-bold text-white mb-8">Add New Song</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title *</label>
                <input name="title" onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" required />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (English) *</label>
                <input name="artist" onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" required />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Tags (Genre, Mood, Era)</label>
                <TagInput tags={tags} setTags={setTags} placeholder="Type tag & hit Enter..." />
              </div>
            </div>
            
            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (Chinese) - Optional</label>
                <input name="artist_chinese" onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Cover Image URL</label>
                <input name="cover_url" onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">YouTube Video URL</label>
                <input name="youtube_url" onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
            </div>
          </div>

          {/* --- THE BIG CREDITS BLOCK --- */}
          <div className="w-full">
             <LyricsEditor 
                label="Credits / About (Song Bio)" 
                name="credits" 
                value={formData.credits} 
                onChange={handleChange} 
                placeholder="Write whatever you want here...&#10;Translation: Admin&#10;Cleaned by: User123"
                minHeight="100px" 
             />
          </div>

          {/* LYRICS EDITORS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor label="Chinese Characters *" name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} placeholder="Lyrics here..." />
             <LyricsEditor label="Pinyin" name="lyrics_pinyin" value={formData.lyrics_pinyin} onChange={handleChange} placeholder="Pinyin here..." />
             <LyricsEditor label="English Translation" name="lyrics_english" value={formData.lyrics_english} onChange={handleChange} placeholder="Translation here..." />
          </div>

          <div className="fixed bottom-6 right-6 z-50">
             <button disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-8 rounded-full shadow-2xl flex items-center gap-2 transition-transform hover:scale-105">
              <Save className="w-5 h-5" /> {loading ? "Saving..." : "Publish Song"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSongPage;