/**
 * Conservative, read-only source-lyric provenance detector.
 *
 * Lyrics are not edited here: false positives must never remove sung content.
 * The importer blocks on high-confidence metadata; ambiguous headers are
 * queued for review. Pinyin, mixed scripts, Cantonese, colloquialisms, spoken
 * sections and singer/producer names that occur *inside actual lyrics* are
 * not intrinsically suspicious.
 */
const CREDIT_LABEL = /^(?:(?:作词|作詞|作曲|填词|填詞|编曲|編曲|编配|編配|录音(?:师|室)?|錄音(?:師|室)?|混音(?:师)?|混音師|监制|監製|制作人|製作人|母带|母帶|演唱|原唱|歌曲制作|歌曲製作|配唱|和声|和聲|词曲|詞曲|谱曲|譜曲|歌词制作|歌詞製作|歌词提供|歌詞提供)\s*[：:∶/／\-]|KRC\s*(?:制作|製作)|(?:arranged|recorded|mixed|produced|written|composed)\s+by\s*[:：]?|(?:lyrics|music|vocals|production|mastering|studio)\s*(?:by|[:：]))/iu;
const STUDIO = /^(?:[\p{Script=Han}A-Za-z0-9\s./()（）-]{0,32}(?:录音工作室|錄音工作室|录音室|錄音室|recording studio|mastering studio|mixing studio)[)）]?|[A-Za-z0-9 ._-]{2,30}\s+STUDIO)$/iu;
const SITE = /(?:https?:\/\/|www\.|歌词来源|歌詞來源|歌词提供|歌詞提供|欢迎您|歡迎您|\b(?:QQ音乐|网易云音乐|千千静听)\b)/iu;
const INSTRUMENTAL = /^[（(]\s*(?:music|instrumental|interlude|伴奏|间奏|間奏|纯音乐|純音樂)\s*[）)]$/iu;
const END_MARKER = /^-?\s*END\s*-?$/iu;
const SOLO_DECORATION = /^[\]】}]+$/u;
const TITLE_BRACKETS = /^[《〈「『].+[》〉」』]$/u;
const PERSONNEL = /^[\p{Script=Han}A-Za-z\s./、/&()（）-]{2,48}$/u;

const normalize = value => String(value ?? '').replace(/\r\n?/g, '\n');
const simplifiedSpacing = value => String(value || '').trim().replace(/[\s\u3000]+/gu, ' ');

/**
 * @returns {{line_number:number,kind:string,confidence:'high'|'review',text:string,reason:string}[]}
 * Does not mutate anything.
 */
export function detectLyricMetadata(lyrics, { title = '', artist = '' } = {}) {
  const lines = normalize(lyrics).split('\n');
  if (!lines.some(line => line.trim())) return [];
  const issues = [];
  const seen = new Set();
  const push = (index, kind, confidence, reason) => {
    if (seen.has(index + ':' + kind)) return;
    seen.add(index + ':' + kind);
    issues.push({ line_number: index + 1, kind, confidence, text: lines[index], reason });
  };
  const meaningful = lines.map(line => simplifiedSpacing(line));
  const lastNonblank = meaningful.findLastIndex(Boolean);
  let firstMeaningful = meaningful.findIndex(Boolean);

  for (let i = 0; i < meaningful.length; i++) {
    const line = meaningful[i];
    if (!line) continue;
    if (INSTRUMENTAL.test(line)) push(i, 'instrumental_marker', 'high', 'Instrumental direction, not performed text');
    if (END_MARKER.test(line) && (i === lastNonblank || i >= lastNonblank - 1))
      push(i, 'end_marker', 'high', 'Trailing source-file terminator');
    if (SOLO_DECORATION.test(line)) push(i, 'stray_markup', 'high', 'Standalone markup fragment');
    if (SITE.test(line) && (i < 12 || i >= lastNonblank - 2))
      push(i, 'site_boilerplate', 'high', 'Source-site label or greeting');
    if (CREDIT_LABEL.test(line) && (i < 18 || i > lastNonblank - 5))
      push(i, 'recording_credit', 'high', 'Personnel or recording credit');
  }

  // The first two dozen lines are the only reasonable place to find a source
  // preamble. Standalone studio identifiers here are conclusive; words like
  // "recording" elsewhere in a sung lyric are not.
  for (let i = 0; i < Math.min(lines.length, 16); i++) {
    const line = meaningful[i];
    if (line && STUDIO.test(line) && PERSONNEL.test(line))
      push(i, 'studio_preamble', 'high', 'Standalone studio/personnel preamble');
  }

  if (firstMeaningful >= 0 && firstMeaningful < 5) {
    const first = meaningful[firstMeaningful];
    const titleText = simplifiedSpacing(title);
    const artistText = simplifiedSpacing(artist);
    // Titles can be sung; this is review-only and never automatically deleted.
    if (titleText && (
      first === titleText ||
      TITLE_BRACKETS.test(first) && first.slice(1, -1) === titleText ||
      (artistText && first.includes(titleText) && first.includes(artistText))
    )) push(firstMeaningful, 'possible_title_header', 'review', 'Opening line resembles song title/artist metadata');
  }

  // Multiple standalone personnel-looking lines before the first verse need
  // human review even if the original source did not label every role.
  const first12 = meaningful.slice(0, 12);
  const obviousStudio = first12.findIndex(line => line && STUDIO.test(line) && PERSONNEL.test(line));
  if (obviousStudio >= 1) {
    for (let i = 0; i <= obviousStudio; i++) {
      const line = meaningful[i];
      if (line && PERSONNEL.test(line) && line.length <= 48 && !CREDIT_LABEL.test(line) &&
          !STUDIO.test(line) && !/[，。！？!?]/u.test(line))
        push(i, 'possible_personnel_preamble', 'review', 'Part of initial personnel/studio cluster');
    }
  }

  return issues.sort((a, b) => a.line_number - b.line_number ||
    (a.confidence === 'high' ? -1 : 1));
}

/** Import-side fail-closed gate; never strip content or shift line indices. */
export function validateLyricSource(lyrics, context) {
  const issues = detectLyricMetadata(lyrics, context);
  return { ok: issues.length === 0, issues };
}
