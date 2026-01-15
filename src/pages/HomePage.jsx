import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Music, Flame, Sparkles, Disc, Globe } from 'lucide-react'; 
import { supabase } from '../lib/supabaseClient';
import SongCard from '../components/SongCard';
import ThemeSettings from '../components/ThemeSettings';
import { tify, sify } from 'chinese-conv'; 

const HomePage = () => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Script State (Restoring this feature for you)
  const [scriptMode, setScriptMode] = useState('simplified'); 

  // Fetch songs
  useEffect(() => {
    const fetchSongs = async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) setSongs(data);
      setLoading(false);
    };

    fetchSongs();
  }, []);

  // Toggle script helper
  const toggleScript = () => {
    setScriptMode(prev => prev === 'simplified' ? 'traditional' : 'simplified');
  };

  // --- FILTER LOGIC (Updated to work with your Arrays) ---
  const filteredSongs = songs.filter(song => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query) ||
      (song.artist_chinese && song.artist_chinese.includes(query)) ||
      (song.lyrics_chinese && song.lyrics_chinese.includes(query));

    let matchesTab = true;
    if (activeTab === 'new') {
        matchesTab = true; 
    } else if (activeTab === 'classics') {
        // Safe check for tags array
        matchesTab = song.tags && song.tags.includes('Ballad'); 
    } else if (activeTab === 'trending') {
        matchesTab = song.tags && song.tags.includes('Pop'); 
    }

    return matchesSearch && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 transition-colors duration-500 relative">
      
      {/* 1. Navbar */}
      {/* FIX: Increased Z-Index to 100 so menu is always clickable */}
      <nav className="sticky top-0 z-[100] bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            {/* YOUR ORIGINAL LOGO CODE */}
            <img 
              src="/logo_inverse.svg" 
              alt="Quality Pinyin Logo" 
              className="w-10 h-10 rounded-lg object-cover" 
            />
            <span className="font-bold text-xl tracking-tight text-white">CN Lyric Hub</span>
          </div>

          <div className="hidden md:flex flex-1 max-w-lg mx-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search songs, artists, lyrics..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              // YOUR ORIGINAL STYLE (Keeps Color Picker working)
              className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-900 border border-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all text-sm"
            />
          </div>

          <div className="flex items-center gap-4 relative">
             {/* Script Toggle Button */}
             <button 
              onClick={toggleScript}
              className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full border border-slate-700 hover:border-primary hover:text-primary transition-all"
            >
              <Globe className="w-4 h-4" />
              {scriptMode === 'simplified' ? 'Simplified (简体)' : ' Traditional (繁體)'}
            </button>

            {/* YOUR THEME SETTINGS */}
            <ThemeSettings />

            <button
              onClick={() => navigate('/add')}
              className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-full text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              <Plus size={16} /> 
              <span className="hidden sm:inline">Add Song</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <div className="relative overflow-hidden border-b border-white/5">
        {/* FIX: Added pointer-events-none so you can click buttons underneath the glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-primary/20 rounded-full blur-[120px] -z-10 transition-colors duration-700" />
        
        <div className="max-w-7xl mx-auto px-6 py-16 text-center relative z-10">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Chinese Lyric Database <br className="hidden sm:block" />
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            A community-driven database of Chinese lyrics with full Pinyin and English translations.
          </p>
          
          <div className="flex justify-center gap-2">
            {[
              { id: 'all', label: 'All Songs', icon: Music },
              { id: 'trending', label: 'Trending', icon: Flame },
              { id: 'new', label: 'Fresh Drops', icon: Sparkles },
              { id: 'classics', label: 'Classics', icon: Disc },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                // YOUR ORIGINAL STYLE (Keeps Color Picker working)
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

      {/* 3. Song Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-white mb-6">
          {searchQuery ? `Search Results for "${searchQuery}"` : 'Latest Songs'}
        </h2>

        {loading ? (
          <div className="text-slate-500">Loading library...</div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-white/5 border-dashed">
            <p className="text-slate-400 mb-4">No songs found matching your criteria.</p>
            <button onClick={() => {setSearchQuery(''); setActiveTab('all')}} className="text-primary hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredSongs.map((song) => {
                // 1. Script Conversion Logic
                const displayTitle = scriptMode === 'traditional' ? tify(song.title) : sify(song.title);
                const displayArtist = song.artist_chinese 
                    ? (scriptMode === 'traditional' ? tify(song.artist_chinese) : sify(song.artist_chinese))
                    : song.artist;

                // 2. Prepare Object (THE FIX FOR BLANK SONGS)
                const songForCard = {
                    ...song,
                    title: displayTitle,
                    artist: displayArtist
                };

                return (
                  // FIX: Pass the single object prop
                  <SongCard key={song.id} song={songForCard} />
                );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;