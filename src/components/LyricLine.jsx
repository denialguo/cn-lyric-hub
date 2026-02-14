import React from 'react';

const LyricLine = ({ 
  index, 
  originalText, 
  pinyin,
  translatedText, 
  isActive, 
  fontSettings = { pinyin: 1, zh: 2, en: 1 }, // Default fallback
  onClick 
}) => {

  // Map 0-4 to Tailwind classes
  const pinyinSizes = ['text-[10px]', 'text-xs', 'text-sm', 'text-base', 'text-lg'];
  const zhSizes = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
  const enSizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl'];

  // Calculate actual classes
  const pinyinClass = pinyinSizes[fontSettings.pinyin] || 'text-xs';
  const zhClass = zhSizes[fontSettings.zh] || 'text-2xl';
  const enClass = enSizes[fontSettings.en] || 'text-base';

  return (
    <div 
      onClick={() => onClick(index)}
      className={`p-4 rounded-xl transition-all duration-300 cursor-pointer border hover:border-slate-700 ${
        isActive 
          ? 'bg-slate-800/80 border-primary/50 shadow-lg scale-[1.02]' 
          : 'bg-transparent border-transparent hover:bg-slate-900/50'
      }`}
    >
      {/* 1. PINYIN ROW */}
      {pinyin && (
        <div className={`${pinyinClass} text-slate-500 font-mono mb-1 tracking-wide transition-[font-size] duration-200`}>
          {pinyin}
        </div>
      )}

      {/* 2. CHINESE ROW */}
      <div className={`${zhClass} font-medium mb-2 transition-[font-size,colors] duration-200 ${
        isActive ? 'text-primary' : 'text-slate-200'
      }`}>
        {originalText}
      </div>

      {/* 3. ENGLISH ROW */}
      <div className={`${enClass} text-slate-400 leading-relaxed transition-[font-size] duration-200`}>
        {translatedText || <span className="italic text-slate-600">No translation available</span>}
      </div>
    </div>
  );
};

export default LyricLine;