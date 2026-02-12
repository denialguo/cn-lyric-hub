import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { User, Save, ArrowLeft, Camera, Music, Clock, AtSign, Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null); // Reference to the hidden file input
  
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [uploading, setUploading] = useState(false); // New state for image upload
  
  // Username Checking States
  const [usernameStatus, setUsernameStatus] = useState('idle'); 
  const [statusMessage, setStatusMessage] = useState('');

  const [profile, setProfile] = useState({
    username: '',       
    display_name: '',
    avatar_url: '',
    bio: ''
  });

  const [mySongs, setMySongs] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);

  // 1. Fetch Data & Auto-Fill
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        const meta = user.user_metadata || {};
        
        let finalUsername = profileData?.username || '';
        let finalDisplayName = profileData?.display_name || '';
        let finalAvatar = profileData?.avatar_url || meta.avatar_url || meta.picture || '';
        let finalBio = profileData?.bio || '';

        if (!finalUsername) {
            let baseName = (meta.full_name || meta.name || user.email?.split('@')[0] || 'user')
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '_')       
                .replace(/[^a-z0-9_]/g, '') 
                .slice(0, 20);              

            const { data: conflict } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', baseName)
                .maybeSingle();

            if (conflict) {
                baseName = `${baseName}${Math.floor(100 + Math.random() * 900)}`;
            }

            finalUsername = baseName;
            if (!finalDisplayName) finalDisplayName = baseName;
        }

        setProfile({
            username: finalUsername,
            display_name: finalDisplayName,
            avatar_url: finalAvatar,
            bio: finalBio
        });

        const { data: songsData } = await supabase
          .from('songs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (songsData) setMySongs(songsData);

        const { data: subsData } = await supabase
            .from('song_submissions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }); 
        if (subsData) setMySubmissions(subsData);

      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setDataLoading(false);
      }
    };
    loadData();
  }, [user]);

  // 2. Live Username Checker
  useEffect(() => {
      if (usernameStatus !== 'checking') return;

      const checkAvailability = async () => {
          if (!profile.username) return;

          if (profile.username.includes(' ')) {
              setUsernameStatus('taken');
              setStatusMessage('Usernames cannot contain spaces');
              return;
          }

          const { data } = await supabase
              .from('profiles')
              .select('id')
              .eq('username', profile.username)
              .neq('id', user.id) 
              .maybeSingle();

          if (data) {
              setUsernameStatus('taken');
              setStatusMessage('This username is already taken');
          } else {
              setUsernameStatus('available');
              setStatusMessage('Username available');
          }
      };

      const timer = setTimeout(checkAvailability, 500);
      return () => clearTimeout(timer);

  }, [profile.username, usernameStatus, user?.id]);

  // --- NEW: AVATAR UPLOAD HANDLER ---
  const handleAvatarUpload = async (event) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      // 3. Update State
      setProfile(prev => ({ ...prev, avatar_url: data.publicUrl }));

    } catch (error) {
      alert('Error uploading avatar: ' + error.message);
    } finally {
      setUploading(false);
    }
  };
  // ----------------------------------

  const handleSave = async (e) => {
    e.preventDefault();
    if (usernameStatus === 'taken' || usernameStatus === 'checking') return;
    setLoading(true);

    const updates = {
      id: user.id,
      username: profile.username.toLowerCase(), 
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      updated_at: new Date(),
    };

    const { error } = await supabase.from('profiles').upsert(updates);

    if (error) {
      alert(error.message);
    } else {
      const btn = document.getElementById('save-btn');
      if(btn) {
          btn.innerText = "Saved!";
          setTimeout(() => btn.innerText = "Save Changes", 2000);
      }
    }
    setLoading(false);
  };

  if (dataLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loading profile...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center text-slate-400 hover:text-white mb-8 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" /> 
          Back to Library
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                            <User size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Edit Profile</h2>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        
                        {/* --- CLICKABLE AVATAR UPLOAD --- */}
                        <div className="flex justify-center mb-6 relative">
                            <div 
                                onClick={() => fileInputRef.current.click()} // Trigger hidden input
                                className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700 group cursor-pointer hover:border-primary transition-colors"
                            >
                                {uploading ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all z-10">
                                        <Camera className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" size={24} />
                                    </div>
                                )}
                                
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                                        <User size={32} />
                                    </div>
                                )}
                            </div>
                            {/* Hidden Input */}
                            <input
                                type="file"
                                id="avatar-upload"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                className="hidden"
                            />
                        </div>
                        {/* ------------------------------- */}

                        {/* Username Input */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username (Unique)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                    <AtSign size={14} />
                                </span>
                                <input 
                                    type="text" 
                                    value={profile.username}
                                    onChange={e => {
                                        setUsernameStatus('checking'); 
                                        setStatusMessage('Checking...');
                                        setProfile({...profile, username: e.target.value});
                                    }}
                                    placeholder="kyroranheykids"
                                    className={`w-full bg-slate-950 border rounded-lg p-3 pl-9 text-white mt-1 outline-none transition-colors font-mono ${
                                        usernameStatus === 'taken' ? 'border-red-500/50 focus:border-red-500' : 
                                        usernameStatus === 'available' ? 'border-green-500/50 focus:border-green-500' : 
                                        'border-slate-800 focus:border-primary'
                                    }`}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                                    {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
                                    {usernameStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                    {usernameStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
                                </div>
                            </div>
                            <div className="h-4 mt-1 pl-1">
                                {usernameStatus === 'taken' && <p className="text-[10px] text-red-400 font-bold animate-pulse">{statusMessage}</p>}
                                {usernameStatus === 'available' && <p className="text-[10px] text-green-400 font-bold">Username is available!</p>}
                            </div>
                        </div>

                        {/* Display Name */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Display Name</label>
                            <input 
                                type="text" 
                                value={profile.display_name}
                                onChange={e => setProfile({...profile, display_name: e.target.value})}
                                placeholder="Nickname"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white mt-1 focus:border-primary outline-none transition-colors"
                            />
                        </div>

                        {/* Avatar URL (Keep as read-only or manual override) */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avatar URL</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={profile.avatar_url}
                                    onChange={e => setProfile({...profile, avatar_url: e.target.value})}
                                    placeholder="https://..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 pl-10 text-white mt-1 focus:border-primary outline-none transition-colors text-sm text-slate-400"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1 ml-1">Click the image above to upload, or paste a URL here.</p>
                        </div>

                        {/* Bio */}
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

                        <button 
                            id="save-btn"
                            type="submit" 
                            disabled={loading || usernameStatus === 'taken' || usernameStatus === 'checking'}
                            className={`w-full font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all mt-4 ${
                                (usernameStatus === 'taken' || usernameStatus === 'checking')
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-primary hover:opacity-90 text-white'
                            }`}
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
                                    <img src={song.cover_url || "/default-cover.png"} className="w-12 h-12 rounded-lg object-cover" alt={song.title_zh} />
                                    <div className="overflow-hidden">
                                        <h4 className="text-white font-bold truncate group-hover:text-primary transition-colors">{song.title_zh || song.title_en}</h4>
                                        <p className="text-xs text-slate-500 truncate">{song.artist_en}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. MY SUBMISSIONS */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-500">
                            <Clock size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Submission Status <span className="text-slate-500 text-sm ml-2">({mySubmissions.length})</span></h2>
                    </div>

                    {mySubmissions.length === 0 ? (
                        <p className="text-slate-500 text-sm italic">No submissions history.</p>
                    ) : (
                        <div className="space-y-3">
                            {mySubmissions.map(sub => (
                                <div key={sub.id} className="flex justify-between items-center p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <img src={sub.cover_url} className="w-10 h-10 rounded-lg object-cover opacity-50" />
                                        <div>
                                            <h4 className="text-slate-300 font-medium text-sm">{sub.title_zh || sub.title_en}</h4>
                                            
                                            <div className="mt-1">
                                                {sub.status === 'pending' && (
                                                    <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                                                        <AlertCircle size={10} /> Pending
                                                    </span>
                                                )}
                                                {sub.status === 'rejected' && (
                                                    <span className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                                                        <XCircle size={10} /> Rejected
                                                    </span>
                                                )}
                                                {sub.status === 'approved' && (
                                                    <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                                                        <CheckCircle size={10} /> Live
                                                    </span>
                                                )}
                                            </div>
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