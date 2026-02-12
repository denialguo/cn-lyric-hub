import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, Mic2, Disc } from 'lucide-react';

const ArtistPage = () => {
  const { name } = useParams(); // Gets 'Jay Chou' from url
  const navigate = useNavigate();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Decode the URL (e.g., "Jay%20Chou" -> "Jay Chou")
  const artistName = decodeURIComponent(name);

  useEffect(() => {
    const fetchArtistSongs = async () => {
      // 1. First, find ANY song where this artist appears (in either column)
      //    This helps us find their "Alias" (the other language name)
      const { data: anySong } = await supabase
        .from('songs')
        .select('artist_en, artist_zh')
        .or(`artist_en.ilike.%${artistName}%,artist_zh.ilike.%${artistName}%`)
        .limit(1)
        .maybeSingle();

      let query = supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Build the Smart Search
      if (anySong) {
        // We found a song! Let's get both names from it.
        // If I searched "Jay Chou", foundSong might have { en: "Jay Chou", zh: "周杰伦" }
        // Now I know his Chinese name is "周杰伦"!
        
        const possibleNames = [];
        if (anySong.artist_en) possibleNames.push(...anySong.artist_en.split(',').map(s => s.trim()));
        if (anySong.artist_zh) possibleNames.push(...anySong.artist_zh.split(',').map(s => s.trim()));
        
        // Clean up duplicates
        const uniqueNames = [...new Set(possibleNames)];
        
        // 3. Search for ANY of these names
        // "Find songs where artist is 'Jay Chou' OR '周杰伦'"
        const orQuery = uniqueNames.map(name => `artist_en.ilike.%${name}%,artist_zh.ilike.%${name}%`).join(',');
        query = query.or(orQuery);
      } else {
        // Fallback: Just search for the URL name if we've never seen this artist before
        query = query.or(`artist_en.ilike.%${artistName}%,artist_zh.ilike.%${artistName}%`);
      }

      const { data } = await query;
      setSongs(data || []);
      setLoading(false);
    };

    fetchArtistSongs();
  }, [artistName]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 text-white">
      <div className="max-w-6xl mx-auto">
        
        <button onClick={() => navigate('/')} className="flex items-center text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Library
        </button>

        {/* ARTIST HEADER */}
        <div className="flex items-end gap-6 mb-12 border-b border-slate-800 pb-8">
            <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 shadow-2xl">
                <Mic2 size={48} className="text-slate-500" />
            </div>
            <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">{artistName}</h1>
                <p className="text-slate-400 font-medium flex items-center gap-2">
                    <Disc size={18} /> {songs.length} Songs Available
                </p>
            </div>
        </div>

        {/* SONG GRID */}
        {loading ? (
            <div className="text-slate-500">Loading discography...</div>
        ) : songs.length === 0 ? (
            <div className="text-slate-500 italic">No songs found for this artist.</div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {songs.map(song => (
                    <div 
                        key={song.id} 
                        onClick={() => navigate(`/song/${song.slug}`)}
                        className="bg-slate-900/50 group hover:bg-slate-800 border border-slate-800 hover:border-slate-600 rounded-2xl p-4 transition-all cursor-pointer flex gap-4 items-center"
                    >
                        <img 
                            src={song.cover_url} 
                            alt={song.title_zh}
                            className="w-20 h-20 rounded-lg object-cover shadow-lg group-hover:scale-105 transition-transform"
                        />
                        <div className="overflow-hidden">
                            <h3 className="font-bold text-lg truncate text-slate-100 group-hover:text-primary transition-colors">
                                {song.title_zh || song.title_en}
                            </h3>
                            <p className="text-sm text-slate-500 truncate">
                                {song.title_en}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default ArtistPage;