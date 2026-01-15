import React from 'react';
import { Play, Heart, Hash } from 'lucide-react'; // Swapped Mic2 for Hash icon

const SongCard = ({ title, artist, tags, coverUrl, likes }) => {
  // If tags exist, take the first 2. If not, fallback to empty array.
  const displayTags = tags && tags.length > 0 ? tags.slice(0, 2) : [];

  return (
    <div className="group bg-slate-800/50 hover:bg-slate-800 rounded-xl overflow-hidden transition-all duration-300 border border-white/5 hover:border-white/10 hover:-translate-y-1 cursor-pointer h-full flex flex-col">
      <div className="relative aspect-square w-full overflow-hidden bg-slate-900">
        <img 
          src={coverUrl || "https://via.placeholder.com/400"} 
          alt={title} 
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {e.target.src = "https://via.placeholder.com/400?text=No+Image"}}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
          <div className="bg-emerald-500 p-3 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-all">
            <Play className="w-6 h-6 text-black ml-1" />
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-base text-white truncate mb-1">{title}</h3>
        <p className="text-slate-400 text-sm truncate">{artist}</p>
        
        <div className="mt-auto pt-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
             <Heart className="w-3.5 h-3.5" /> <span>{likes || 0}</span>
          </div>
          
          {/* NEW: Loop through tags instead of showing one category */}
          <div className="flex gap-1">
            {displayTags.length > 0 ? (
              displayTags.map((tag, i) => (
                <span key={i} className="bg-slate-700 px-2 py-0.5 rounded text-slate-300 flex items-center gap-1">
                  <Hash size={10} /> {tag}
                </span>
              ))
            ) : (
              // Fallback if no tags exist yet
              <span className="bg-slate-700 px-2 py-0.5 rounded text-slate-300">Music</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongCard;