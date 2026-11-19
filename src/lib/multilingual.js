// Convention: lyrics_chinese is the ORIGINAL performed lyric (name is legacy), lyrics_english is
// its English rendering. A line originally sung in English is stored identically in both columns
// so the columns stay line-aligned, and the UI shows it once.

/**
 * True when the English line is just the original line again. Exact equality after trimming
 * surrounding whitespace only: no case folding, no punctuation stripping, no fuzzy matching.
 */
export const repeatsOriginal = (original, translation) =>
  typeof original === 'string' && typeof translation === 'string'
  && original.trim() !== '' && original.trim() === translation.trim();

// Plain printable ASCII plus typographic quotes/dashes/ellipsis. Anything else (Han, kana, hangul,
// accents, tone marks) is not "clearly English", so it is never copied automatically.
const PLAIN_ENGLISH = /^[\x20-\x7E\u2018\u2019\u201C\u201D\u2013\u2014\u2026]+$/;

/** Conservative: only a purely English-looking line qualifies for being copied into the English column. */
export const isPlainEnglishLine = text =>
  typeof text === 'string' && PLAIN_ENGLISH.test(text.trim()) && /[A-Za-z]/.test(text);

/**
 * Display-only dedupe: for each run of consecutive rows with the same nonempty English,
 * keep it on the first row and blank the rest. A row with no English (blank separator or
 * missing translation) ends the run, so a repeat in a later section still shows.
 */
export function dedupeAdjacentEnglish(english) {
  let previous = '';
  return english.map(text => {
    const key = text.trim();
    const repeat = key !== '' && key === previous;
    previous = key;
    return repeat ? '' : text;
  });
}
