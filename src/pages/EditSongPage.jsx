import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput'; 

// --- HELPER COMPONENT: Auto-Growing Textarea ---
const LyricsEditor = ({ label, name, value, onChange, placeholder }) => {
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
        {label} <span className="text-xs font-normal text-slate-600">({lineCount} lines)</span>
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
          style={{ minHeight: '150px' }}
        />
      </div>
    </div>
  );
};

const EditSongPage = () => {
  const { id } = useParams(); // Keep using ID for database lookups (it's safer)
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [tags, setTags] = useState([]);

  const [formData, setFormData] = useState({
    title: '', artist: '', artist_chinese: '', cover_url: '', youtube_url: '', 
    category: 'pop', slug: '', // We store the slug here so we can use it for navigation
    lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: ''
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
    
    // Update the song (including tags)
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
      // FIXED: Navigate to the SLUG, not the ID
      navigate(`/song/${formData.slug}`);
    }
    
    setLoading(false);
  };

  if (fetching) return <div className="text-white p-10">Loading song data...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-[1600px] mx-auto">
        
        {/* FIXED: The "Cancel" button now uses formData.slug instead of id */}
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
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Song Title</label>
                <input name="title" value={formData.title} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist</label>
                <input name="artist" value={formData.artist} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
              
              {/* Tags Input */}
              <div className="space-y-2">
                 <label className="text-slate-400 text-sm">Tags</label>
                 <TagInput tags={tags} setTags={setTags} placeholder="Add tags (Pop, Ballad, etc.)" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Cover Image URL</label>
                <input name="cover_url" value={formData.cover_url || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Youtube URL</label>
                <input name="youtube_url" value={formData.youtube_url || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
              </div>
              
              {/* Slug Editor (Optional - Helpful if you want to change the URL manually) */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">URL Slug</label>
                <input name="slug" value={formData.slug || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-slate-300 w-full font-mono text-xs" />
              </div>
            </div>
          </div>

          {/* LYRICS EDITORS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor label="Chinese Characters" name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} placeholder="Paste Chinese text..." />
             <LyricsEditor label="Pinyin" name="lyrics_pinyin" value={formData.lyrics_pinyin} onChange={handleChange} placeholder="Paste Pinyin..." />
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