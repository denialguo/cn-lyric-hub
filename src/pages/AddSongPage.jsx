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
import { generatePinyin } from '../utils/lyrics';
import { useArtistSelection } from '../hooks/useArtistSelection';
import { isAdmin, isRealAccount, submitterName } from '../lib/identity';
import { readJson, writeJson, removeKeys } from '../lib/storage';

// One definition, so "Clear Draft" can't miss a field the form has (it used to drop `bio`).
const EMPTY_FORM = {
  title_zh: '', title_en: '', cover_url: '', youtube_url: '',
  lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '', bio: '', credits: '', year: '',
};

const AddSongPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast, confirm } = useToast();
  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState([]);
  const { selectedArtists, setSelectedArtists, handleSelectArtist, handleRemoveArtist } = useArtistSelection();

  const [formData, setFormData] = useState(EMPTY_FORM);

  // --- LOAD DRAFT ---
  useEffect(() => {
    const draft = readJson('song_draft_form', null);
    if (draft) setFormData((prev) => ({ ...prev, ...draft }));
    setTags(readJson('song_draft_tags', []));
    setSelectedArtists(readJson('song_draft_artists_obj', []));
  }, []);

  // --- SAVE DRAFT ---
  useEffect(() => {
    if (Object.values(formData).some((x) => x) || tags.length || selectedArtists.length) {
      writeJson('song_draft_form', formData);
      writeJson('song_draft_tags', tags);
      writeJson('song_draft_artists_obj', selectedArtists);
    }
  }, [formData, tags, selectedArtists]);

  const clearDraft = async () => {
    const ok = await confirm('Delete your current draft?', { destructive: true, confirmLabel: 'Delete' });
    if (!ok) return;
    removeKeys('song_draft_form', 'song_draft_tags', 'song_draft_artists_obj');
    setFormData(EMPTY_FORM);
    setTags([]);
    setSelectedArtists([]);
    toast.success('Draft cleared');
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });


  const handleAutoPinyin = () => {
    const result = generatePinyin(formData.lyrics_chinese);
    if (result) setFormData((prev) => ({ ...prev, lyrics_pinyin: result }));
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

      const artistEnString = selectedArtists.map((a) => a.name_en || a.name_zh || '').filter(Boolean).join(', ');
      const artistZhString = selectedArtists.map((a) => a.name_zh || '').join(', ');

      // Only admins write straight to the live catalog; everyone else — signed in,
      // anonymous, or not signed in — goes through the review queue.
      const publishesDirectly = isAdmin(user, profile);

      const shared = {
        ...formData,
        year: formData.year ? parseInt(formData.year) : null,
        slug: generatedSlug,
        tags,
        artist_en: artistEnString || 'Unknown',
        artist_zh: artistZhString,
        submitted_by: submitterName(user, profile),
        user_id: isRealAccount(user) ? user.id : null,
      };

      // The two tables have diverged: `songs` has `source` and NO `status`;
      // `song_submissions` has `status` and NO `source`. Sending the wrong one
      // fails the whole insert with PGRST204, so build each payload explicitly.
      const songPayload = publishesDirectly
        ? { ...shared, source: 'user' }
        : { ...shared, status: 'pending' };

      const { data: songData, error: songError } = await supabase
        .from(publishesDirectly ? 'songs' : 'song_submissions')
        .insert([songPayload])
        .select()
        .single();

      if (songError) throw songError;

      if (publishesDirectly && songData) {
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

      removeKeys('song_draft_form', 'song_draft_tags', 'song_draft_artists_obj');

      toast.success(publishesDirectly ? 'Song published successfully!' : 'Submitted for review! An admin will publish it.');
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
              <label className="text-slate-400 text-sm">Primary Title <span className="text-primary">*</span></label>
              <input name="title_zh" value={formData.title_zh} onChange={handleChange} placeholder="e.g. 有点甜 or A Little Sweet" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-slate-400 text-sm">Secondary Title</label>
              <input name="title_en" value={formData.title_en} onChange={handleChange} placeholder="e.g. translation or alternate name" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
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

            <div className="space-y-2">
              <label className="text-slate-400 text-sm">YouTube Video URL</label>
              <input name="youtube_url" value={formData.youtube_url} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-slate-400 text-sm">Release Year</label>
              <input name="year" type="number" min="1900" max="2099" value={formData.year} onChange={handleChange} placeholder="e.g. 2019" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-slate-400 text-sm font-bold">About This Song</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Background, meaning, cultural context..."
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm focus:border-primary outline-none transition-colors resize-none leading-relaxed"
              />
            </div>
            <div className="space-y-2">
              <label className="text-slate-400 text-sm font-bold">Credits</label>
              <textarea
                name="credits"
                value={formData.credits}
                onChange={handleChange}
                placeholder="Lyrics by, composed by, arranged by..."
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm focus:border-primary outline-none transition-colors resize-none leading-relaxed"
              />
            </div>
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
              <Save className="w-5 h-5" /> {loading ? 'Saving...' : isAdmin(user, profile) ? 'Publish Song' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSongPage;