import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { User, Save, ArrowLeft, Camera, Music, Clock, ExternalLink, AtSign } from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Profile State
  const [profile, setProfile] = useState({
    username: '',       // <--- Logic exists
    display_name: '',
    avatar_url: '',
    bio: '',
    website: ''
  });

  const [mySongs, setMySongs] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);

  // 1. Fetch Everything on Load
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileData) {
            setProfile({
                username: profileData.username || '',         // <--- Load it
                display_name: profileData.display_name || '',
                avatar_url: profileData.avatar_url || '',
                bio: profileData.bio || '',
                website: profileData.website || ''
            });
        }

        const { data: songsData } = await supabase
          .from('songs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (songsData) setMySongs(songsData);

        const { data: subsData } = await supabase
            .from('song_submissions')
            .select('*')
            .eq('user_id', user.id); 
        if (subsData) setMySubmissions(subsData);

      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setDataLoading(false);
      }
    };
    loadData();
  }, [user]);

  // 2. Save Changes
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Basic Validation: Usernames shouldn't have spaces
    if (profile.username.includes(' ')) {
        alert("Usernames cannot contain spaces. Use underscores (_) instead.");
        setLoading(false);
        return;
    }

    const updates = {
      id: user.id,
      username: profile.username.toLowerCase(), // Force lowercase
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      website: profile.website,
      updated_at: new Date(),
    };

    const { error } = await supabase.from('profiles').upsert(updates);

    if (error) {
      alert(error.message);
    } else {
      alert('Profile updated successfully!');
    }
    setLoading(false);
  };

  if (dataLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loading profile...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center text-slate-400 hover:text-white mb-8 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" /> 
          Back to Library
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: EDIT PROFILE */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                            <User size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Edit Profile</h2>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        {/* Avatar Preview */}
                        <div className="flex justify-center mb-6">
                            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700 group">
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                                        <User size={32} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* --- NEW SECTION: USERNAME INPUT --- */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username (Unique)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-slate-500">
                                    <AtSign size={14} />
                                </span>
                                <input 
                                    type="text" 
                                    value={profile.username}
                                    onChange={e => setProfile({...profile, username: e.target.value})}
                                    placeholder="kyroranheykids"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 pl-9 text-white mt-1 focus:border-primary outline-none transition-colors font-mono"
                                />
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1 ml-1">No spaces. Used for your profile URL.</p>
                        </div>
                        {/* ----------------------------------- */}

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Display Name</label>
                            <input 
                                type="text" 
                                value={profile.display_name}
                                onChange={e => setProfile({...profile, display_name: e.target.value})}
                                placeholder="Display Name"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white mt-1 focus:border-primary outline-none transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avatar URL</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={profile.avatar_url}
                                    onChange={e => setProfile({...profile, avatar_url: e.target.value})}
                                    placeholder="https://..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 pl-10 text-white mt-1 focus:border-primary outline-none transition-colors text-sm"
                                />
                                <Camera className="absolute left-3 top-[18px] text-slate-500 w-4 h-4" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bio</label>
                            <textarea 
                                value={profile.bio}
                                onChange={e => setProfile({...profile, bio: e.target.value})}
                                placeholder="Tell us about yourself..."
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white mt-1 focus:border-primary outline-none transition-colors text-sm resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Website</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={profile.website}
                                    onChange={e => setProfile({...profile, website: e.target.value})}
                                    placeholder="Your personal site..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 pl-10 text-white mt-1 focus:border-primary outline-none transition-colors text-sm"
                                />
                                <ExternalLink className="absolute left-3 top-[18px] text-slate-500 w-4 h-4" />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-primary hover:opacity-90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all mt-4"
                        >
                            <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            </div>

            {/* RIGHT COLUMN: DASHBOARD */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* 1. MY LIVE SONGS */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500">
                            <Music size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-white">My Contributions <span className="text-slate-500 text-sm ml-2">({mySongs.length})</span></h2>
                    </div>

                    {mySongs.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                            <p className="text-slate-500 text-sm">You haven't uploaded any songs yet.</p>
                            <button onClick={() => navigate('/add')} className="text-primary text-sm font-bold mt-2 hover:underline">Upload your first song</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {mySongs.map(song => (
                                <div key={song.id} onClick={() => navigate(`/song/${song.slug}`)} className="flex items-center gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800 hover:border-slate-600 cursor-pointer transition-colors group">
                                    <img src={song.cover_url || "/default-cover.png"} className="w-12 h-12 rounded-lg object-cover" alt={song.title} />
                                    <div className="overflow-hidden">
                                        <h4 className="text-white font-bold truncate group-hover:text-primary transition-colors">{song.title}</h4>
                                        <p className="text-xs text-slate-500 truncate">{song.artist}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. MY PENDING SUBMISSIONS */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-500">
                            <Clock size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Pending Approval <span className="text-slate-500 text-sm ml-2">({mySubmissions.length})</span></h2>
                    </div>

                    {mySubmissions.length === 0 ? (
                        <p className="text-slate-500 text-sm italic">No pending submissions.</p>
                    ) : (
                        <div className="space-y-3">
                            {mySubmissions.map(sub => (
                                <div key={sub.id} className="flex justify-between items-center p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <img src={sub.cover_url} className="w-10 h-10 rounded-lg object-cover opacity-50" />
                                        <div>
                                            <h4 className="text-slate-300 font-medium text-sm">{sub.title}</h4>
                                            <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded">In Review</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-600">{new Date(sub.created_at).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;