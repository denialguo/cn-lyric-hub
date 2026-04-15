import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Flame, Sparkles, Disc } from 'lucide-react'; 
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SongCard from '../components/SongCard';
import Navbar from '../components/Navbar';
import { tify, sify } from 'chinese-conv'; 

const HomePage = () => {
  const { user } = useAuth();
  const { scriptMode } = useTheme();
  const navigate = useNavigate();
  const [songs, setSongs] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userLikedIds, setUserLikedIds] = useState(new Set());

  useEffect(() => {
    const fetchSongs = async () => {
      const { data } = await supabase
        .from('songs')
        .select('*, song_likes(count)') 
        .order('created_at', { ascending: false });
      if (data) setSongs(data);
      setLoading(false);
    };
    fetchSongs();
  }, []);

  useEffect(() => {
    const fetchUserLikes = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('song_likes')
        .select('song_id')
        .eq('user_id', user.id);
      if (data) setUserLikedIds(new Set(data.map(d => d.song_id)));
    };
    fetchUserLikes();
  }, [user]);

  const filteredSongs = songs.filter(song => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      (song.title_zh || '').toLowerCase().includes(query) ||
      (song.title_en || '').toLowerCase().includes(query) ||
      (song.artist_en || '').toLowerCase().includes(query) ||
      (song.artist_zh || '').includes(query);

    let matchesTab = true;
    const tags = Array.isArray(song.tags) ? song.tags.map(t => t.toLowerCase()) : [];

    if (activeTab === 'classics') {
      matchesTab = tags.some(t => ['ballad', 'classic', 'opera', 'traditional', '90s', '80s'].includes(t));
    } else if (activeTab === 'trending') {
      matchesTab = song.song_likes && song.song_likes[0]?.count > 0;
    }

    return matchesSearch && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 relative">
      
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
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-white/5 border-dashed">
            <p className="text-slate-400 mb-4">No songs found matching your criteria.</p>
            <button onClick={() => {setSearchQuery(''); setActiveTab('all')}} className="text-primary hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredSongs.map((song) => {
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
      </main>
    </div>
  );
};

export default HomePage;