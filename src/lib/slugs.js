// Public song slugs: /song/{primary-artist}-{romanized-title}. The persisted songs.slug is the
// authority; this module is only the default generator plus the redirect builder. It takes an
// already-romanized title, so no Japanese/Korean tooling ever reaches the bundle.
export const MAX_SLUG = 70;
const VALID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const isValidSlug = slug => typeof slug === 'string' && VALID.test(slug);

export const slugify = text => String(text ?? '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[.'’]/g, '')            // G.E.M. -> gem, Mother's -> mothers
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** "Silence Wang, By2" / "A feat. B" / "A & B" -> the first artist only. */
export const primaryArtist = name => String(name ?? '').split(/\s*(?:feat\.?|ft\.?|&|\/|,|、|\band\b)\s*/i)[0];

const KANA = /[\u3040-\u30ff]/, HANGUL = /[\uac00-\ud7af]/, LATIN = /^[\u0020-\u007E\u00C0-\u024F\s]+$/;
/** Language of the title string, for romanization only: not the song's or lyrics' language. */
export const titleLanguage = title => !title ? 'zh' : KANA.test(title) ? 'ja' : HANGUL.test(title) ? 'ko' : LATIN.test(title) ? 'en' : 'zh';

/**
 * Romanize a title: zh -> toneless pinyin, en -> as written. ja/ko need tooling the browser doesn't ship,
 * so they come from `tools` ({ ja, ko }: title -> romanized) and are '' when absent (-> artist-song fallback).
 */
export async function romanizeTitle(title, language, tools = {}) {
  if (!title) return '';
  if (language === 'en') return title;
  if (language === 'zh') return (await import('../utils/lyrics.js')).romanizeHan(title);
  return tools[language] ? tools[language](title) : '';
}

/** Default slug for one song, before collision handling. */
export function baseSlug({ artist, title, id }) {
  const a = slugify(primaryArtist(artist)) || 'unknown';
  // "(live) - live" would otherwise read live-live
  let words = slugify(title).split('-').filter((w, i, all) => w && w !== all[i - 1]);
  const room = MAX_SLUG - a.length - 1;
  while (words.length && words.join('-').length > room) words.pop(); // cut the title only, on a word boundary
  return words.length ? `${a}-${words.join('-')}` : id === undefined ? `${a}-song` : `${a}-song-${id}`;
}

/**
 * Slugs for a whole catalogue. `overrides` ({id: slug}) are authoritative and reserved first.
 * Remaining collisions: the lowest id keeps the bare slug, the rest get -{id}.
 * Returns Map(id -> { slug, source: 'override' | 'generated', collided })
 */
export function assignSlugs(rows, overrides = {}) {
  const out = new Map();
  const taken = new Set();
  for (const row of rows) {
    const slug = overrides[row.id];
    if (slug === undefined) continue;
    if (!isValidSlug(slug)) throw new Error(`Override for #${row.id} is not a valid slug: ${slug}`);
    if (taken.has(slug)) throw new Error(`Two overrides use the slug ${slug}`);
    taken.add(slug);
    out.set(row.id, { slug, source: 'override', collided: false });
  }
  const groups = new Map();
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    if (out.has(row.id)) continue;
    const base = baseSlug(row);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(row);
  }
  for (const [base, group] of groups) {
    group.forEach((row, i) => {
      const bare = i === 0 && !taken.has(base);
      const slug = bare ? base : `${base}-${row.id}`;
      taken.add(slug);
      out.set(row.id, { slug, source: 'generated', collided: !bare });
    });
  }
  return out;
}

/** First free slug: base, then base-2, base-3 ... `isTaken` is async (songs and slug aliases). */
export async function uniqueSlug(base, isTaken) {
  if (!(await isTaken(base))) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`No free slug for ${base}`);
}

/** Slug for a song that does not exist yet (the submit form). Existing songs keep their slug forever. */
export async function newSongSlug({ artist, titleEn, titleZh, isTaken, tools }) {
  const original = (titleEn || titleZh || '').normalize('NFC').trim();
  const title = await romanizeTitle(original, titleLanguage(original), tools);
  return uniqueSlug(baseSlug({ artist, title }), isTaken);
}

/** Vercel redirects for alias rows [{ old_slug, songs: { slug } }]; one hop, never a chain. */
export function buildRedirects(aliases) {
  return aliases
    .filter(a => a.old_slug && a.songs?.slug && a.old_slug !== a.songs.slug)
    .map(a => ({ source: `/song/${a.old_slug}`, destination: `/song/${a.songs.slug}`, permanent: true }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

/** Everything that must hold before slugs are written. Returns a list of problems (empty = safe). */
export function validateSlugMap(map, songs, { checkLength = true } = {}) {
  const problems = [];
  const current = new Map(songs.map(s => [s.id, s.slug]));
  const seen = new Map();
  for (const m of map) {
    if (!current.has(m.id)) { problems.push(`#${m.id}: no such song`); continue; }
    if (!isValidSlug(m.new)) problems.push(`#${m.id}: invalid slug ${m.new}`);
    if (checkLength && m.new.length > MAX_SLUG + String(m.id).length + 1) problems.push(`#${m.id}: slug too long (${m.new.length})`);
    if (current.get(m.id) !== m.old && current.get(m.id) !== m.new) problems.push(`#${m.id}: current slug ${current.get(m.id)} is neither old nor new`);
    if (seen.has(m.new)) problems.push(`#${m.id}: slug ${m.new} also used by #${seen.get(m.new)}`);
    seen.set(m.new, m.id);
  }
  const moving = new Set(map.map(m => m.id));
  for (const s of songs) {
    if (!moving.has(s.id) && seen.has(s.slug)) problems.push(`#${seen.get(s.slug)}: slug ${s.slug} already belongs to untouched #${s.id}`);
  }
  return problems;
}
