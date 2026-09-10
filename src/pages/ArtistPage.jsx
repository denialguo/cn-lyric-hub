import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { songsByArtist, likedSongIds } from '../lib/queries';
import { ArrowLeft, Mic2, Disc } from 'lucide-react';
import SongCard from '../components/SongCard';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const ArtistPage = () => {
  const { name } = useParams(); // Gets 'Jay Chou' from url
  const navigate = useNavigate();
  const { user } = useAuth();
  const [songs, setSongs] = useState([]);
  const [likedIds, setLikedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Decode the URL (e.g., "Jay%20Chou" -> "Jay Chou"). A malformed escape such as
  // "/artist/%" makes decodeURIComponent throw, which would take out the route.
  let artistName = name;
  try {
    artistName = decodeURIComponent(name);
  } catch {
    artistName = name;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    songsByArtist(artistName).then(({ songs: found }) => {
      if (cancelled) return;
      setSongs(found);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [artistName]);

  // One batched query instead of SongCard firing two per card
  useEffect(() => {
    let cancelled = false;
    if (!user) { setLikedIds(new Set()); return; }
    likedSongIds(user.id).then((ids) => { if (!cancelled) setLikedIds(ids); });
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Helmet>
        <title>{artistName} — CN Lyric Hub</title>
        <meta name="description" content={`Browse all songs by ${artistName} with Pinyin and English translations on CN Lyric Hub.`} />
        <link rel="canonical" href={`https://cnlyrichub.vercel.app/artist/${encodeURIComponent(artistName)}`} />
        {/* Any URL can reach this route, so an artist with no songs must not be
            indexed as a thin near-duplicate of every other empty artist page. */}
        {!loading && songs.length === 0 && <meta name="robots" content="noindex, follow" />}
      </Helmet>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6 md:p-12">

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
            <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-white/5 border-dashed">
              <p className="text-slate-400 mb-2">We don't have any songs for “{artistName}” yet.</p>
              <button onClick={() => navigate('/')} className="text-primary hover:underline text-sm font-medium">Browse the library</button>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {songs.map(song => (
                    <SongCard
                      key={song.id}
                      song={song}
                      initialLikeCount={song.song_likes?.[0]?.count || 0}
                      initialIsLiked={likedIds.has(song.id)}
                    />
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default ArtistPage;