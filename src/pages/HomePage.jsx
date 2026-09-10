import React, { useEffect, useState } from 'react';
import { Music, Flame, Sparkles, Disc } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SongCard from '../components/SongCard';
import Navbar from '../components/Navbar';
import { Helmet } from 'react-helmet-async';
import { tify, sify } from 'chinese-conv';
import { searchSongs, listSongs, trendingSongs, freshSongs, classicSongs, likedSongIds } from '../lib/queries';

const PAGE_SIZE = 36;

// Which query backs each tab. Kept as data so the fetch effect stays one branch.
const TAB_QUERY = {
  all: listSongs,
  trending: trendingSongs,
  new: freshSongs,
  classics: classicSongs,
};

const HomePage = () => {
  const { user } = useAuth();
  const { scriptMode } = useTheme();
  const [songs, setSongs] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userLikedIds, setUserLikedIds] = useState(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Debounce search input so we don't hit the DB on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset pagination whenever the view changes
  useEffect(() => { setPage(0); }, [activeTab, debouncedQuery]);

  // One branch: pick the query for the current view and run it. Every query lives
  // in src/lib/queries.js, which is also where input sanitising and 1000-row
  // paging happen — those used to be re-decided (and got wrong) per call site.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (page === 0) setLoading(true); else setLoadingMore(true);
      setLoadError(false);

      const result = debouncedQuery
        ? await searchSongs(debouncedQuery, { page, pageSize: PAGE_SIZE })
        : await (TAB_QUERY[activeTab] || listSongs)({ page, pageSize: PAGE_SIZE });

      if (cancelled) return;
      // A failed query used to render as "No songs found", indistinguishable from
      // an empty catalogue.
      if (result.error) setLoadError(true);
      setSongs(result.songs);
      setHasMore(result.hasMore);
      setLoading(false);
      setLoadingMore(false);
    };

    run();
    return () => { cancelled = true; };
  }, [debouncedQuery, activeTab, page, reloadKey]);

  // Which of these the viewer has liked. Scoped to one user, never the whole table.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      // Signing out must clear the hearts, or they stay filled for the next viewer.
      setUserLikedIds(new Set());
      return;
    }
    likedSongIds(user.id).then((ids) => { if (!cancelled) setUserLikedIds(ids); });
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 relative">
      <Helmet>
        <title>CN Lyric Hub — Chinese Lyrics with Pinyin & English Translations</title>
        <meta name="description" content="Browse a community database of Chinese song lyrics with character-by-character Pinyin and English translations. Read along, learn the language, and contribute." />
        <link rel="canonical" href="https://cnlyrichub.vercel.app/" />
        <meta property="og:title" content="CN Lyric Hub — Chinese Lyrics with Pinyin & Translations" />
        <meta property="og:description" content="A community database of Chinese lyrics with full Pinyin and English translations." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnlyrichub.vercel.app/" />
      </Helmet>

      <Navbar showSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-primary/20 rounded-full blur-[120px] -z-10 transition-colors duration-700" />
        <div className="max-w-7xl mx-auto px-6 py-16 text-center relative z-10">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white mb-6 tracking-tight">Chinese Lyric Database</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">A community-driven database of Chinese lyrics with full Pinyin and English translations.</p>
          
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { id: 'all', label: 'All Songs', icon: Music },
              { id: 'trending', label: 'Trending', icon: Flame },
              { id: 'new', label: 'Fresh Drops', icon: Sparkles },
              { id: 'classics', label: 'Classics', icon: Disc },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Song Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-white mb-6">
          {searchQuery ? `Search Results for "${searchQuery}"` : 
           activeTab === 'all' ? 'Latest Songs' :
           activeTab === 'trending' ? 'Trending Hits' :
           activeTab === 'classics' ? 'Timeless Classics' : 'Fresh Drops'}
        </h2>

        {loading ? (
          <div className="text-slate-500">Loading library...</div>
        ) : loadError ? (
          <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-red-500/20 border-dashed">
            <p className="text-slate-300 mb-2">We couldn't load the library just now.</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="text-primary hover:underline text-sm">Try again</button>
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-white/5 border-dashed">
            <p className="text-slate-400 mb-4">No songs found matching your criteria.</p>
            <button onClick={() => {setSearchQuery(''); setActiveTab('all')}} className="text-primary hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {songs.map((song) => {
                const rawChinese = song.title_zh || song.title_en || "Untitled";
                const displayChinese = scriptMode === 'traditional' ? tify(rawChinese) : sify(rawChinese);
                return (
                  <SongCard 
                    key={song.id} 
                    song={{ ...song, display_title: displayChinese }}
                    initialLikeCount={song.song_likes?.[0]?.count || 0}
                    initialIsLiked={userLikedIds.has(song.id)}
                  />
                );
            })}
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center mt-10">
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={loadingMore}
              className="px-8 py-2.5 rounded-full text-sm font-medium bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;