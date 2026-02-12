import React from 'react';

const LyricLine = ({ 
  originalText, 
  translatedText, // This is the 'active' text (could be original or user-selected)
  index, 
  isActive,       // Is this line currently selected?
  hasOptions,     // Does this line have community translations?
  onClick 
}) => {
  return (
    <div 
      onClick={() => onClick(index)}
      className={`
        relative p-4 rounded-xl cursor-pointer transition-all border
        ${isActive 
          ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]' 
          : 'bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-700'
        }
      `}
    >
      {/* 1. Main Text (Large) */}
      <p className="text-2xl md:text-3xl font-bold text-slate-100 mb-2 leading-relaxed">
         {originalText}
      </p>

      {/* 2. Subtext (English/Translation) */}
      <p className={`text-lg italic transition-colors ${isActive ? 'text-primary' : 'text-slate-500'}`}>
         {translatedText || "No translation available"}
      </p>

      {/* 3. Indicator: "Has Community Edits" */}
      {hasOptions && !isActive && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
      )}
    </div>
  );
};

export default LyricLine;