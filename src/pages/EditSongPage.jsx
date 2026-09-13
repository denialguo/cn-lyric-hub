import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput';
import LyricsEditor from '../components/LyricsEditor';
import ArtistSearch from '../components/ArtistSearch';
import { pinyin } from 'pinyin-pro';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { confirmLineEdit } from '../lib/lineEdits';
import { generatePinyin } from '../utils/lyrics';
import { useArtistSelection } from '../hooks/useArtistSelection';
import { finishSongSave } from '../lib/finishSongSave';
import { isAdmin, submitterName } from '../lib/identity';

const EditSongPage = ({ isReviewMode = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast, confirm } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [savedSongId, setSavedSongId] = useState(null);
  const [saveIncomplete, setSaveIncomplete] = useState(false);

  const [tags, setTags] = useState([]);
  const { selectedArtists, setSelectedArtists, handleSelectArtist, handleRemoveArtist } = useArtistSelection();
  const [originalData, setOriginalData] = useState(null);

  const [formData, setFormData] = useState({
    title_en: '', title_zh: '', cover_url: '', youtube_url: '', slug: '',
    lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '', bio: '', credits: '', year: '',
  });

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setFetching(true);
      setFetchError('');
      setOriginalData(null);
      setSavedSongId(null);
      setSaveIncomplete(false);
      const tableName = isReviewMode ? 'song_submissions' : 'songs';
      const { data: song, error } = await supabase.from(tableName).select('*').eq('id', id).single();

      if (cancelled) return;
      if (error || !song) {
        setFetchError('Couldn’t load this song or submission. Check your connection and account access.');
        setFetching(false);
        return;
      }

      setFormData(song);
      if (song.tags) setTags(song.tags);

      if (!isReviewMode) {
        const { data: linkedArtists, error: artistError } = await supabase
          .from('song_artists')
          .select('artist_id, artists(*)')
          .eq('song_id', id);
        if (artistError) setFetchError('Couldn’t load the song’s artists. Retry before editing.');
        if (linkedArtists) setSelectedArtists(linkedArtists.map((link) => link.artists).filter(Boolean));
      } else {
        const enList = (song.artist_en || '').split(',').map((s) => s.trim()).filter(Boolean);
        const zhList = (song.artist_zh || '').split(',').map((s) => s.trim()).filter(Boolean);

        const reconstructed = [];
        const maxLen = Math.max(enList.length, zhList.length);
        for (let i = 0; i < maxLen; i++) {
          reconstructed.push({ id: null, name_en: enList[i] || zhList[i], name_zh: zhList[i] || '', isNew: true });
        }

        const namesToLookup = reconstructed.map((a) => a.name_en);
        if (namesToLookup.length > 0) {
          const { data: found, error: lookupError } = await supabase.from('artists').select('*').in('name_en', namesToLookup);
          if (lookupError) setFetchError('Couldn’t load artists for comparison. Retry before reviewing.');
          setSelectedArtists(reconstructed.map((a) => found?.find((f) => f.name_en === a.name_en) || a));
        } else {
          setSelectedArtists(reconstructed);
        }

        if (song.original_song_id) {
          const { data: orig, error: originalError } = await supabase.from('songs').select('*').eq('id', song.original_song_id).single();
          if (originalError || !orig) setFetchError('Couldn’t load the original song. Retry to compare changes before approving.');
          if (orig) setOriginalData(orig);
        }
      }
      if (!cancelled) setFetching(false);
    };
    fetchData();
    return () => { cancelled = true; };
  }, [id, navigate, isReviewMode, reloadKey]);

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

  const handleSave = async (e) => {
    e.preventDefault();
    if (loading || fetchError) return;
    setLoading(true);

    if (selectedArtists.length === 0) {
      setLoading(false);
      return toast.warning('Please add at least one artist.');
    }

    const artistEnString = selectedArtists.map((a) => a.name_en).join(', ');
    const artistZhString = selectedArtists.map((a) => a.name_zh).join(', ');

    let finalSlug = formData.slug;
    if (!finalSlug) {
      const source = formData.title_en || formData.title_zh || 'untitled';
      finalSlug =
        pinyin(source, { toneType: 'none', nonZh: 'consecutive' })
          .toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-') +
        '-' + Math.floor(Math.random() * 1000);
    }

    const editorName = submitterName(user, profile);

    const safePayload = {
      title_en: formData.title_en, title_zh: formData.title_zh, cover_url: formData.cover_url,
      youtube_url: formData.youtube_url, lyrics_chinese: formData.lyrics_chinese,
      lyrics_pinyin: formData.lyrics_pinyin, lyrics_english: formData.lyrics_english,
      credits: formData.credits, bio: formData.bio, year: formData.year ? parseInt(formData.year) : null,
      artist_en: artistEnString, artist_zh: artistZhString, tags,
      last_edited_by: editorName,
    };

    let wroteSongId = savedSongId;

    // Helper: resolve an artist to a DB id, creating if needed
    const resolveArtistId = async (artist) => {
      if (artist.id && !artist.isNew) return artist.id;

      const { data: existing, error: lookupError } = await supabase
        .from('artists').select('id').eq('name_en', artist.name_en).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) return existing.id;

      const artistSlug =
        artist.name_en.toLowerCase().replace(/[^a-z0-9]/g, '-') +
        '-' + Math.floor(Math.random() * 1000);
      const { data: created, error: createError } = await supabase
        .from('artists')
        .insert({ name_en: artist.name_en, name_zh: artist.name_zh, slug: artistSlug })
        .select()
        .single();
      if (createError) throw createError;
      return created.id;
    };

    try {
      const targetSongId = isReviewMode ? (formData.original_song_id || savedSongId) : id;
      if (!await confirmLineEdit(supabase, targetSongId, formData.lyrics_chinese, confirm)) return;
      if (isReviewMode) {
        const artistIds = await Promise.all(selectedArtists.map(resolveArtistId));
        // A reviewed/published song is curated content — lift it into the listed catalog.
        // Credit the person who wrote the edit, not the admin approving it: safePayload
        // took last_edited_by from the current session, which here is always the admin.
        // ponytail: the approver isn't recorded anywhere — with one admin account that
        // is zero information. Add a reviewed_by column if that ever stops being true.
        const payloadForLiveDB = {
          ...safePayload, slug: finalSlug, source: 'user',
          last_edited_by: formData.submitted_by || editorName,
        };

        if (formData.original_song_id || savedSongId) {
          const { error: updateError } = await supabase
            .from('songs').update(payloadForLiveDB).eq('id', formData.original_song_id || savedSongId).select('id').single();
          if (updateError) throw updateError;
          wroteSongId = formData.original_song_id || savedSongId;
        } else {
          const { data: newSong, error: insertError } = await supabase
            .from('songs').insert([payloadForLiveDB]).select().single();
          if (insertError) throw insertError;
          wroteSongId = newSong.id;
        }

        setSavedSongId(wroteSongId);
        setFormData(previous => ({ ...previous, slug: finalSlug }));
        await finishSongSave(supabase, wroteSongId, artistIds, id);
        setSaveIncomplete(false);
        toast.success('Approved & Published!');
        navigate('/admin');
      } else {
        if (isAdmin(user, profile)) {
          const artistIds = await Promise.all(selectedArtists.map(resolveArtistId));
          // Admin editing a song curates it — lift imports into the listed catalog
          const payloadForLiveDB = { ...safePayload, slug: finalSlug, source: 'user' };
          const { error } = await supabase.from('songs').update(payloadForLiveDB).eq('id', id).select('id').single();
          if (error) throw error;
          wroteSongId = id;
          await finishSongSave(supabase, id, artistIds);
          navigate(`/song/${formData.slug}`);
        } else {
          const submissionPayload = {
            ...safePayload,
            original_song_id: id,
            submitted_by: submitterName(user, profile),
            status: 'pending_edit',
          };
          const { error } = await supabase.from('song_submissions').insert([submissionPayload]);
          if (error) throw error;
          toast.success("Edit suggested! An admin will review your changes.");
          navigate(`/song/${formData.slug}`);
        }
      }
    } catch (error) {
      console.error('Song save failed:', error);
      setSaveIncomplete(Boolean(wroteSongId));
      toast.error(wroteSongId ? 'The song was saved, but some updates failed. Retry here to finish.' : 'Couldn’t save. Your changes are still here; try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const ok = await confirm('Reject this submission?', { destructive: true, confirmLabel: 'Reject' });
    if (!ok) return;
    setLoading(true);
    const { error } = await supabase.from('song_submissions').update({ status: 'rejected' }).eq('id', id).select('id').single();
    if (error) toast.error('Failed to reject: ' + error.message);
    else navigate('/admin');
    setLoading(false);
  };

  const renderTextInput = (label, name, required = false) => {
    const isChanged = originalData && originalData[name] !== formData[name];
    return (
      <div
        className={`space-y-2 p-3 rounded-lg transition-colors border ${
          isChanged ? 'bg-yellow-500/10 border-yellow-500/50' : 'border-transparent'
        }`}
      >
        <label htmlFor={name} className="text-slate-400 text-sm flex justify-between items-center">
          <span>{label} {required && <span className="text-primary">*</span>}</span>
          {isChanged && (
            <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle size={12} /> Edited
            </span>
          )}
        </label>
        <input
          id={name}
          name={name}
          required={required}
          value={formData[name] || ''}
          onChange={handleChange}
          className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full"
        />
        {isChanged && (
          <p className="text-xs text-yellow-500 font-mono mt-1 pt-1 border-t border-yellow-500/20">
            Original: {originalData[name] || '(empty)'}
          </p>
        )}
      </div>
    );
  };

  if (fetching) return <div className="text-white p-10">Loading review…</div>;
  if (fetchError) return <main className="max-w-xl mx-auto p-8 text-slate-300">
    <h1 className="text-xl text-white mb-4">Review unavailable</h1>
    <p role="alert">{fetchError}</p>
    <button onClick={() => setReloadKey(key => key + 1)} className="min-h-11 text-primary mr-6">Try again</button>
    <button onClick={() => navigate(isReviewMode ? '/admin' : '/')} className="min-h-11">Go back</button>
  </main>;

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 md:p-12 pb-28">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-start mb-6">
          <button
            onClick={() => navigate(isReviewMode ? '/admin' : `/song/${formData.slug}`)}
            className="flex items-center text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {isReviewMode ? 'Back to Dashboard' : 'Cancel Edit'}
          </button>
          {isReviewMode && (
            <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-1 rounded text-xs font-bold animate-pulse">
              Reviewing Submission
            </span>
          )}
        </div>

        <h1 className="text-3xl font-bold text-white mb-8">
          {isReviewMode ? 'Approve Submission' : 'Edit Song'}
        </h1>

        {saveIncomplete && <div role="alert" className="mb-6 p-4 border border-amber-500/40 rounded-xl text-amber-300 text-sm">
          The song is saved, but its artist links or review status need another attempt. Retry here to finish without creating another song.
        </div>}
        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
            {renderTextInput('Primary Title', 'title_zh', true)}
            {renderTextInput('Secondary Title', 'title_en')}

            <div className="lg:col-span-2 p-3 rounded-lg border border-transparent">
              {originalData && <p className="text-xs text-slate-400 mb-2">Original artists: {originalData.artist_en} {originalData.artist_zh}</p>}
              <ArtistSearch selectedArtists={selectedArtists} onSelect={handleSelectArtist} onRemove={handleRemoveArtist} />
            </div>

            <div className="space-y-2 p-3">
              <p className="text-slate-400 text-sm">Tags</p>
              {originalData && <p className="text-xs text-slate-400">Original tags: {(originalData.tags || []).join(', ') || '(none)'}</p>}
              <TagInput tags={tags} setTags={setTags} placeholder="Type tag & Enter..." />
            </div>

            {renderTextInput('Cover URL', 'cover_url')}

            {renderTextInput('YouTube URL', 'youtube_url')}
            
            {(() => {
              const isChanged = originalData && (originalData.year || '') !== (formData.year || '');
              return (
                <div className={`space-y-2 p-3 rounded-lg border transition-colors ${isChanged ? 'bg-yellow-500/10 border-yellow-500/50' : 'border-transparent'}`}>
                  <label htmlFor="year" className="text-slate-400 text-sm flex justify-between items-center">
                    Release Year
                    {isChanged && <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Edited</span>}
                  </label>
                  <input id="year" name="year" type="number" min="1900" max="2099" value={formData.year || ''} onChange={handleChange} placeholder="e.g. 2019" className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full focus:border-primary outline-none" />
                  {isChanged && <p className="text-xs text-slate-400">Original: {originalData.year || '(empty)'}</p>}
                </div>
              );
            })()}

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(() => {
              const bioChanged = originalData && (originalData.bio || '') !== (formData.bio || '');
              return (
                <div className={`space-y-2 p-3 rounded-lg border transition-colors ${bioChanged ? 'bg-yellow-500/10 border-yellow-500/50' : 'border-transparent'}`}>
                  <label htmlFor="bio" className="text-slate-400 text-sm font-bold flex justify-between items-center">
                    About This Song
                    {bioChanged && <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Edited</span>}
                  </label>
                  {bioChanged && <p className="text-xs text-slate-400 whitespace-pre-wrap">Original: {originalData.bio || '(empty)'}</p>}
                  <textarea
                    id="bio" name="bio" value={formData.bio || ''} onChange={handleChange}
                    placeholder="Background, meaning, cultural context..."
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm focus:border-primary outline-none transition-colors resize-none leading-relaxed"
                  />
                </div>
              );
            })()}
            {(() => {
              const creditsChanged = originalData && (originalData.credits || '') !== (formData.credits || '');
              return (
                <div className={`space-y-2 p-3 rounded-lg border transition-colors ${creditsChanged ? 'bg-yellow-500/10 border-yellow-500/50' : 'border-transparent'}`}>
                  <label htmlFor="credits" className="text-slate-400 text-sm font-bold flex justify-between items-center">
                    Credits
                    {creditsChanged && <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Edited</span>}
                  </label>
                  {creditsChanged && <p className="text-xs text-slate-400 whitespace-pre-wrap">Original: {originalData.credits || '(empty)'}</p>}
                  <textarea
                    id="credits" name="credits" value={formData.credits || ''} onChange={handleChange}
                    placeholder="Lyrics by, composed by, arranged by..."
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm focus:border-primary outline-none transition-colors resize-none leading-relaxed"
                  />
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <LyricsEditor
              label="Chinese Characters" name="lyrics_chinese" value={formData.lyrics_chinese}
              onChange={handleChange} originalValue={originalData?.lyrics_chinese}
            />
            <div className="relative">
              <button
                type="button" onClick={handleAutoPinyin}
                className="absolute right-0 top-0 z-10 text-xs flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded hover:bg-primary hover:text-white transition-colors mt-2 mr-2"
              >
                <Sparkles className="w-3 h-3" /> Auto-Fill
              </button>
              <LyricsEditor
                label="Pinyin" name="lyrics_pinyin" value={formData.lyrics_pinyin}
                onChange={handleChange} originalValue={originalData?.lyrics_pinyin}
              />
            </div>
            <LyricsEditor
              label="English Translation" name="lyrics_english" value={formData.lyrics_english}
              onChange={handleChange} originalValue={originalData?.lyrics_english}
            />
          </div>

          <div className="sticky bottom-0 z-50 flex flex-wrap justify-end gap-3 bg-slate-950 border-t border-slate-700 py-4">
            {isReviewMode && (
              <button
                type="button" onClick={handleReject} disabled={loading || saveIncomplete}
                className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold min-h-12 py-3 px-4 text-sm rounded-full border border-red-500/50 flex items-center gap-2 backdrop-blur-md transition-all"
              >
                <XCircle className="w-5 h-5" /> Reject
              </button>
            )}
            <button
              type="submit" disabled={loading}
              className={`text-white font-bold min-h-12 py-3 px-4 text-sm rounded-full shadow-2xl flex items-center gap-2 transition-transform hover:scale-105 ${
                isReviewMode ? 'bg-primary hover:bg-primary/90' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {isReviewMode ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {loading ? 'Processing…' : saveIncomplete ? 'Retry remaining updates' : isReviewMode ? 'Approve & Publish' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSongPage;