import React, { useMemo } from 'react';
import { pinyin as getPinyin } from 'pinyin-pro';

const isChinese = (char) => /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(char);
const cleanToken = (t) => t.replace(/[,.\-!?;:，。！？、；：()（）""''「」…~·]/g, '').trim();

const LyricLine = ({ 
  index, 
  originalText, 
  pinyin,
  translatedText, 
  isActive, 
  fontSettings = { pinyin: 1, zh: 3, en: 2 },
  lyricColors = { pinyin: 'default', hanzi: 'default', english: 'default' },
  onClick 
}) => {

  // 7 steps (0-6): each row scales independently
  const zhSizes =     ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-6xl'];
  const enSizes =     ['text-[10px]', 'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
  const rtSizes =     ['text-[6px]', 'text-[8px]', 'text-[10px]', 'text-xs', 'text-sm', 'text-base', 'text-lg'];

  const zhClass = zhSizes[fontSettings.zh] || 'text-2xl';
  const enClass = enSizes[fontSettings.en] || 'text-sm';
  const rtClass = rtSizes[fontSettings.pinyin] || 'text-[10px]';
  const showPinyin = fontSettings.pinyin >= 0;

  const pinyinColor = lyricColors.pinyin !== 'default' ? lyricColors.pinyin : null;
  const hanziColor = lyricColors.hanzi !== 'default' ? lyricColors.hanzi : null;
  const englishColor = lyricColors.english !== 'default' ? lyricColors.english : null;

  const rubyElements = useMemo(() => {
    if (!originalText) return null;

    const chars = [...originalText];
    const chineseChars = chars.filter(isChinese);

    let syllables = null;
    if (pinyin) {
      const tokens = pinyin.split(/\s+/).map(cleanToken).filter(Boolean);
      if (tokens.length === chineseChars.length) {
        syllables = tokens;
      }
    }

    let syllableIndex = 0;

    return chars.map((char, i) => {
      if (isChinese(char)) {
        const py = syllables
          ? syllables[syllableIndex++]
          : getPinyin(char, { toneType: 'symbol' });

        return (
          <ruby key={i}>
            {char}
            {showPinyin && (
              <rt 
                className={`${rtClass} font-normal tracking-wide ${pinyinColor ? '' : 'text-slate-500'}`}
                style={{ color: pinyinColor || undefined }}
              >
                {py}
              </rt>
            )}
          </ruby>
        );
      }
      return <span key={i} className="inline">{char}</span>;
    });
  }, [originalText, pinyin, rtClass, showPinyin, pinyinColor]);

  const zhDefaultClass = isActive ? 'text-primary' : 'text-slate-200';
  
  // Check if line has any Chinese characters
  const hasChinese = originalText && /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(originalText);
  // Latin-only lines use a smaller, more natural size
  const latinOnlyClass = enSizes[Math.min(fontSettings.zh, 4)] || 'text-base';

  return (
    <div 
      onClick={() => onClick(index)}
      className={`p-4 rounded-xl transition-all duration-300 cursor-pointer border hover:border-slate-700 ${
        isActive 
          ? 'bg-slate-800/80 border-primary/50 shadow-lg scale-[1.02]' 
          : 'bg-transparent border-transparent hover:bg-slate-900/50'
      }`}
    >
      {/* CHINESE WITH RUBY PINYIN (or Latin-only line) */}
      <div 
        className={`${hasChinese ? zhClass : latinOnlyClass} font-medium mb-2 transition-[font-size,colors] duration-200 leading-relaxed ${
          hanziColor ? '' : (hasChinese ? zhDefaultClass : (isActive ? 'text-primary' : 'text-slate-400 italic'))
        }`}
        style={hanziColor ? { color: hanziColor } : undefined}
      >
        {hasChinese ? rubyElements : originalText}
      </div>

      {/* ENGLISH — only show when there's actually a translation */}
      {translatedText && (
        <div 
          className={`${enClass} leading-relaxed transition-[font-size] duration-200 ${
            englishColor ? '' : 'text-slate-400'
          }`}
          style={englishColor ? { color: englishColor } : undefined}
        >
          {translatedText}
        </div>
      )}
    </div>
  );
};

export default LyricLine;