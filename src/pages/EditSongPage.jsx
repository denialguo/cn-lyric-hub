import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput'; 

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
      
      {/* Blue border focus */}
      <div className="relative flex border border-slate-700 rounded-xl overflow-hidden bg-slate-900 focus-within:border-blue-500 transition-colors">
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
  
  const [tags, setTags] = useState([]);

  // 1. Added translation_credit to state
  const [formData, setFormData] = useState({
    title: '', artist: '', artist_chinese: '', cover_url: '', youtube_url: '', 
    category: 'pop', slug: '', 
    lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '',
    credits: '' // <--- Added credits to state
  });

  // Fetch existing data
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from('songs').select('*').eq('id', id).single();
      if (error) {
        alert("Error loading song");
        navigate('/');
      } else {
        setFormData(data);
        if (data.tags) setTags(data.tags);
        setFetching(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Update the song (including tags and credits)
    const { error } = await supabase
      .from('songs')
      .update({ 
        ...formData, 
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
          {/* Metadata Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            
            {/* COLUMN 1 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title</label>
                <input name="title" value={formData.title} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist</label>
                <input name="artist" value={formData.artist} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-blue-500 outline-none" />
              </div>
              
              {/* Tags Input */}
              <div className="space-y-2">
                  <label className="text-slate-400 text-sm">Tags</label>
                  <TagInput tags={tags} setTags={setTags} placeholder="Add tags (Pop, Ballad, etc.)" />
              </div>

              {/* 2. Added Translation Credit Input Here */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Translation Credit (Optional)</label>
                <input 
                  name="translation_credit" 
                  placeholder="e.g. Translated by @YourName"
                  value={formData.translation_credit || ''} 
                  onChange={handleChange} 
                  className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full placeholder:text-slate-600 focus:border-blue-500 outline-none" 
                />
              </div>
            </div>
            
            {/* COLUMN 2 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (Chinese)</label>
                <input name="artist_chinese" value={formData.artist_chinese || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Cover Image URL</label>
                <input name="cover_url" value={formData.cover_url || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Youtube URL</label>
                <input name="youtube_url" value={formData.youtube_url || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-blue-500 outline-none" />
              </div>
              
            {/* --- LOCKED SLUG SECTION (EXACT SIZE MATCH) --- */}
          <div className="space-y-2"> 
            <div className="flex justify-between">
                <label className="text-slate-400 text-sm">URL Slug (Read-only)</label>
            </div>
            <input 
                name="slug" 
                value={formData.slug || ''} 
                disabled 
                className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-slate-400 w-full" 
            />
          </div>
                      </div>
          </div>

          {/* --- NEW CREDITS BLOCK --- */}
          <div className="w-full">
             <LyricsEditor 
                label="Credits / About (Song Bio)" 
                name="credits" 
                value={formData.credits || ''} 
                onChange={handleChange} 
                placeholder="Write whatever you want here...&#10;Translation: Admin&#10;Cleaned by: User123"
                minHeight="100px" 
             />
          </div>

          {/* LYRICS EDITORS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor label="Chinese Characters" name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} placeholder="Paste Chinese text..." />
             <LyricsEditor label="Pinyin" name="lyrics_pinyin" value={formData.lyrics_pinyin} onChange={handleChange} placeholder="Paste Pinyin..." />
             <LyricsEditor label="English Translation" name="lyrics_english" value={formData.lyrics_english} onChange={handleChange} placeholder="Paste English..." />
          </div>

          <div className="fixed bottom-6 right-6 z-50">
             {/* Updated button color to Blue */}
             <button disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-full shadow-2xl flex items-center gap-2 transition-transform hover:scale-105">
              <Save className="w-5 h-5" /> {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSongPage;