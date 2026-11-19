// Pure helpers for scripts/audit-catalogue.cjs. Nothing here touches the network or the DB.
// Flags are the source of truth: every count, intersection and score is derived from them.
//
// Alignment reuses the one canonical pinyin module (src/utils/lyrics.js).
import { sify } from 'chinese-conv';
import { alignSyllables, isChinese } from '../utils/lyrics.js';
import { detectLyricMetadata } from './lyricMetadata.js';

export const LONG_LINE_CHARS = 150;
// Corpus lyrics have no blank lines between sections, so a verse or chorus repeated back to back
// (even 12+ lines) is ordinary. Only a text that is essentially one block pasted twice is flagged.
export const DUPLICATE_COVERAGE = 0.9;
export const MIN_DUPLICATE_BLOCK = 8;

const LRC_TIMESTAMP = /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/;
const HTML_MARKUP = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>|&(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/i;

const text = value => (typeof value === 'string' ? value : '');
const filled = value => text(value).trim() !== '';

/** The app splits on \n. Trailing blank lines are dropped so a stray final newline can't fake a count mismatch. */
export function lyricLines(value) {
  const out = text(value).replace(/\r\n?/g, '\n').split('\n');
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

const hanCount = line => [...line].filter(isChinese).length;

function hasDuplicatedBlock(lines) {
  const trimmed = lines.map(line => line.trim());
  const nonBlank = trimmed.filter(Boolean);
  const half = nonBlank.length / 2;
  if (Number.isInteger(half) && half >= MIN_DUPLICATE_BLOCK && nonBlank.slice(0, half).every((line, i) => line === nonBlank[half + i])) return true;
  for (let size = Math.floor(trimmed.length / 2); size >= MIN_DUPLICATE_BLOCK && 2 * size >= DUPLICATE_COVERAGE * trimmed.length; size--) {
    for (let start = 0; start + 2 * size <= trimmed.length; start++) {
      let same = true;
      for (let i = 0; i < size && same; i++) same = Boolean(trimmed[start + i]) && trimmed[start + i] === trimmed[start + size + i];
      if (same) return true;
    }
  }
  return false;
}

/** Suspicious formatting in one lyric column. Reports only; nothing is ever rewritten. */
export function formattingFlags(raw, { checkLongLines = false, checkDuplicates = false } = {}) {
  const value = text(raw);
  if (!value) return [];
  const flags = [];
  const crlf = /\r\n/.test(value);
  const bareLf = /(^|[^\r])\n/.test(value);
  const loneCr = /\r(?!\n)/.test(value);
  if (/\r/.test(value)) flags.push('carriage_return');
  if ((crlf && bareLf) || loneCr) flags.push('mixed_newlines');

  const all = value.replace(/\r\n?/g, '\n').split('\n');
  if (!all[0].trim()) flags.push('leading_blank_lines');
  if (all.length > 1 && !all[all.length - 1].trim()) flags.push('trailing_blank_lines');
  const body = lyricLines(value);
  while (body.length && !body[0].trim()) body.shift();
  if (/\n[ \t\u3000]*\n[ \t\u3000]*\n/.test(body.join('\n'))) flags.push('repeated_blank_lines');
  if (body.some(line => /[ \t\u3000]+$/.test(line))) flags.push('trailing_whitespace');
  if (LRC_TIMESTAMP.test(value)) flags.push('lrc_timestamp');
  if (HTML_MARKUP.test(value)) flags.push('html_markup');
  if (checkLongLines && body.some(line => line.length > LONG_LINE_CHARS)) flags.push('long_line');
  if (checkDuplicates && hasDuplicatedBlock(body)) flags.push('possible_duplicated_block');
  return flags;
}

// "píngguǒ": one token that is too long to be a single pinyin syllable (max is six letters).
const baseLetters = token => token.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
function looksWordGrouped(chineseLine, pinyinLine) {
  return pinyinLine.split(/[^\p{L}\p{M}]+/u).some(token => {
    const base = baseLetters(token);
    return base.length > 6 && /^[a-z]+$/.test(base) && !chineseLine.toLowerCase().includes(token.toLowerCase());
  });
}

/** Lyrics, pinyin and translation health for one song's three parallel columns. */
export function auditLyrics({ chinese, pinyin, english }) {
  const zh = lyricLines(chinese);
  const py = lyricLines(pinyin);
  const en = lyricLines(english);
  const flags = [];
  const counts = {
    chinese_lines: zh.length, pinyin_lines: py.length, english_lines: en.length,
    pinyin_alignment_failures: 0, word_grouped_lines: 0,
  };
  const samples = { alignment_failure_lines: [] };
  const hasLyrics = zh.some(line => line.trim());
  const hanLines = zh.filter(line => hanCount(line) > 0).length;

  let pinyinStatus;
  if (!hasLyrics) pinyinStatus = 'not_applicable';
  else if (!hanLines) pinyinStatus = 'not_applicable'; // no Han characters, nothing to romanize
  else if (!py.some(line => line.trim())) pinyinStatus = 'missing';
  else if (py.length !== zh.length) pinyinStatus = 'line_count_mismatch';
  else {
    // Index-wise alignment is only meaningful when the columns have the same length.
    zh.forEach((line, i) => {
      if (!hanCount(line) || alignSyllables(line, py[i]) !== null) return;
      counts.pinyin_alignment_failures++;
      if (samples.alignment_failure_lines.length < 5) samples.alignment_failure_lines.push(i + 1);
      if (py[i] && looksWordGrouped(line, py[i])) counts.word_grouped_lines++;
    });
    pinyinStatus = counts.pinyin_alignment_failures ? 'alignment_failures' : 'ok';
  }

  let translationStatus;
  if (!en.some(line => line.trim())) translationStatus = 'missing';
  else translationStatus = en.length === zh.length ? 'ok' : 'line_mismatch';

  if (!hasLyrics) flags.push('missing_lyrics');
  if (pinyinStatus === 'missing') flags.push('missing_pinyin');
  if (pinyinStatus === 'line_count_mismatch') flags.push('pinyin_line_count_mismatch');
  if (pinyinStatus === 'alignment_failures') flags.push('pinyin_alignment_failure');
  if (counts.word_grouped_lines) flags.push('word_grouped_pinyin');
  if (translationStatus === 'missing') flags.push('missing_translation');
  if (translationStatus === 'line_mismatch') flags.push('translation_line_mismatch');

  for (const flag of formattingFlags(chinese, { checkLongLines: true, checkDuplicates: true })) flags.push(`chinese_${flag}`);
  for (const flag of formattingFlags(pinyin)) flags.push(`pinyin_${flag}`);
  for (const flag of formattingFlags(english, { checkLongLines: true })) flags.push(`english_${flag}`);

  return { counts, samples, flags, health: { lyrics: hasLyrics, pinyin: pinyinStatus, translation: translationStatus } };
}

const normName = value => sify(String(value ?? '')).trim().toLowerCase().replace(/\s+/g, ' ');
const splitNames = value => String(value ?? '').split(/[,，、]/).map(normName).filter(Boolean);
// Substring matches ('A & B' vs 'A') need two or more characters to avoid noise; exact matches always count.
const sameName = (a, b) => a === b || (a.length > 1 && b.length > 1 && (a.includes(b) || b.includes(a)));

/**
 * Do the linked artists and the song's free-text artist fields describe the same people?
 * Collaborations legitimately carry several 'main' links (publish_song marks every artist main),
 * so link count alone proves nothing. Name overlap is the signal, and it is deliberately lenient.
 */
export function artistLinkMismatch(song, linked) {
  if (!linked.length) return false;
  const songNames = [...new Set([...splitNames(song.artist_en), ...splitNames(song.artist_zh)])];
  if (!songNames.length) return false;
  const linkedNames = linked.map(artist => [normName(artist.name_en), normName(artist.name_zh)].filter(Boolean));
  const unlinkedName = songNames.some(name => !linkedNames.some(names => names.some(other => sameName(name, other))));
  const strayLink = linkedNames.some(names => !names.some(other => songNames.some(name => sameName(name, other))));
  return unlinkedName || strayLink;
}

/** One song → its audit record. `context` carries rows from the other tables. */
export function auditSong(song, context = {}) {
  const { linkedArtists = [], contributions = {} } = context;
  const lyrics = auditLyrics({ chinese: song.lyrics_chinese, pinyin: song.lyrics_pinyin, english: song.lyrics_english });
  const flags = [...lyrics.flags];
  const sourceMetadata = detectLyricMetadata(song.lyrics_chinese, {
    title: song.title_zh || song.title_en,
    artist: song.artist_en || song.artist_zh,
  });
  if (sourceMetadata.some(issue => issue.confidence === 'high')) flags.push('suspicious_lyric_source_metadata');
  else if (sourceMetadata.length) flags.push('possible_lyric_source_metadata');
  const title = song.title_zh || song.title_en || '';
  const artist = song.artist_en || song.artist_zh || '';
  const artistMissing = !filled(song.artist_en) && !filled(song.artist_zh);
  const artistLinked = linkedArtists.length > 0;
  const linkMismatch = artistLinkMismatch(song, linkedArtists);

  if (!filled(title)) flags.push('missing_title');
  if (artistMissing || (song.artist_en === 'Unknown' && !filled(song.artist_zh))) flags.push('missing_artist');
  if (!artistLinked) flags.push('no_linked_artist');
  if (linkMismatch) flags.push('artist_link_mismatch');
  if (!filled(song.cover_url)) flags.push('missing_cover');
  if (song.year == null || song.year === '') flags.push('missing_year');
  if (!filled(song.youtube_url)) flags.push('missing_youtube');
  if (!filled(song.bio)) flags.push('missing_bio');
  if (!filled(song.credits)) flags.push('missing_credits');

  const attached = (contributions.line_translations || 0) + (contributions.line_comments || 0) + (contributions.song_comments || 0);
  const health = {
    ...lyrics.health,
    cover: filled(song.cover_url),
    year: !(song.year == null || song.year === ''),
    youtube: filled(song.youtube_url),
    artist_link: artistLinked && !linkMismatch,
  };
  const record = {
    id: song.id, slug: song.slug ?? null, title, artist,
    health, counts: lyrics.counts, samples: { ...lyrics.samples, source_metadata: sourceMetadata }, flags,
    has_user_contributions: attached > 0,
    contributions: {
      line_translations: contributions.line_translations || 0,
      line_comments: contributions.line_comments || 0,
      song_comments: contributions.song_comments || 0,
      submissions_for_song: contributions.submissions || 0,
    },
    provenance: {
      source: song.source ?? null, submitted_by: song.submitted_by ?? null, last_edited_by: song.last_edited_by ?? null,
      user_id: song.user_id ?? null, created_at: song.created_at ?? null, updated_at: song.updated_at ?? null,
    },
    linked_artists: linkedArtists.length,
  };
  record.problem_categories = problemCategories(flags);
  record.completeness = completeness(record);
  return record;
}

// Problems (something is wrong) vs. incompleteness (something is simply absent). Missing
// translation / YouTube / bio / credits are incomplete content, never corruption.
const FORMATTING = /^(chinese|pinyin|english)_(carriage_return|mixed_newlines|leading_blank_lines|trailing_blank_lines|repeated_blank_lines|trailing_whitespace|lrc_timestamp|html_markup|long_line|possible_duplicated_block)$/;
const CATEGORY = {
  missing_lyrics: 'lyrics', missing_title: 'title',
  missing_pinyin: 'pinyin', pinyin_line_count_mismatch: 'pinyin', pinyin_alignment_failure: 'pinyin', word_grouped_pinyin: 'pinyin',
  translation_line_mismatch: 'translation_mismatch',
  missing_artist: 'artist', no_linked_artist: 'artist', artist_link_mismatch: 'artist',
  missing_cover: 'cover', missing_year: 'year',
  suspicious_lyric_source_metadata: 'source_metadata', possible_lyric_source_metadata: 'source_metadata',
};
export const problemCategories = flags => [...new Set(flags.map(flag => (FORMATTING.test(flag) ? 'formatting' : CATEGORY[flag])).filter(Boolean))];
export const isFormattingFlag = flag => FORMATTING.test(flag);

/** 0..1: share of the eight completeness checks a song passes. Flags stay the source of truth. */
function completeness({ health, flags }) {
  const checks = [
    health.lyrics, health.pinyin === 'ok' || health.pinyin === 'not_applicable', health.translation === 'ok',
    health.cover, health.year, health.youtube, health.artist_link, !flags.some(isFormattingFlag),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100) / 100;
}

/** Join every table's rows onto songs and audit each one. All inputs are plain arrays of rows. */
export function auditCatalogue({ songs, artists = [], songArtists = [], lineTranslations = [], lineComments = [], songComments = [], submissions = [] }) {
  const artistById = new Map(artists.map(artist => [artist.id, artist]));
  const linksBySong = new Map();
  for (const link of songArtists) {
    const artist = artistById.get(link.artist_id);
    if (!artist) throw new Error(`song_artists row ${link.id} points at missing artist ${link.artist_id}`);
    if (!linksBySong.has(link.song_id)) linksBySong.set(link.song_id, []);
    linksBySong.get(link.song_id).push({ ...artist, role: link.role });
  }
  const tally = rows => rows.reduce((map, row) => map.set(row.song_id ?? row.original_song_id, (map.get(row.song_id ?? row.original_song_id) || 0) + 1), new Map());
  const translations = tally(lineTranslations);
  const comments = tally(lineComments);
  const discussions = tally(songComments);
  const submitted = tally(submissions.filter(row => row.original_song_id != null));
  return songs.map(song => auditSong(song, {
    linkedArtists: linksBySong.get(song.id) || [],
    contributions: {
      line_translations: translations.get(song.id), line_comments: comments.get(song.id),
      song_comments: discussions.get(song.id), submissions: submitted.get(song.id),
    },
  }));
}

const has = (record, ...flags) => flags.some(flag => record.flags.includes(flag));
const badPinyin = record => record.problem_categories.includes('pinyin');
const userMade = record => record.provenance.source === 'user' || Boolean(record.provenance.last_edited_by);

/** Totals and intersections. Every number is computed from per-song flags. */
export function summarize(records) {
  const count = predicate => records.filter(predicate).length;
  const only = category => count(record => record.problem_categories.length === 1 && record.problem_categories[0] === category);
  const flagCounts = {};
  for (const record of records) for (const flag of record.flags) flagCounts[flag] = (flagCounts[flag] || 0) + 1;
  const mean = records.length ? records.reduce((sum, record) => sum + record.completeness, 0) / records.length : 0;
  return {
    songs_audited: records.length,
    totals: {
      missing_lyrics: count(r => has(r, 'missing_lyrics')),
      missing_pinyin: count(r => has(r, 'missing_pinyin')),
      pinyin_line_count_mismatch: count(r => has(r, 'pinyin_line_count_mismatch')),
      songs_with_alignment_failures: count(r => has(r, 'pinyin_alignment_failure')),
      failed_pinyin_lines: records.reduce((sum, r) => sum + r.counts.pinyin_alignment_failures, 0),
      songs_with_word_grouped_pinyin: count(r => has(r, 'word_grouped_pinyin')),
      missing_translation: count(r => has(r, 'missing_translation')),
      translation_line_mismatch: count(r => has(r, 'translation_line_mismatch')),
      missing_cover: count(r => has(r, 'missing_cover')),
      missing_year: count(r => has(r, 'missing_year')),
      missing_youtube: count(r => has(r, 'missing_youtube')),
      missing_bio: count(r => has(r, 'missing_bio')),
      missing_credits: count(r => has(r, 'missing_credits')),
      no_linked_artist: count(r => has(r, 'no_linked_artist')),
      suspicious_artist_linkage: count(r => has(r, 'artist_link_mismatch')),
      suspicious_lyric_formatting: count(r => r.problem_categories.includes('formatting')),
      suspicious_lyric_source_metadata: count(r => has(r, 'suspicious_lyric_source_metadata')),
      possible_lyric_source_metadata: count(r => has(r, 'possible_lyric_source_metadata')),
      with_user_contributions: count(r => r.has_user_contributions),
      user_submitted_or_edited: count(userMade),
    },
    intersections: {
      bad_pinyin_no_user_contributions: count(r => badPinyin(r) && !r.has_user_contributions),
      bad_pinyin_with_user_contributions: count(r => badPinyin(r) && r.has_user_contributions),
      bad_pinyin_and_user_submitted_or_edited: count(r => badPinyin(r) && userMade(r)),
      missing_cover_only: only('cover'),
      missing_year_only: only('year'),
      healthy_but_missing_translation: count(r => !r.problem_categories.length && has(r, 'missing_translation')),
      fully_healthy: count(r => !r.problem_categories.length),
      multiple_problem_categories: count(r => r.problem_categories.length > 1),
    },
    flag_counts: Object.fromEntries(Object.entries(flagCounts).sort(([a], [b]) => a.localeCompare(b))),
    completeness_score: Math.round(mean * 1000) / 10,
    definitions: {
      problem_categories: 'lyrics, title, pinyin, formatting, translation_mismatch, artist, cover, year. Missing translation/YouTube/bio/credits are incompleteness, not problems.',
      bad_pinyin: 'missing pinyin, line-count mismatch, alignment failures or word-grouped pinyin.',
      only: 'the song has exactly that one problem category (incompleteness ignored).',
      has_user_contributions: 'line translations, line comments or song-level comments attached to the song. Likes are not counted.',
      user_submitted_or_edited: "source is 'user' or last_edited_by is set. Reported separately; updated_at alone is never used to infer safety.",
      artist_link_mismatch: 'linked artists and the free-text artist fields share no names, or a linked artist is absent from the text. Several main links are normal for collaborations.',
      pinyin_alignment_failures: 'counted only when pinyin and Chinese have the same line count; mismatched songs are reported under pinyin_line_count_mismatch.',
      word_grouped_pinyin: 'heuristic: a failing pinyin line has a token longer than six letters. Shorter grouped words go undetected.',
    },
  };
}

const n = value => value.toLocaleString('en-US');
export function formatSummary(summary) {
  const { totals: t, intersections: x } = summary;
  const row = (label, value) => `${`${label}:`.padEnd(34)}${n(value).padStart(7)}`;
  return [
    'Catalogue Health', '----------------',
    row('Songs audited', summary.songs_audited), '',
    row('Missing lyrics', t.missing_lyrics),
    row('Missing pinyin', t.missing_pinyin),
    row('Pinyin line-count mismatch', t.pinyin_line_count_mismatch),
    row('Songs with alignment failures', t.songs_with_alignment_failures),
    row('Failed pinyin lines', t.failed_pinyin_lines),
    row('  of which word-grouped (songs)', t.songs_with_word_grouped_pinyin), '',
    row('Missing English translation', t.missing_translation),
    row('Translation line mismatch', t.translation_line_mismatch), '',
    row('Missing cover', t.missing_cover),
    row('Missing year', t.missing_year),
    row('Missing YouTube URL', t.missing_youtube),
    row('Missing bio', t.missing_bio),
    row('Missing credits', t.missing_credits), '',
    row('No linked artist', t.no_linked_artist),
    row('Suspicious artist linkage', t.suspicious_artist_linkage), '',
    row('Suspicious lyric formatting', t.suspicious_lyric_formatting),
    row('Source metadata in lyrics', t.suspicious_lyric_source_metadata),
    row('Possible lyric source headers', t.possible_lyric_source_metadata),
    row('Songs with user contributions', t.with_user_contributions),
    row('User-submitted or user-edited', t.user_submitted_or_edited), '',
    'Intersections', '-------------',
    row('Bad pinyin, no contributions', x.bad_pinyin_no_user_contributions),
    row('Bad pinyin, with contributions', x.bad_pinyin_with_user_contributions),
    row('Bad pinyin, user submitted/edited', x.bad_pinyin_and_user_submitted_or_edited),
    row('Missing cover only', x.missing_cover_only),
    row('Missing year only', x.missing_year_only),
    row('Healthy, only missing translation', x.healthy_but_missing_translation),
    row('Fully healthy (no problems)', x.fully_healthy),
    row('Multiple problem categories', x.multiple_problem_categories), '',
    `Completeness score: ${summary.completeness_score}%`,
  ].join('\n');
}
