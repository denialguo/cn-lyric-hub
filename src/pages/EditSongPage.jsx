// ... (imports remain the same)
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput'; 
import { pinyin } from 'pinyin-pro';

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

const EditSongPage = ({ isReviewMode = false }) => {
  const { id } = useParams(); // THIS IS THE SUBMISSION ID
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [tags, setTags] = useState([]);
  const [artistList, setArtistList] = useState([]);         
  const [artistChineseList, setArtistChineseList] = useState([]); 

  const [formData, setFormData] = useState({
    title_en: '', title_zh: '', cover_url: '', youtube_url: '', slug: '',
    lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '', credits: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      const tableName = isReviewMode ? 'song_submissions' : 'songs';
      const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      
      if (error) {
        alert("Error loading data");
        navigate('/admin');
      } else {
        setFormData(data);
        if (data.tags) setTags(data.tags);
        if (data.artist_en) setArtistEnList(Array.isArray(data.artist_en) ? data.artist_en : data.artist_en.split(', '));
        if (data.artist_zh) setArtistZhList(Array.isArray(data.artist_zh) ? data.artist_zh : data.artist_zh.split(', '));
        setFetching(false);
      }
    };
    fetchData();
  }, [id, navigate, isReviewMode]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAutoPinyin = () => {
    if (!formData.lyrics_chinese) return;
    const lines = formData.lyrics_chinese.split('\n');
    const pinyinLines = lines.map(line => pinyin(line, { toneType: 'symbol' }));
    setFormData(prev => ({ ...prev, lyrics_pinyin: pinyinLines.join('\n') }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const finalArtistString = artistEnList.join(', ');
    const finalArtistChineseString = artistZhList.join(', ');

    let finalSlug = formData.slug;
    if (!finalSlug) {
        const pinyinTitle = pinyin(formData.title_en, { toneType: 'none', type: 'array' }).join(' ');
        finalSlug = pinyinTitle.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
    }

    const basePayload = {
        ...formData,
        artist_en: finalArtistString,
        artist_zh: finalArtistChineseString,
        tags: tags,
        slug: finalSlug
    };

    try {
        if (isReviewMode) {
            // --- APPROVE LOGIC ---
            
            // 1. CLEANUP: Remove ID and Status so we don't pollute the songs table
            // We specifically do NOT include 'id' so Supabase makes a NEW one for the live song
            const { id: _ignoreId, created_at, status, submitter_ip, ...cleanPayload } = basePayload;

            // 2. INSERT into live 'songs'
            const { error: insertError } = await supabase.from('songs').insert([cleanPayload]);
            if (insertError) throw insertError;

            // 3. DELETE from 'song_submissions' using the URL param ID
            // We use the 'id' from useParams() to be 100% sure we delete the submission we are looking at
            const { error: deleteError } = await supabase.from('song_submissions').delete().eq('id', id);
            
            if (deleteError) {
                // If delete fails, warn the admin but don't crash (song is already live)
                alert("Song published, but failed to delete submission from queue. Please delete manually.");
            } else {
                alert("Approved & Published!");
            }
            
            navigate('/admin');
            
        } else {
            // --- NORMAL EDIT LOGIC ---
            const { error } = await supabase.from('songs').update(basePayload).eq('id', id);
            if (error) throw error;
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
    const { error } = await supabase.from('song_submissions').delete().eq('id', id);
    if (error) alert("Error: " + error.message);
    else navigate('/admin');
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
            {/* INPUTS (Identical to before) */}
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Title (English) <span className="text-primary">*</span></label>
                <input name="title_en" value={formData.title_en} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Title (Chinese)</label>
                <input name="title_zh" value={formData.title_zh || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (English) <span className="text-primary">*</span></label>
                <TagInput tags={artistEnList} setTags={setArtistEnList} placeholder="Type & Enter..." />
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-sm">Artist (Chinese)</label>
                <TagInput tags={artistZhList} setTags={setArtistZhList} placeholder="Type & Enter..." />
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