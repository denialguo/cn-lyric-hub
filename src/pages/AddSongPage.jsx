import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput';
import LyricsEditor from '../components/LyricsEditor';
import ArtistSearch from '../components/ArtistSearch';
import { pinyin } from 'pinyin-pro';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const AddSongPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, confirm } = useToast();
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [tags, setTags] = useState([]);
  const [selectedArtists, setSelectedArtists] = useState([]);

  const [formData, setFormData] = useState({
    title_zh: '', title_en: '', cover_url: '', youtube_url: '',
    lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '', credits: '',
  });

  // --- LOAD DRAFT ---
  useEffect(() => {
    const savedData = localStorage.getItem('song_draft_form');
    const savedTags = localStorage.getItem('song_draft_tags');
    const savedArtists = localStorage.getItem('song_draft_artists_obj');

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
    if (Object.values(formData).some((x) => x) || tags.length || selectedArtists.length) {
      localStorage.setItem('song_draft_form', JSON.stringify(formData));
      localStorage.setItem('song_draft_tags', JSON.stringify(tags));
      localStorage.setItem('song_draft_artists_obj', JSON.stringify(selectedArtists));
    }
  }, [formData, tags, selectedArtists]);

  const clearDraft = async () => {
    const ok = await confirm('Delete your current draft?', { destructive: true, confirmLabel: 'Delete' });
    if (!ok) return;
    localStorage.removeItem('song_draft_form');
    localStorage.removeItem('song_draft_tags');
    localStorage.removeItem('song_draft_artists_obj');
    setFormData({ title_zh: '', title_en: '', cover_url: '', youtube_url: '', lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '', credits: '' });
    setTags([]);
    setSelectedArtists([]);
    toast.success('Draft cleared');
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSelectArtist = (artist) => {
    if (!selectedArtists.some((a) => a.id === artist.id && !a.isNew)) {
      setSelectedArtists([...selectedArtists, artist]);
    }
  };

  const handleRemoveArtist = (index) => {
    setSelectedArtists((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAutoPinyin = () => {
    if (!formData.lyrics_chinese) return;
    const lines = formData.lyrics_chinese.split('\n');
    const pinyinLines = lines.map((line) => {
      const cleanLine = line
        .replace(/，/g, ',').replace(/。/g, '.').replace(/！/g, '!')
        .replace(/？/g, '?').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
      return pinyin(cleanLine, { toneType: 'symbol', nonZh: 'spaced' });
    });
    setFormData((prev) => ({ ...prev, lyrics_pinyin: pinyinLines.join('\n') }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (selectedArtists.length === 0) return toast.warning('Please add at least one artist.');
    if (!formData.title_zh.trim() && !formData.title_en.trim()) return toast.warning('Please add a song title.');

    setLoading(true);

    try {
      let rawSlugSource = formData.title_en || '';
      if (!rawSlugSource) {
        rawSlugSource = pinyin(formData.title_zh, { toneType: 'none', nonZh: 'consecutive', separator: '-' });
      }
      const generatedSlug =
        rawSlugSource.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') +
        '-' + Math.floor(Math.random() * 1000);

      const artistEnString = selectedArtists.map((a) => a.name_en).join(', ');
      const artistZhString = selectedArtists.map((a) => a.name_zh).join(', ');

      const songPayload = {
        ...formData,
        slug: generatedSlug,
        tags,
        artist_en: artistEnString,
        artist_zh: artistZhString,
        submitted_by: user ? (user.user_metadata?.username || user.email.split('@')[0]) : 'Community',
        user_id: user ? user.id : null,
        status: user ? 'active' : 'pending',
      };

      const { data: songData, error: songError } = await supabase
        .from(user ? 'songs' : 'song_submissions')
        .insert([songPayload])
        .select()
        .single();

      if (songError) throw songError;

      if (user && songData) {
        for (const artist of selectedArtists) {
          let artistId = artist.id;

          if (artist.isNew) {
            const artistSlug =
              artist.name_en.toLowerCase().replace(/[^a-z0-9]/g, '-') +
              '-' + Math.floor(Math.random() * 1000);
            const { data: newArtist, error: createError } = await supabase
              .from('artists')
              .insert({ name_en: artist.name_en, name_zh: artist.name_zh, slug: artistSlug })
              .select()
              .single();

            if (createError) throw createError;
            artistId = newArtist.id;
          }

          const { error: linkError } = await supabase
            .from('song_artists')
            .insert({ song_id: songData.id, artist_id: artistId, role: 'main' });

          if (linkError) throw linkError;
        }
      }

      localStorage.removeItem('song_draft_form');
      localStorage.removeItem('song_draft_tags');
      localStorage.removeItem('song_draft_artists_obj');

      toast.success(user ? 'Song published successfully!' : 'Submitted for review!');
      navigate('/');
    } catch (err) {
      toast.error('Error: ' + err.message);
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
          <button
            onClick={clearDraft}
            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3 h-3" /> Clear Draft
          </button>
        </div>

        <h1 className="text-3xl font-bold text-white mb-8">Add New Song</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <div className="space-y-2">
              <label className="text-slate-400 text-sm">Song Title (Chinese) <span className="text-primary">*</span></label>
              <input name="title_zh" value={formData.title_zh} onChange={handleChange} placeholder="e.g. 有点甜" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" required />
            </div>
            <div className="space-y-2">
              <label className="text-slate-400 text-sm">Song Title (English)</label>
              <input name="title_en" value={formData.title_en} onChange={handleChange} placeholder="e.g. A Little Sweet" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>

            <div className="lg:col-span-2">
              <ArtistSearch selectedArtists={selectedArtists} onSelect={handleSelectArtist} onRemove={handleRemoveArtist} />
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
            <LyricsEditor
              label={<>Chinese Characters <span className="text-primary">*</span></>}
              name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} placeholder="Lyrics here..."
            />

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
              <Save className="w-5 h-5" /> {loading ? 'Saving...' : user ? 'Publish Song' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSongPage;