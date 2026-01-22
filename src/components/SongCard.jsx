import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Heart } from 'lucide-react';

// This component receives a single "song" prop
const SongCard = ({ song }) => {
  // Safety check: If no data passed, render nothing
  if (!song) return null;

  return (
    <Link 
      to={`/song/${song.slug}`} 
      className="group bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden hover:bg-slate-800 transition-all hover:scale-[1.02] hover:shadow-2xl flex flex-col h-full"
    >
      {/* IMAGE */}
      <div className="relative aspect-square overflow-hidden bg-slate-900">
        <img 
          src={song.cover_url || "/default-cover.png"} 
          alt={song.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-primary text-white p-3 rounded-full shadow-lg transform scale-50 group-hover:scale-100 transition-transform">
            <Play fill="currentColor" className="w-6 h-6 ml-1" />
          </div>
        </div>
      </div>

      {/* TEXT INFO */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-white font-bold text-lg truncate leading-tight">
          {song.title}
        </h3>
        {song.title_chinese && (
          <p className="text-primary text-sm font-medium truncate mt-0.5">
            {song.title_chinese}
          </p>
        )}
        <p className="text-slate-400 text-sm truncate mt-1">
          {song.artist}
        </p>
        
        {/* Footer */}
        <div className="mt-auto pt-4 flex items-center justify-between">
           <div className="flex items-center text-slate-500 text-xs">
             <Heart className="w-4 h-4 mr-1" /> {song.likes || 0}
           </div>
           <div className="flex gap-2">
             {Array.isArray(song.tags) && song.tags.slice(0, 2).map(tag => (
               <span key={tag} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded-full border border-slate-700">
                 #{tag}
               </span>
             ))}
           </div>
        </div>
      </div>
    </Link>
  );
};

export default SongCard;