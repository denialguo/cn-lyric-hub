/**
 * The one place that decides page titles and descriptions. Imported by the React
 * pages (Helmet) AND scripts/prerender.cjs, so the static HTML and the hydrated
 * head cannot drift into different templates.
 */
export const SITE_NAME = 'CN Lyrics';
export const withSite = title => `${title} | ${SITE_NAME}`;

export const HOME_TITLE = `${SITE_NAME} — Chinese Lyrics with Pinyin`;
export const HOME_DESCRIPTION =
  'Read Chinese song lyrics with character-by-character pinyin, Simplified/Traditional text, and English translations. Find songs by title or artist.';

// Plain-text page metadata for the static pages (title is the page name only).
export const STATIC_PAGES = {
  faq: {
    name: 'FAQ',
    description: 'How pinyin works, switching between Simplified and Traditional, translations, adding songs, and DMCA takedown requests.',
  },
  stats: {
    name: 'Chinese Lyrics Statistics',
    description: 'Character frequency, tone distribution, rhyme patterns and vocabulary diversity across the Chinese lyrics on CN Lyrics.',
  },
  privacy: {
    name: 'Privacy Policy',
    description: 'What data CN Lyrics collects, how it is stored, and how to have it deleted. No ads, no data sales, no advertising trackers.',
  },
  terms: {
    name: 'Terms of Service',
    description: 'The terms for using CN Lyrics: contributed translations and comments, acceptable use, content moderation, and the absence of any warranty.',
  },
};

export const staticMeta = key => ({ title: withSite(STATIC_PAGES[key].name), description: STATIC_PAGES[key].description });

export const songNames = song => ({
  title: song.title_zh || song.title_en || 'Untitled',
  artist: song.artist_en || song.artist_zh || 'Unknown',
});

export function songMeta(song) {
  const { title, artist } = songNames(song);
  const lines = (song.lyrics_chinese || '').split('\n');
  const hasTranslation = (song.lyrics_english || '').split('\n').some(line => line.trim());
  const firstLine = (lines.find(line => line.trim()) || '').trim();
  return {
    hasTranslation,
    title: hasTranslation
      ? `${title} Lyrics, Pinyin & Translation — ${artist} | ${SITE_NAME}`
      : `${title} Lyrics & Pinyin — ${artist} | ${SITE_NAME}`,
    description: `${title} by ${artist} — Chinese lyrics with character-by-character pinyin` +
      (hasTranslation ? ' and English translation' : '') +
      (song.year ? `. Released ${song.year}` : '') +
      (firstLine ? `. Opens with "${firstLine}".` : '.'),
  };
}

export const artistMeta = name => ({
  title: `${name} Lyrics & Pinyin | ${SITE_NAME}`,
  description: `Chinese song lyrics by ${name}, with character-by-character pinyin and English translations where available.`,
});

export const websiteJsonLd = origin => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: new URL(origin).host,
  url: `${origin}/`,
});
