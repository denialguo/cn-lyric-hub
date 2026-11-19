const clean = value => typeof value === 'string' ? value.trim() : '';

/**
 * Preserve artist identity and bilingual names exactly as selected on Add Song.
 * The legacy artist_en/artist_zh columns are display strings and are lossy when
 * only some artists have Chinese names, so review reconstruction must not depend
 * on them for new submissions.
 */
export function serializeSubmissionArtists(artists = []) {
  return artists.map((artist) => {
    const id = artist?.isNew ? null : (artist?.id || null);
    return {
      id,
      name_en: clean(artist?.name_en),
      name_zh: clean(artist?.name_zh),
      isNew: !id,
    };
  }).filter((artist) => artist.name_en || artist.name_zh);
}

/**
 * Conservative fallback for submissions created before artist_data existed.
 * If the flattened English and Chinese lists have different lengths, their
 * positions are ambiguous. Existing artist rows may safely restore names;
 * otherwise leave the Chinese name blank rather than attach it to the wrong
 * person.
 */
export function legacySubmissionArtists(song = {}, foundArtists = []) {
  const englishNames = clean(song.artist_en).split(',').map(clean).filter(Boolean);
  const chineseNames = clean(song.artist_zh).split(',').map(clean).filter(Boolean);
  const foundByEnglish = new Map(
    foundArtists.filter((artist) => clean(artist?.name_en))
      .map((artist) => [clean(artist.name_en), artist])
  );
  const positionalChinese = englishNames.length === chineseNames.length ? chineseNames : null;

  return englishNames.map((name_en, index) => {
    const existing = foundByEnglish.get(name_en);
    if (existing) return existing;
    return {
      id: null,
      name_en,
      name_zh: positionalChinese?.[index] || '',
      isNew: true,
    };
  });
}

export function submissionArtists(song = {}, foundArtists = []) {
  if (Array.isArray(song.artist_data) && song.artist_data.length > 0) {
    return serializeSubmissionArtists(song.artist_data);
  }
  return legacySubmissionArtists(song, foundArtists);
}
