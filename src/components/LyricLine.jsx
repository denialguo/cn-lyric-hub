import React, { useMemo } from 'react';
import { pinyin as getPinyin } from 'pinyin-pro';

const isChinese = (char) => /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(char);

// Strip punctuation from a pinyin token so "nǎ," becomes "nǎ"
const cleanToken = (t) => t.replace(/[,.\-!?;:，。！？、；：()（）""''「」…~·]/g, '').trim();

const LyricLine = ({ 
  index, 
  originalText, 
  pinyin,
  translatedText, 
  isActive, 
  fontSettings = { pinyin: 1, zh: 2, en: 1 },
  onClick 
}) => {

  const zhSizes = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
  const enSizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl'];
  const rtSizes = ['text-[8px]', 'text-[10px]', 'text-xs', 'text-sm', 'text-base'];

  const zhClass = zhSizes[fontSettings.zh] || 'text-2xl';
  const enClass = enSizes[fontSettings.en] || 'text-base';
  const rtClass = rtSizes[fontSettings.pinyin] || 'text-xs';
  const showPinyin = fontSettings.pinyin >= 0;

  // Build ruby data: pair each Chinese character with its pinyin syllable
  const rubyElements = useMemo(() => {
    if (!originalText) return null;

    const chars = [...originalText];
    const chineseChars = chars.filter(isChinese);

    // Try to align stored pinyin to characters
    let syllables = null;
    if (pinyin) {
      const tokens = pinyin
        .split(/\s+/)
        .map(cleanToken)
        .filter(Boolean);

      // Only use stored pinyin if syllable count matches Chinese character count
      if (tokens.length === chineseChars.length) {
        syllables = tokens;
      }
    }

    let syllableIndex = 0;

    return chars.map((char, i) => {
      if (isChinese(char)) {
        // Use stored syllable if aligned, otherwise fall back to pinyin-pro
        const py = syllables
          ? syllables[syllableIndex++]
          : getPinyin(char, { toneType: 'symbol' });

        return (
          <ruby key={i}>
            {char}
            {showPinyin && (
              <rt className={`${rtClass} text-slate-500 font-normal tracking-wide`}>
                {py}
              </rt>
            )}
          </ruby>
        );
      }
      return <span key={i} className="inline">{char}</span>;
    });
  }, [originalText, pinyin, rtClass, showPinyin]);

  return (
    <div 
      onClick={() => onClick(index)}
      className={`p-4 rounded-xl transition-all duration-300 cursor-pointer border hover:border-slate-700 ${
        isActive 
          ? 'bg-slate-800/80 border-primary/50 shadow-lg scale-[1.02]' 
          : 'bg-transparent border-transparent hover:bg-slate-900/50'
      }`}
    >
      {/* CHINESE WITH RUBY PINYIN */}
      <div className={`${zhClass} font-medium mb-2 transition-[font-size,colors] duration-200 leading-relaxed ${
        isActive ? 'text-primary' : 'text-slate-200'
      }`}>
        {rubyElements}
      </div>

      {/* ENGLISH */}
      <div className={`${enClass} text-slate-400 leading-relaxed transition-[font-size] duration-200`}>
        {translatedText || <span className="italic text-slate-600">No translation available</span>}
      </div>
    </div>
  );
};

export default LyricLine;