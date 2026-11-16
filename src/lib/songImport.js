// Pure helpers for "Import JSON" on AddSongPage. They only turn pasted JSON into form
// values; validation, pinyin alignment and submission stay with the existing form.

// One definition of the form's fields, so imports can't produce keys the insert doesn't have.
export const EMPTY_FORM = {
  title_zh: '', title_en: '', cover_url: '', youtube_url: '',
  lyrics_chinese: '', lyrics_pinyin: '', lyrics_english: '', bio: '', credits: '', year: '',
};

const OPTIONAL = ['album', 'release_date', 'featured_artists', 'lyricist', 'composer'];
const isText = value => typeof value === 'string' && value.trim() !== '';
const oneLine = value => value.replace(/\s*[\r\n]+\s*/g, ' ').trim();
const fail = error => ({ ok: false, error });

/** Strictly parse and validate pasted JSON. Returns { ok, song } or { ok: false, error }. */
export function parseSongJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    const multiple = /}\s*{/.test(String(text));
    return fail(multiple
      ? 'Paste exactly one JSON object. It looks like there is more than one, or extra text after the first.'
      : `That isn't valid JSON (${error.message}).`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('The JSON must be a single object, like { "title": …, "artist": …, "lines": […] }.');
  if (!isText(data.title)) return fail('"title" must be a non-empty string.');
  if (!isText(data.artist)) return fail('"artist" must be a non-empty string.');
  if (!Array.isArray(data.lines) || data.lines.length === 0) return fail('"lines" must be a non-empty array.');
  for (const key of OPTIONAL) {
    if (data[key] != null && typeof data[key] !== 'string') return fail(`"${key}" must be a string or null.`);
  }
  const lines = [];
  for (const [index, line] of data.lines.entries()) {
    const at = `Line ${index + 1}`;
    if (!line || typeof line !== 'object' || Array.isArray(line)) return fail(`${at} must be an object.`);
    if (!isText(line.original)) return fail(`${at} needs a non-empty "original" string.`);
    for (const key of ['pinyin', 'translation']) {
      if (line[key] != null && typeof line[key] !== 'string') return fail(`${at}: "${key}" must be a string or null.`);
    }
    lines.push({ original: oneLine(line.original), pinyin: oneLine(line.pinyin ?? ''), translation: oneLine(line.translation ?? '') });
  }
  const song = { title: data.title.trim(), artist: data.artist.trim(), lines };
  for (const key of OPTIONAL) song[key] = isText(data[key]) ? data[key].trim() : null;
  return { ok: true, song };
}

const CJK = /[㐀-鿿豈-﫿]+/g;

/** "Kang Xi 康熙, Other" → artist objects in the shape ArtistSearch produces for a new artist. */
export function artistsFrom(text) {
  return text.split(/[,，、]/).map(name => name.trim()).filter(Boolean).map(name => ({
    id: null,
    name_en: name.replace(CJK, '').replace(/\s+/g, ' ').trim() || name,
    name_zh: (name.match(CJK) || []).join(''),
    isNew: true,
  }));
}

/** Map a validated song onto the form. Only fields the import supplies are returned. */
export function songToForm(song) {
  const patch = {
    title_zh: song.title,
    lyrics_chinese: song.lines.map(line => line.original).join('\n'),
    // Parallel columns must stay line-for-line; absent values become empty lines.
    lyrics_pinyin: song.lines.some(line => line.pinyin) ? song.lines.map(line => line.pinyin).join('\n') : '',
    lyrics_english: song.lines.some(line => line.translation) ? song.lines.map(line => line.translation).join('\n') : '',
  };
  const year = song.release_date?.match(/\b(?:19|20)\d{2}\b/)?.[0];
  if (year) patch.year = year;
  const credits = [
    song.album && `Album: ${song.album}`,
    song.release_date && !year && `Released: ${song.release_date}`,
    song.featured_artists && `Featured: ${song.featured_artists}`,
    song.lyricist && `Lyrics by ${song.lyricist}`,
    song.composer && `Composed by ${song.composer}`,
  ].filter(Boolean).join('\n');
  if (credits) patch.credits = credits;
  return { patch, artists: artistsFrom(song.artist) };
}
