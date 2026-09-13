import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Music } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const SongCard = ({ song, initialLikeCount, initialIsLiked, hasTranslation = false }) => {
  const { user, ensureUser } = useAuth();
  const { toast } = useToast();
  
  // Use pre-fetched data when available (from HomePage batch query)
  const hasInitialData = initialLikeCount !== undefined;
  const [likesCount, setLikesCount] = useState(hasInitialData ? initialLikeCount : 0);
  const [isLiked, setIsLiked] = useState(initialIsLiked || false);

  // Only fetch individually if no pre-fetched data was passed (e.g. ArtistPage, PublicProfile)
  useEffect(() => {
    if (!hasInitialData) fetchLikes();
  }, [song.id, user]);

  // Sync when parent passes new initial data (e.g. user logs in, HomePage re-fetches)
  useEffect(() => {
    if (hasInitialData) {
      setLikesCount(initialLikeCount);
      setIsLiked(initialIsLiked || false);
    }
  }, [initialLikeCount, initialIsLiked]);

  const fetchLikes = async () => {
    const { count } = await supabase
      .from('song_likes')
      .select('*', { count: 'exact', head: true })
      .eq('song_id', song.id);
    
    setLikesCount(count || 0);

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
    e.stopPropagation();
    
    // Lazy auth — creates anonymous session only on first interaction
    const currentUser = await ensureUser();
    if (!currentUser) return;

    // Snapshot for rollback if the write fails
    const prevLiked = isLiked;
    const prevCount = likesCount;

    const newLikedStatus = !isLiked;
    setIsLiked(newLikedStatus);
    setLikesCount(prev => newLikedStatus ? prev + 1 : prev - 1);

    const { error } = newLikedStatus
      ? await supabase.from('song_likes').insert({ song_id: song.id, user_id: currentUser.id })
      : await supabase.from('song_likes').delete().eq('song_id', song.id).eq('user_id', currentUser.id);

    if (error) {
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
      toast.error("Couldn't save your like. Try again.");
    }
  };

  // Album art is hotlinked from Apple's CDN, so a URL can go dead at any time.
  // Fall back to the same placeholder an absent cover gets.
  const [coverFailed, setCoverFailed] = useState(false);

  const mainTitle = song.display_title || song.title_zh || song.title_en;
  const subTitle = song.title_en; 
  const showSubTitle = subTitle && subTitle !== mainTitle;
  const artistString = song.artist_en || song.artist_zh || "Unknown";

  return (
    <article
      className="group relative bg-slate-900 rounded-2xl overflow-hidden transition-colors border border-slate-800 hover:border-slate-600"
    >
      <Link to={`/song/${song.slug}`} aria-label={`Read ${mainTitle}`} className="block aspect-square overflow-hidden relative">
        {song.cover_url && !coverFailed ? (
          <img src={song.cover_url} alt={`Album cover for ${mainTitle} by ${artistString}`} loading="lazy" decoding="async" onError={() => setCoverFailed(true)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center gap-3 transition-transform duration-700 group-hover:scale-110">
            <Music className="w-10 h-10 text-slate-600" />
            <span className="text-slate-600 text-2xl font-bold">{(mainTitle || '?')[0]}</span>
          </div>
        )}
        {song.tags && song.tags.length > 0 && (
          <div className="absolute bottom-3 right-3">
             <span className="bg-black/60 backdrop-blur-md text-slate-200 text-[10px] px-2 py-1 rounded-full border border-white/10 shadow-sm">
               #{song.tags[0]}
             </span>
          </div>
        )}
      </Link>

      <div className="p-3 sm:p-5">
        <h3 className="text-primary font-bold text-base sm:text-lg mb-1 leading-snug"><Link to={`/song/${song.slug}`} className="line-clamp-2">{mainTitle}</Link></h3>
        {showSubTitle ? <p className="text-slate-400 text-sm font-medium truncate mb-2">{subTitle}</p> : <div className="h-2"></div>}

        <div className="text-slate-400 text-xs truncate font-medium">
          {artistString.split(',').map((artist, i) => (
            <span key={i}>
              <Link to={`/artist/${encodeURIComponent(artist.trim())}`} onClick={(e) => e.stopPropagation()} className="hover:text-white hover:underline transition-colors">
                {artist.trim()}
              </Link>
              {i < artistString.split(',').length - 1 && ", "}
            </span>
          ))}
        </div>

        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-slate-400 text-xs">
           <button 
             onClick={handleLike}
             aria-label={`${isLiked ? "Unlike" : "Like"} ${mainTitle}`}
             aria-pressed={isLiked}
             className={`flex min-h-11 min-w-11 items-center gap-1 transition-colors ${isLiked ? 'text-red-500' : 'hover:text-red-400'}`}
           >
              <Heart className="w-3.5 h-3.5" fill={isLiked ? "currentColor" : "none"} /> 
              {likesCount}
           </button>
          {hasTranslation && <span className="text-xs text-primary">English</span>}
        </div>
      </div>
    </article>
  );
};

export default SongCard;
