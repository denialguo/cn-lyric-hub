import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Heart } from 'lucide-react';

const SongCard = ({ song }) => {
  const navigate = useNavigate();

  const mainTitle = song.display_title || song.title_chinese || song.title;
  const rawSubTitle = song.title; 
  const showSubTitle = rawSubTitle && rawSubTitle !== mainTitle;

  return (
    <div 
      onClick={() => navigate(`/song/${song.slug}`)}
      className="group relative bg-slate-900 rounded-2xl overflow-hidden hover:-translate-y-2 transition-all duration-300 border border-slate-800 hover:shadow-2xl hover:shadow-primary/20 cursor-pointer"
    >
      <div className="aspect-square overflow-hidden relative">
        <img 
          src={song.cover_url} 
          alt={mainTitle} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
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
        {/* MAIN TITLE: Changed to text-primary (Colored) */}
        <h3 className="text-primary font-bold text-lg truncate mb-1 leading-tight">
          {mainTitle}
        </h3>
        
        {/* SUBTITLE: Changed to text-slate-400 (Neutral/Not Colored) */}
        {showSubTitle ? (
           <p className="text-slate-400 text-sm font-medium truncate mb-2">
             {rawSubTitle}
           </p>
        ) : (
           <div className="h-2"></div>
        )}

        <p className="text-slate-500 text-xs truncate font-medium flex items-center gap-1">
          {song.artist}
        </p>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-slate-500 text-xs">
           <div className="flex items-center gap-1 hover:text-red-400 transition-colors">
              <Heart className="w-3.5 h-3.5" /> 0
           </div>
        </div>
      </div>
    </div>
  );
};

export default SongCard;