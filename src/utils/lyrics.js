// \p{Script=Han} covers every CJK block including Ext-B and beyond, which the
// old hand-rolled BMP ranges missed. It excludes kana, hangul, bopomofo and
// fullwidth punctuation, which is exactly what we want.
const HAN_CHAR = /\p{Script=Han}/u;
const HAN_RUN = /\p{Script=Han}+/u;

// Anything that can sit between two syllables in a generated pinyin line.
// Splitting on these (rather than whitespace alone) is what stops "nǎ，shān"
// from being read as a single syllable.
const SYLLABLE_SEP = /[\s,.!?;:'"~·\-—…/\\*()[\]{}，。！？、；：（）「」『』《》【】“”‘’]+/u;

// Bopomofo (+ extended) with 一 only when touching it, so ordinary 一 (一个) is untouched.
const ZHUYIN_SPAN = /([\u3100-\u312F\u31A0-\u31BF]+(?:一[\u3100-\u312F\u31A0-\u31BF]*)*|一[\u3100-\u312F\u31A0-\u31BF]+)/u;

export const isChinese = (char) => HAN_CHAR.test(char);

export async function generatePinyin(lyricsText) {
  if (!lyricsText) return '';
  const { pinyin } = await import('pinyin-pro');
  return lyricsText.split('\n').map((line) => {
    if (!line.trim()) return '';
    const cleanLine = line
      .replace(/，/g, ',').replace(/。/g, '.').replace(/！/g, '!')
      .replace(/？/g, '?').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
    // Keep the separators (capture group) and only romanize the Han runs, so
    // Latin words and numbers pass through untouched. Passing a whole run —
    // not single characters — is what lets pinyin-pro resolve polyphones by
    // word context: 音乐 -> "yīn yuè", never "yīn lè".
    // Zhuyin solfège (ㄒ一ㄌㄚ) uses Han 一 as the vowel ㄧ; keep those spans verbatim.
    return cleanLine.split(ZHUYIN_SPAN).map((part, i) => {
      if (i % 2) return part;
      return part.split(/(\p{Script=Han}+)/gu).map(segment =>
        HAN_CHAR.test(segment) ? pinyin(segment, { toneType: 'symbol' }) : segment).join('');
    }).join('');
  }).join('\n');
}

/**
 * Map a stored pinyin line onto the Han characters of its lyric line.
 * Returns one syllable per Han character, or null when they can't be matched
 * and the caller should fall back to per-character generation.
 */
export function alignSyllables(originalText, pinyinLine) {
  if (!originalText || !pinyinLine) return null;

  const hanziCount = [...originalText].filter(isChinese).length;
  if (!hanziCount) return null;

  // generatePinyin copies non-Han segments through verbatim, so an English
  // word in the lyric is still sitting in the pinyin line. Remove those before
  // counting or "Baby bié kū" reads as 3 syllables against 2 characters.
  let rest = pinyinLine;
  for (const run of originalText.split(HAN_RUN)) {
    const literal = run.trim();
    if (literal) rest = rest.replace(literal, ' ');
  }

  const syllables = rest.split(SYLLABLE_SEP).filter(Boolean);
  return syllables.length === hanziCount ? syllables : null;
}

// Rendering fallback only; generation at ingest still uses whole Han runs.
export async function generateCharacterPinyin(text) {
  const { pinyin } = await import('pinyin-pro');
  return [...text].filter(isChinese).map(char => pinyin(char, { toneType: 'symbol' }));
}

// Toneless, hyphen-separated pinyin of a title, for URL slugs (src/lib/slugs.js).
export async function romanizeHan(text) {
  const { pinyin } = await import('pinyin-pro');
  return pinyin(text, { toneType: 'none', nonZh: 'consecutive', separator: '-' });
}
