import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { User, Music, ArrowLeft, Globe, ExternalLink } from 'lucide-react';
import SongCard from '../components/SongCard';
import { tify, sify } from 'chinese-conv'; 

const PublicProfile = () => {
  const { username } = useParams(); // We will use the username from the URL
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      // 1. Find the User ID based on the unique Display Name
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('display_name', username)
        .single();

      if (error || !profileData) {
        setLoading(false);
        return; 
      }

      setProfile(profileData);

      // 2. Fetch their approved songs
      const { data: songsData } = await supabase
        .from('songs')
        .select('*')
        .eq('user_id', profileData.id) // Use the ID we just found
        .order('created_at', { ascending: false });

      if (songsData) setSongs(songsData);
      setLoading(false);
    };

    fetchProfileData();
  }, [username]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loading profile...</div>;
  if (!profile) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">User not found.</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        {/* Header / Back Button */}
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Library
        </button>

        {/* Profile Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 mb-12 shadow-2xl relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
            {/* Avatar */}
            <div className="w-32 h-32 rounded-full border-4 border-slate-800 overflow-hidden bg-slate-950 shadow-xl flex-shrink-0">
               {profile.avatar_url ? (
                 <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.display_name} />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-900">
                    <User size={48} />
                 </div>
               )}
            </div>

            {/* Info */}
            <div className="text-center md:text-left space-y-4 flex-1">
               <div>
                 <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{profile.display_name}</h1>
                 {profile.website && (
                   <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center text-primary hover:underline text-sm gap-1">
                     <Globe size={14} /> {profile.website.replace(/^https?:\/\//, '')} <ExternalLink size={12} />
                   </a>
                 )}
               </div>

               {profile.bio && (
                 <p className="text-slate-400 max-w-2xl leading-relaxed text-lg">{profile.bio}</p>
               )}
            </div>

            {/* Stats */}
            <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800 text-center min-w-[140px]">
               <div className="text-3xl font-bold text-white mb-1">{songs.length}</div>
               <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contributions</div>
            </div>
          </div>
        </div>

        {/* User's Songs Grid */}
        <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Music size={20} />
            </div>
            <h2 className="text-2xl font-bold text-white">Latest Contributions</h2>
        </div>

        {songs.length === 0 ? (
            <div className="text-slate-500 italic">This user hasn't uploaded any songs yet.</div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {songs.map((song) => {
                    // Reusing your SongCard logic
                    const songForCard = {
                        ...song,
                        title: sify(song.title), // Defaulting to Simplified for viewing
                        artist: song.artist
                    };
                    return <SongCard key={song.id} song={songForCard} />;
                })}
            </div>
        )}

      </div>
    </div>
  );
};

export default PublicProfile;