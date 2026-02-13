import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, CheckCircle, XCircle, Search, X, UserPlus, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TagInput from '../components/TagInput'; 
import { pinyin } from 'pinyin-pro';
import { useAuth } from '../context/AuthContext';

const LyricsEditor = ({ label, name, value, onChange, placeholder, minHeight = '150px', originalValue }) => {
  const textareaRef = useRef(null);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);
  
  const currentLines = (value || '').split('\n');
  const origLines = originalValue !== undefined && originalValue !== null ? String(originalValue).split('\n') : currentLines;
  const maxLines = Math.max(currentLines.length, origLines.length, 5);

  const changedLines = [];
  if (originalValue !== undefined && originalValue !== value) {
    for (let i = 0; i < Math.max(currentLines.length, origLines.length); i++) {
      if (currentLines[i] !== origLines[i]) {
        changedLines.push({
          index: i + 1,
          orig: origLines[i],
          curr: currentLines[i]
        });
      }
    }
  }

  const isChanged = changedLines.length > 0;

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-xl transition-colors ${isChanged ? 'bg-yellow-500/5 border border-yellow-500/30' : 'border border-transparent'}`}>
      <label className="text-slate-400 text-sm font-bold flex justify-between items-center">
        {label}
        {isChanged && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={12}/> Edited</span>}
      </label>
      <div className="relative flex border border-slate-700 rounded-xl overflow-hidden bg-slate-900 focus-within:border-primary transition-colors">
        <div className="bg-slate-800 text-slate-500 text-right pr-2 pt-4 font-mono text-sm leading-6 select-none w-12 flex-shrink-0 border-r border-slate-700">
          {Array.from({ length: maxLines }).map((_, i) => {
            const isDiff = changedLines.some(cl => cl.index === i + 1);
            return (
              <div key={i} className={isDiff ? "text-yellow-400 font-bold bg-yellow-500/20" : ""}>
                {i + 1}
              </div>
            );
          })}
        </div>
        <textarea
          ref={textareaRef} name={name} value={value} onChange={onChange} rows={1}
          className="w-full bg-slate-900 text-white p-4 font-mono text-sm leading-6 outline-none resize-none whitespace-pre overflow-x-auto overflow-y-hidden"
          placeholder={placeholder} style={{ minHeight: minHeight }}
        />
      </div>
      
      {isChanged && (
          <div className="mt-2 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Line Changes:</p>
              {changedLines.map(change => (
                  <div key={change.index} className="text-xs font-mono">
                      <span className="text-slate-500 mb-1 block">Line {change.index}</span>
                      {change.orig !== undefined && (
                          <div className="text-red-400 bg-red-400/10 px-2 py-1 rounded mb-0.5 break-all">
                              - {change.orig === '' ? '(empty line)' : change.orig}
                          </div>
                      )}
                      {change.curr !== undefined && (
                          <div className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded break-all">
                              + {change.curr === '' ? '(empty line)' : change.curr}
                          </div>
                      )}
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};

const ArtistSearch = ({ selectedArtists, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchDB = async () => {
        if (!query.trim()) { setResults([]); return; }
        setSearching(true);
        const { data } = await supabase.from('artists').select('*').or(`name_en.ilike.%${query}%,name_zh.ilike.%${query}%`).limit(5);
        setResults(data || []);
        setSearching(false);
    };
    const debounce = setTimeout(searchDB, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (artist) => { onSelect(artist); setQuery(''); setShowDropdown(false); };
  const createNewArtist = () => { onSelect({ id: null, name_en: query, name_zh: '', isNew: true }); setQuery(''); setShowDropdown(false); };

  return (
    <div className="relative space-y-2" ref={wrapperRef}>
        <label className="text-slate-400 text-sm font-bold">Artists <span className="text-primary">*</span></label>
        <div className="flex flex-wrap gap-2 mb-2">
            {selectedArtists.map((artist, i) => (
                <div key={artist.id || i} className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border ${artist.isNew ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-primary/10 border-primary/50 text-primary'}`}>
                    <span>{artist.name_en || artist.name_zh} {artist.name_zh && artist.name_en ? `(${artist.name_zh})` : ''}</span>
                    <button type="button" onClick={() => onSelect(artist, true)}><X size={12} /></button>
                </div>
            ))}
        </div>
        <div className="relative">
            <input value={query} onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} placeholder="Search for artist..." className="w-full bg-slate-900 border border-slate-700 p-3 pl-10 rounded-lg text-white focus:border-primary outline-none" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
        </div>
        {showDropdown && query && (
            <div className="absolute z-50 w-full bg-slate-800 border border-slate-700 rounded-lg mt-1 shadow-xl overflow-hidden">
                {searching ? <div className="p-4 text-xs text-slate-500 text-center">Searching...</div> : (
                    <>
                        {results.map(artist => (
                            <div key={artist.id} onClick={() => handleSelect(artist)} className="p-3 hover:bg-slate-700 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0">
                                <div className="w-8 h-8 bg-slate-600 rounded-full overflow-hidden flex-shrink-0">
                                    {artist.avatar_url ? <img src={artist.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">?</div>}
                                </div>
                                <div><p className="text-sm font-bold text-white">{artist.name_en}</p><p className="text-xs text-slate-400">{artist.name_zh}</p></div>
                            </div>
                        ))}
                        <div onClick={createNewArtist} className="p-3 hover:bg-emerald-500/20 cursor-pointer flex items-center gap-2 text-emerald-400 border-t border-white/10">
                            <UserPlus size={16} /><span className="text-sm font-bold">Create new artist "{query}"</span>
                        </div>
                    </>
                )}
            </div>
        )}
    </div>
  );
};


const EditSongPage = ({ isReviewMode = false }) => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [tags, setTags] = useState([]);
  const [selectedArtists, setSelectedArtists] = useState([]); 
  const [originalData, setOriginalData] = useState(null); 

  const [formData, setFormData] = useState({
    title_en: '', title_zh: '', cover_url: '', youtube_url: '', slug: '',
    lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '', credits: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      const tableName = isReviewMode ? 'song_submissions' : 'songs';
      const { data: song, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      
      if (error) {
        alert("Error loading data");
        navigate('/admin');
        return;
      }
      
      setFormData(song);
      if (song.tags) setTags(song.tags);

      if (!isReviewMode) {
          const { data: linkedArtists } = await supabase.from('song_artists').select('artist_id, artists(*)').eq('song_id', id);
          if (linkedArtists) setSelectedArtists(linkedArtists.map(link => link.artists).filter(Boolean));
      } else {
          const enList = (song.artist_en || '').split(',').map(s => s.trim()).filter(Boolean);
          const zhList = (song.artist_zh || '').split(',').map(s => s.trim()).filter(Boolean);
          
          const reconstructed = [];
          const maxLen = Math.max(enList.length, zhList.length);
          for (let i = 0; i < maxLen; i++) {
              reconstructed.push({ id: null, name_en: enList[i] || zhList[i], name_zh: zhList[i] || '', isNew: true });
          }

          const namesToLookup = reconstructed.map(a => a.name_en);
          if (namesToLookup.length > 0) {
              const { data: found } = await supabase.from('artists').select('*').in('name_en', namesToLookup);
              setSelectedArtists(reconstructed.map(a => found?.find(f => f.name_en === a.name_en) || a));
          } else {
              setSelectedArtists(reconstructed);
          }

          if (song.original_song_id) {
              const { data: orig } = await supabase.from('songs').select('*').eq('id', song.original_song_id).single();
              if (orig) setOriginalData(orig);
          }
      }
      setFetching(false);
    };
    fetchData();
  }, [id, navigate, isReviewMode]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSelectArtist = (artist, remove = false) => {
      if (remove) setSelectedArtists(prev => prev.filter(a => (a.id !== artist.id) || (a.isNew && a.name_en !== artist.name_en)));
      else if (!selectedArtists.some(a => a.id === artist.id && !a.isNew)) setSelectedArtists([...selectedArtists, artist]);
  };

  const handleAutoPinyin = () => {
    if (!formData.lyrics_chinese) return;
    const lines = formData.lyrics_chinese.split('\n');
    const pinyinLines = lines.map(line => pinyin(line.replace(/，/g, ',').replace(/。/g, '.').replace(/！/g, '!').replace(/？/g, '?'), { toneType: 'symbol' }));
    setFormData(prev => ({ ...prev, lyrics_pinyin: pinyinLines.join('\n') }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (selectedArtists.length === 0) {
        setLoading(false);
        return alert("Please add at least one artist.");
    }

    const artistEnString = selectedArtists.map(a => a.name_en).join(', ');
    const artistZhString = selectedArtists.map(a => a.name_zh).join(', ');

    let finalSlug = formData.slug;
    if (!finalSlug) {
       const source = formData.title_en || formData.title_zh || "untitled";
       finalSlug = pinyin(source, { toneType: 'none', nonZh: 'consecutive' }).toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-') + '-' + Math.floor(Math.random() * 1000);
    }

    const safePayload = {
        title_en: formData.title_en, title_zh: formData.title_zh, cover_url: formData.cover_url, youtube_url: formData.youtube_url,
        lyrics_chinese: formData.lyrics_chinese, lyrics_pinyin: formData.lyrics_pinyin, lyrics_english: formData.lyrics_english,
        credits: formData.credits, artist_en: artistEnString, artist_zh: artistZhString, tags: tags
    };

    try {
        if (isReviewMode) {
            const payloadForLiveDB = { ...safePayload, slug: finalSlug };

            if (formData.original_song_id) {
                const { error: updateError } = await supabase.from('songs').update(payloadForLiveDB).eq('id', formData.original_song_id);
                if (updateError) throw updateError;
                
                await supabase.from('song_artists').delete().eq('song_id', formData.original_song_id);
                for (const artist of selectedArtists) {
                    let artistId = artist.id;
                    if (!artistId || artist.isNew) {
                        const { data: existing } = await supabase.from('artists').select('id').eq('name_en', artist.name_en).maybeSingle();
                        if (existing) artistId = existing.id;
                        else {
                            const artistSlug = artist.name_en.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
                            const { data: createdArtist } = await supabase.from('artists').insert({ name_en: artist.name_en, name_zh: artist.name_zh, slug: artistSlug }).select().single();
                            artistId = createdArtist.id;
                        }
                    }
                    await supabase.from('song_artists').insert({ song_id: formData.original_song_id, artist_id: artistId });
                }
            } else {
                const { data: newSong, error: insertError } = await supabase.from('songs').insert([payloadForLiveDB]).select().single();
                if (insertError) throw insertError;

                for (const artist of selectedArtists) {
                    let artistId = artist.id;
                    if (!artistId || artist.isNew) {
                         const artistSlug = artist.name_en.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
                         const { data: createdArtist } = await supabase.from('artists').insert({ name_en: artist.name_en, name_zh: artist.name_zh, slug: artistSlug }).select().single();
                         artistId = createdArtist.id;
                    }
                    await supabase.from('song_artists').insert({ song_id: newSong.id, artist_id: artistId });
                }
            }

            await supabase.from('song_submissions').delete().eq('id', id);
            alert("Approved & Published!");
            navigate('/admin');
            
        } else {
            if (profile?.role === 'admin') {
                const payloadForLiveDB = { ...safePayload, slug: finalSlug };
                const { error } = await supabase.from('songs').update(payloadForLiveDB).eq('id', id);
                if (error) throw error;

                await supabase.from('song_artists').delete().eq('song_id', id);
                for (const artist of selectedArtists) {
                    let artistId = artist.id;
                    if (!artistId || artist.isNew) {
                         const artistSlug = artist.name_en.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
                         const { data: createdArtist } = await supabase.from('artists').insert({ name_en: artist.name_en, name_zh: artist.name_zh, slug: artistSlug }).select().single();
                         artistId = createdArtist.id;
                    }
                    await supabase.from('song_artists').insert({ song_id: id, artist_id: artistId });
                }
                navigate(`/song/${formData.slug}`);
                
            } else {
                const submissionPayload = {
                    ...safePayload, original_song_id: id, 
                    submitted_by: user ? (user.user_metadata?.username || user.email.split('@')[0]) : 'Community', status: 'pending_edit'
                };
                const { error } = await supabase.from('song_submissions').insert([submissionPayload]);
                if (error) throw error;
                alert("Edit suggested! An admin will review your changes.");
                navigate(`/song/${formData.slug}`);
            }
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const handleReject = async () => {
    if (!window.confirm("Delete this submission?")) return;
    setLoading(true);
    await supabase.from('song_submissions').delete().eq('id', id);
    navigate('/admin');
    setLoading(false);
  };

  const renderTextInput = (label, name, required = false) => {
      const isChanged = originalData && originalData[name] !== formData[name];
      return (
        <div className={`space-y-2 p-3 rounded-lg transition-colors border ${isChanged ? 'bg-yellow-500/10 border-yellow-500/50' : 'border-transparent'}`}>
            <label className="text-slate-400 text-sm flex justify-between items-center">
                <span>{label} {required && <span className="text-primary">*</span>}</span>
                {isChanged && <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={12}/> Edited</span>}
            </label>
            <input name={name} value={formData[name] || ''} onChange={handleChange} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full" />
            {isChanged && <p className="text-xs text-yellow-500 font-mono mt-1 pt-1 border-t border-yellow-500/20">Original: {originalData[name] || "(empty)"}</p>}
        </div>
      );
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
            
            {renderTextInput("Title (English)", "title_en", true)}
            {renderTextInput("Title (Chinese)", "title_zh")}

            <div className={`lg:col-span-2 p-3 rounded-lg border border-transparent`}>
                <ArtistSearch selectedArtists={selectedArtists} onSelect={handleSelectArtist} />
            </div>

            <div className="space-y-2 p-3">
                <label className="text-slate-400 text-sm">Tags</label>
                <TagInput tags={tags} setTags={setTags} placeholder="Type tag & Enter..." />
            </div>
            
            {renderTextInput("Cover URL", "cover_url")}
            
            <div className="lg:col-span-2">
                {renderTextInput("YouTube URL", "youtube_url")}
            </div>

            {!isReviewMode && (
                <div className="space-y-2 lg:col-span-2 p-3"> 
                    <label className="text-slate-400 text-sm">Slug</label>
                    <input name="slug" value={formData.slug || ''} disabled className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-slate-500 w-full" />
                </div>
            )}
          </div>

          <div className="w-full">
             <LyricsEditor label="Credits" name="credits" value={formData.credits || ''} onChange={handleChange} placeholder="Credits..." minHeight="100px" originalValue={originalData?.credits} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
             <LyricsEditor label="Chinese Characters" name="lyrics_chinese" value={formData.lyrics_chinese} onChange={handleChange} originalValue={originalData?.lyrics_chinese} />
             <div className="relative">
                 <button type="button" onClick={handleAutoPinyin} className="absolute right-0 top-0 z-10 text-xs flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded hover:bg-primary hover:text-white transition-colors mt-2 mr-2">
                   <Sparkles className="w-3 h-3" /> Auto-Fill
                 </button>
                 <LyricsEditor label="Pinyin" name="lyrics_pinyin" value={formData.lyrics_pinyin} onChange={handleChange} originalValue={originalData?.lyrics_pinyin} />
             </div>
             <LyricsEditor label="English Translation" name="lyrics_english" value={formData.lyrics_english} onChange={handleChange} originalValue={originalData?.lyrics_english} />
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