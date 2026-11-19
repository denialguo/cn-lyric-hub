import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Braces, Save, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput';
import LyricsEditor from '../components/LyricsEditor';
import ArtistSearch from '../components/ArtistSearch';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { generatePinyin } from '../utils/lyrics';
import { useArtistSelection } from '../hooks/useArtistSelection';
import { isAdmin, isRealAccount, submitterName } from '../lib/identity';
import { readJson, writeJson, removeKeys } from '../lib/storage';
import { publishSong, isSlugTaken } from '../lib/queries';
import { newSongSlug } from '../lib/slugs';
import { EMPTY_FORM, parseSongJson, songToForm } from '../lib/songImport';
import { serializeSubmissionArtists } from '../lib/submissionArtists';
import { validateLyricSource } from '../lib/lyricMetadata';

const AddSongPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast, confirm } = useToast();
  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState([]);
  const { selectedArtists, setSelectedArtists, handleSelectArtist, handleRemoveArtist } = useArtistSelection();

  const [formData, setFormData] = useState(EMPTY_FORM);

  // --- IMPORT JSON --- fills this form only; submitting goes through handleSubmit as usual.
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const handleImport = async () => {
    const result = parseSongJson(importText);
    if (!result.ok) return setImportError(result.error);
    const { patch, artists } = songToForm(result.song);
    const hasData = Object.values(formData).some(Boolean) || tags.length || selectedArtists.length;
    if (hasData && !await confirm(
      'Importing will replace the title, artists and lyrics already in this form. Replace them?',
      { destructive: true, confirmLabel: 'Replace' }
    )) return;
    setFormData(prev => ({ ...prev, ...patch }));
    setSelectedArtists(artists);
    setImportText('');
    setImportError('');
    setShowImport(false);
    toast.success(`Imported ${result.song.lines.length} lines. Review everything, then submit.`);
  };

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


  const handleAutoPinyin = async () => {
    const text = formData.lyrics_chinese;
    try {
      const result = await generatePinyin(text);
      if (result) setFormData(prev => prev.lyrics_chinese === text ? { ...prev, lyrics_pinyin: result } : prev);
    } catch {
      toast.error('Could not generate pinyin. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (selectedArtists.length === 0) return toast.warning('Please add at least one artist.');
    if (!formData.title_zh.trim() && !formData.title_en.trim()) return toast.warning('Please add a song title.');
    const sourceReview = validateLyricSource(formData.lyrics_chinese, {
      title: formData.title_zh || formData.title_en,
      artist: selectedArtists[0]?.name_en || selectedArtists[0]?.name_zh,
    });
    if (sourceReview.issues.some(issue => issue.confidence === 'high')) {
      return toast.error('Lyric source contains credits or non-lyric metadata. Review lines: ' +
        sourceReview.issues.filter(issue => issue.confidence === 'high')
          .slice(0, 5).map(issue => issue.line_number).join(', '));
    }
    if (sourceReview.issues.length) {
      const approved = await confirm(
        'Possible title/credit header detected on lyric lines ' +
        sourceReview.issues.slice(0, 5).map(issue => issue.line_number).join(', ') +
        '. Are you certain these are performed lyrics?',
        { confirmLabel: 'Confirmed lyrics' },
      );
      if (!approved) return;
    }


    setLoading(true);

    try {
      const generatedSlug = await newSongSlug({
        artist: selectedArtists[0].name_en || selectedArtists[0].name_zh || '',
        titleEn: formData.title_en, titleZh: formData.title_zh, isTaken: isSlugTaken,
      });

      const artistEnString = selectedArtists.map((a) => a.name_en || a.name_zh || '').filter(Boolean).join(', ');
      const artistZhString = selectedArtists.map((a) => a.name_zh || '').filter(Boolean).join(', ');

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

      if (publishesDirectly) {
        await publishSong(shared, selectedArtists);
      } else {
        const { error } = await supabase.from('song_submissions').insert({
          ...shared,
          artist_data: serializeSubmissionArtists(selectedArtists),
          status: 'pending',
        });
        if (error) throw error;
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
          <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowImport(open => !open)}
            aria-expanded={showImport}
            aria-controls="json-import"
            className="text-slate-400 hover:text-primary text-xs flex items-center gap-1 transition-colors"
          >
            <Braces className="w-3 h-3" /> Import JSON
          </button>
          <button
            onClick={clearDraft}
            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3 h-3" /> Clear Draft
          </button>
          </div>
        </div>

        {showImport && (
          <div id="json-import" className="mb-8 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <label htmlFor="json-import-text" className="text-slate-400 text-sm font-bold block">Paste song JSON</label>
            <textarea
              id="json-import-text"
              value={importText}
              onChange={event => { setImportText(event.target.value); setImportError(''); }}
              placeholder={'{ "title": "…", "artist": "…", "lines": [{ "original": "…", "pinyin": "…", "translation": "…" }] }'}
              rows={8}
              spellCheck={false}
              aria-describedby={importError ? 'json-import-error' : undefined}
              aria-invalid={Boolean(importError)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm font-mono focus:border-primary outline-none resize-y"
            />
            {importError && <p id="json-import-error" role="alert" className="text-sm text-red-400">{importError}</p>}
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleImport} disabled={!importText.trim()} className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-white text-sm font-bold px-5 min-h-11 rounded-full transition-colors">Fill form</button>
              <button type="button" onClick={() => setShowImport(false)} className="text-slate-400 hover:text-white text-sm min-h-11 px-3">Cancel</button>
              <span className="text-xs text-slate-500">Nothing is submitted until you review and press Submit.</span>
            </div>
          </div>
        )}

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
