import { supabase } from './supabaseClient';
import { sify, tify } from 'chinese-conv';

/**
 * The shared data-access seam.
 *
 * Before this file, `supabase` was imported into 15 components and each one
 * independently re-decided whether to sanitise user input, whether to page past
 * the 1000-row cap, and whether to check `error`. The search sanitiser existed in
 * HomePage only, so ArtistPage and ArtistSearch would 400 on a name containing a
 * comma or bracket. Queries that belong to more than one caller live here now.
 */

/** PostgREST returns at most 1000 rows per request, whatever you ask for. */
export const PAGE_CAP = 1000;

/** The columns the song grid needs — never the heavy lyrics blobs. */
export const CARD_COLUMNS =
  'id, slug, title_zh, title_en, cover_url, artist_en, artist_zh, tags, source, created_at, song_likes(count)';

/**
 * Make a value safe to embed in a PostgREST `or=` filter.
 *
 * That filter is a mini-language: `,` separates conditions, `.` separates
 * column.operator.value, `()` groups, and `%` is the LIKE wildcard. Interpolating
 * raw user input lets a typed comma rewrite the filter tree — at best a 400 that
 * shows "no results", at worst a filter the caller never intended. Artist names
 * like "S.H.E" and "Jay Chou, Jr." hit this in normal use.
 */
export const sanitizeFilterValue = (value) => String(value ?? '').replace(/[,%().\\]/g, ' ').trim();

/**
 * Build an `or=` clause matching a term against English and Chinese name columns.
 * The DB stores one script form (mostly Simplified), so Chinese columns are matched
 * against both conversions of whatever was typed.
 */
export function buildNameFilter(term, { enColumns, zhColumns }) {
  const safe = sanitizeFilterValue(term);
  if (!safe) return null;

  const variants = [...new Set([safe, sify(safe), tify(safe)])];
  return [
    ...enColumns.map((c) => `${c}.ilike.%${safe}%`),
    ...zhColumns.flatMap((c) => variants.map((v) => `${c}.ilike.%${v}%`)),
  ].join(',');
}

/** Search the whole catalogue, imports included. Returns [] on failure, never throws. */
export async function searchSongs(term, { page = 0, pageSize = 36 } = {}) {
  const filter = buildNameFilter(term, {
    enColumns: ['title_en', 'artist_en'],
    zhColumns: ['title_zh', 'artist_zh'],
  });
  if (!filter) return { songs: [], hasMore: false };

  const limit = (page + 1) * pageSize;
  const { data, error } = await supabase
    .from('songs')
    .select(CARD_COLUMNS)
    .or(filter)
    // Recently-edited first so freshly-curated songs surface above import order
    .order('updated_at', { ascending: false })
    .range(0, limit - 1);

  if (error) {
    console.error('searchSongs failed:', error.message);
    return { songs: [], hasMore: false, error };
  }
  return { songs: data || [], hasMore: (data || []).length === limit };
}

/** The full catalogue, gated on completeness (listed OR has a cover). */
export async function listSongs({ page = 0, pageSize = 36 } = {}) {
  const limit = (page + 1) * pageSize;
  const { data, error } = await supabase
    .from('songs')
    .select(CARD_COLUMNS)
    .or('source.eq.user,cover_url.neq.""')
    .order('created_at', { ascending: false })
    .range(0, limit - 1);

  if (error) {
    console.error('listSongs failed:', error.message);
    return { songs: [], hasMore: false, error };
  }
  return { songs: data || [], hasMore: (data || []).length === limit };
}

/** Exact artist lookup, with legacy name fallback until the reconciliation migration is applied. */
export async function songsByArtist(artistName) {
  const name = String(artistName ?? '').trim();
  if (!name) return { songs: [], names: [] };

  // Quote filter values instead of stripping punctuation from names like G.E.M.
  const variants = [...new Set([name, sify(name), tify(name)])];
  const filter = [
    ...['name_en', 'name_zh'].flatMap(column => variants.map(value => `${column}.eq.${JSON.stringify(value)}`)),
    `slug.eq.${JSON.stringify(name.toLowerCase().replace(/\s+/g, '-'))}`,
  ].join(',');
  const { data: matched, error: artistError } = await supabase.from('artists')
    .select('id, name_en, name_zh').or(filter).limit(1).maybeSingle();
  if (artistError) return { songs: [], names: [], error: artistError };
  if (matched) {
    const { data: links, error } = await supabase.from('song_artists')
      .select(`songs(${CARD_COLUMNS})`).eq('artist_id', matched.id);
    if (error) return { songs: [], names: [], error };
    const songs = (links || []).map(link => link.songs).filter(Boolean);
    songs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { songs, names: [matched.name_en, matched.name_zh].filter(Boolean) };
  }

  // ponytail: remove this fallback AFTER artist reconciliation and the index are applied.
  // 2. Fall back to name matching across both scripts.
  const fallbackFilter = buildNameFilter(name, { enColumns: ['artist_en'], zhColumns: ['artist_zh'] });
  if (!fallbackFilter) return { songs: [], names: [] };

  const { data, error } = await supabase
    .from('songs')
    .select(CARD_COLUMNS)
    .or(fallbackFilter)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('songsByArtist failed:', error.message);
    return { songs: [], names: [], error };
  }

  const names = new Set();
  for (const song of data || []) {
    for (const col of [song.artist_en, song.artist_zh]) {
      for (const n of (col || '').split(',')) {
        const t = n.trim();
        if (t) names.add(t);
      }
    }
  }
  return { songs: data || [], names: [...names] };
}

/**
 * Most-liked songs.
 *
 * HomePage used to `select('song_id')` with no filter, pulling every like row on
 * the site and silently truncating at 1000. This pages properly and only fetches
 * the songs that actually placed.
 *
 * ponytail: O(all likes) by design. Fine at this size; when likes outgrow a few
 * thousand rows this wants a materialised view or an RPC that returns the top N.
 */
export async function trendingSongs({ limit = 36 } = {}) {
  const likes = await fetchAllRows('song_likes', 'song_id');
  if (!likes.length) return { songs: [], hasMore: false };

  const counts = new Map();
  for (const { song_id } of likes) counts.set(song_id, (counts.get(song_id) || 0) + 1);

  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const { data, error } = await supabase.from('songs').select(CARD_COLUMNS).in('id', topIds);
  if (error) {
    console.error('trendingSongs failed:', error.message);
    return { songs: [], hasMore: false, error };
  }
  // Preserve the like-count ordering the ids were chosen in.
  const order = new Map(topIds.map((id, i) => [id, i]));
  const songs = (data || []).sort((a, b) => order.get(a.id) - order.get(b.id));
  return { songs, hasMore: false };
}

/** Most recently added songs. */
export async function freshSongs({ page = 0, pageSize = 36 } = {}) {
  const limit = (page + 1) * pageSize;
  const { data, error } = await supabase
    .from('songs')
    .select(CARD_COLUMNS)
    .or('source.eq.user,cover_url.neq.""')
    .order('created_at', { ascending: false })
    .range(0, limit - 1);

  if (error) {
    console.error('freshSongs failed:', error.message);
    return { songs: [], hasMore: false, error };
  }
  return { songs: data || [], hasMore: (data || []).length === limit };
}

/**
 * Older material. This used to filter on tags, but only 4 songs in the whole
 * catalogue carry any tag, so the Classics tab rendered zero cards. `year` is
 * populated for ~320 songs, which is thin but real — pre-2000 gives ~112.
 */
export async function classicSongs({ page = 0, pageSize = 36 } = {}) {
  const limit = (page + 1) * pageSize;
  const { data, error } = await supabase
    .from('songs')
    .select(CARD_COLUMNS)
    .lt('year', 2000)
    .order('year', { ascending: true })
    .range(0, limit - 1);

  if (error) {
    console.error('classicSongs failed:', error.message);
    return { songs: [], hasMore: false, error };
  }
  return { songs: data || [], hasMore: (data || []).length === limit };
}

/** Artist typeahead for the submission form. */
export async function searchArtists(term, { limit = 5 } = {}) {
  const filter = buildNameFilter(term, { enColumns: ['name_en'], zhColumns: ['name_zh'] });
  if (!filter) return [];

  const { data, error } = await supabase.from('artists').select('*').or(filter).limit(limit);
  if (error) {
    console.error('searchArtists failed:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Every row of a table, paged past the 1000-row cap.
 * StatsPage silently analysed 1000 of 1608 songs without this.
 */
export async function fetchAllRows(table, select, { pageSize = PAGE_CAP, max = 100000 } = {}) {
  let all = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) {
      console.error(`fetchAllRows(${table}) failed:`, error.message);
      break;
    }
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  return all;
}

/** Song ids the given user has liked. Scoped to one user — never the whole table. */
export async function likedSongIds(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabase.from('song_likes').select('song_id').eq('user_id', userId);
  if (error) {
    console.error('likedSongIds failed:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.song_id));
}
