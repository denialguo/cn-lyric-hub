import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// --- HELPER COMPONENT: Auto-Growing Textarea with Line Numbers ---
const LyricsEditor = ({ label, name, value, onChange, placeholder }) => {
  const textareaRef = useRef(null);

  // Auto-resize logic
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to shrink if text was deleted
      textareaRef.current.style.height = 'auto';
      // Set height to scrollHeight to fit content
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Generate line numbers
  const lineCount = value ? value.split('\n').length : 1;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 5) }, (_, i) => i + 1).join('\n');

  return (
    <div className="flex flex-col gap-2">
      <label className="text-slate-400 text-sm font-bold flex justify-between">
        {label} <span className="text-xs font-normal text-slate-600">({lineCount} lines)</span>
      </label>
      
      <div className="relative flex border border-slate-700 rounded-xl overflow-hidden bg-slate-900 focus-within:border-emerald-500 transition-colors">
        {/* Line Numbers Column */}
        <div 
          className="bg-slate-800 text-slate-500 text-right pr-3 pt-4 font-mono text-sm leading-6 select-none w-10 flex-shrink-0 border-r border-slate-700"
        >
          <pre>{lineNumbers}</pre>
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={onChange}
          rows={1}
          // Same styling as the Edit Page
          className="w-full bg-slate-900 text-white p-4 font-mono text-sm leading-6 outline-none resize-none whitespace-pre overflow-x-auto overflow-y-hidden"
          placeholder={placeholder}
          style={{ minHeight: '150px' }}
        />
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
const AddSongPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '', 
    artist: '', 
    artist_chinese: '', 
    cover_url: '',
    youtube_url: '', 
    category: 'pop', // Default genre
    lyrics_chinese: '', 
    lyrics_pinyin: '', 
    lyrics_english: ''
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; 
    setLoading(true);
    
    // Insert into Supabase
    const { error } = await supabase.from('songs').insert([formData]);

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
          {/* Metadata Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
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
                <label className="text-slate-400 text-sm">Genre</label>
                <select name="category" onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full">
                  <option value="pop">Pop</option>
                  <option value="rnb">R&B</option>
                  <option value="ballad">Ballad</option>
                  <option value="rap">Rap</option>
                  <option value="rock">Rock</option>
                  <option value="indie">Indie</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (Chinese) - Optional</label>
                <input name="artist_chinese" onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Cover Image URL - Optional</label>
                <input name="cover_url" onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">YouTube Video URL - Optional</label>
                <input name="youtube_url" placeholder="https://youtube.com/watch?v=..." onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
            </div>
          </div>

          {/* LYRICS EDITORS - Now with Line Numbers! */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor 
               label="Chinese Characters *" 
               name="lyrics_chinese" 
               value={formData.lyrics_chinese} 
               onChange={handleChange} 
               placeholder="Line 1&#10;Line 2&#10;Line 3..."
             />
             <LyricsEditor 
               label="Pinyin" 
               name="lyrics_pinyin" 
               value={formData.lyrics_pinyin} 
               onChange={handleChange} 
               placeholder="Line 1 pinyin&#10;Line 2 pinyin..."
             />
             <LyricsEditor 
               label="English Translation" 
               name="lyrics_english" 
               value={formData.lyrics_english} 
               onChange={handleChange} 
               placeholder="Line 1 meaning&#10;Line 2 meaning..."
             />
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