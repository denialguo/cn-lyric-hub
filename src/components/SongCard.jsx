import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Play, Heart } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const SongCard = ({ song }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Local state for immediate feedback
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    fetchLikes();
  }, [song.id, user]);

  const fetchLikes = async () => {
    // 1. Get total count
    const { count } = await supabase
      .from('song_likes')
      .select('*', { count: 'exact', head: true })
      .eq('song_id', song.id);
    
    setLikesCount(count || 0);

    // 2. Check if current user liked it
    if (user) {
      const { data } = await supabase
        .from('song_likes')
        .select('*')
        .eq('song_id', song.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      setIsLiked(!!data);
    }
  };

  const handleLike = async (e) => {
    e.stopPropagation(); // Don't navigate to the song page
    if (!user) return alert("Please sign in to like songs!");

    // Optimistic Update
    const newLikedStatus = !isLiked;
    setIsLiked(newLikedStatus);
    setLikesCount(prev => newLikedStatus ? prev + 1 : prev - 1);

    if (newLikedStatus) {
      await supabase.from('song_likes').insert({ song_id: song.id, user_id: user.id });
    } else {
      await supabase.from('song_likes').delete().eq('song_id', song.id).eq('user_id', user.id);
    }
  };

  const mainTitle = song.display_title || song.title_zh || song.title_en;
  const subTitle = song.title_en; 
  const showSubTitle = subTitle && subTitle !== mainTitle;
  const artistString = song.artist_en || song.artist_zh || "Unknown";

  return (
    <div 
      onClick={() => navigate(`/song/${song.slug}`)}
      className="group relative bg-slate-900 rounded-2xl overflow-hidden hover:-translate-y-2 transition-all duration-300 border border-slate-800 hover:shadow-2xl hover:shadow-primary/20 cursor-pointer"
    >
      <div className="aspect-square overflow-hidden relative">
        <img src={song.cover_url} alt={mainTitle} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-[2px]">
          <button className="bg-primary text-white p-3 rounded-full transform scale-50 group-hover:scale-100 transition-all duration-300 shadow-lg hover:bg-primary/90">
            <Play fill="currentColor" className="w-6 h-6 ml-1" />
          </button>
        </div>
        {song.tags && song.tags.length > 0 && (
          <div className="absolute bottom-3 right-3">
             <span className="bg-black/60 backdrop-blur-md text-slate-200 text-[10px] px-2 py-1 rounded-full border border-white/10 shadow-sm">
               #{song.tags[0]}
             </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-primary font-bold text-lg truncate mb-1 leading-tight">{mainTitle}</h3>
        {showSubTitle ? <p className="text-slate-400 text-sm font-medium truncate mb-2">{subTitle}</p> : <div className="h-2"></div>}

        <div className="text-slate-500 text-xs truncate font-medium">
          {artistString.split(',').map((artist, i) => (
            <span key={i}>
              <Link to={`/artist/${artist.trim()}`} onClick={(e) => e.stopPropagation()} className="hover:text-white hover:underline transition-colors">
                {artist.trim()}
              </Link>
              {i < artistString.split(',').length - 1 && ", "}
            </span>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-slate-500 text-xs">
           <button 
             onClick={handleLike}
             className={`flex items-center gap-1 transition-colors ${isLiked ? 'text-red-500' : 'hover:text-red-400'}`}
           >
              <Heart className="w-3.5 h-3.5" fill={isLiked ? "currentColor" : "none"} /> 
              {likesCount}
           </button>
        </div>
      </div>
    </div>
  );
};

export default SongCard;