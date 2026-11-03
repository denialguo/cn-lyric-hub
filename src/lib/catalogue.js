export const CATALOGUE_PAGE_SIZE = 100;
export const songDirectoryPath = page => page === 1 ? '/songs' : `/songs/${page}`;

// Keep the build and client navigation on the same ordering and page boundaries.
export function buildCatalogue(rows) {
  const songs = rows.filter(song => song.slug).map(song => ({
    href: `/song/${encodeURIComponent(song.slug)}`,
    label: song.title_zh || song.title_en || 'Untitled',
    detail: song.artist_en || song.artist_zh || '',
  }));
  const counts = new Map();
  for (const song of rows.filter(song => song.slug)) {
    const names = new Set([song.artist_en, song.artist_zh].flatMap(value =>
      (value || '').split(',').map(name => name.trim()).filter(Boolean)));
    for (const name of names) {
      if (/[/\\:*?"<>|]/.test(name)) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  const artists = [...counts].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, count]) => ({
    href: `/artist/${encodeURIComponent(name)}`, label: name,
    detail: `${count} ${count === 1 ? 'song' : 'songs'}`, count,
  }));
  return { songs, artists };
}

export function cataloguePage(catalogue, kind, page = 1) {
  if (kind === 'home') return {
    songs: catalogue.songs.slice(0, 6),
    artists: [...catalogue.artists].sort((a, b) => b.count - a.count).slice(0, 6),
  };
  if (kind === 'artists') return {
    path: '/artists', title: 'Artist Directory',
    description: 'Browse Chinese music artists and explore their song lyrics with Pinyin and community translations.',
    items: catalogue.artists,
  };
  const pages = Math.max(1, Math.ceil(catalogue.songs.length / CATALOGUE_PAGE_SIZE));
  if (!Number.isSafeInteger(page) || page < 1 || page > pages) return null;
  return {
    path: songDirectoryPath(page),
    title: `Song Directory${page > 1 ? ` — Page ${page}` : ''}`,
    description: `Browse all Chinese song lyrics with Pinyin and community translations. Page ${page} of ${pages}.`,
    items: catalogue.songs.slice((page - 1) * CATALOGUE_PAGE_SIZE, page * CATALOGUE_PAGE_SIZE),
    page, pages,
    previous: page > 1 ? songDirectoryPath(page - 1) : null,
    next: page < pages ? songDirectoryPath(page + 1) : null,
  };
}
