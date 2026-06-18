import { pinyin } from 'pinyin-pro';

const CHINESE_REGEX = /[一-鿿㐀-䶿豈-﫿]/;

export const isChinese = (char) => CHINESE_REGEX.test(char);

export function generatePinyin(lyricsText) {
  if (!lyricsText) return '';
  return lyricsText.split('\n').map((line) => {
    if (!line.trim()) return '';
    const cleanLine = line
      .replace(/，/g, ',').replace(/。/g, '.').replace(/！/g, '!')
      .replace(/？/g, '?').replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
    return cleanLine.split(/([一-鿿㐀-䶿豈-﫿]+)/g).map(segment => {
      if (CHINESE_REGEX.test(segment)) {
        return pinyin(segment, { toneType: 'symbol' });
      }
      return segment;
    }).join('');
  }).join('\n');
}
