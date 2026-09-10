/**
 * Prerender song and artist pages to real HTML at build time.
 *
 * Why this exists: the app is a client-rendered SPA, so every URL used to serve
 * the same 915-byte shell — identical <title>, identical description, an empty
 * <div id="root">, and no lyrics. react-helmet-async only sets those tags AFTER
 * JavaScript runs. Googlebot dedupes byte-identical HTML, so 1600+ song pages
 * collapsed into one and the rest sat in "Crawled – currently not indexed".
 * Two pages were indexed in total.
 *
 * This writes dist/song/<slug>/index.html per song with a unique title,
 * description, canonical, Open Graph tags, JSON-LD, and the actual lyrics in the
 * markup. Vercel resolves static files before `rewrites`, so these are served
 * instead of the SPA shell, and the SPA still handles anything not prerendered.
 *
 * This is prerendering, not cloaking: every visitor gets this same HTML, and the
 * React app renders the same content over it.
 *
 * Runs after `vite build` (it needs dist/index.html as the template).
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const DOMAIN = 'https://cnlyrichub.vercel.app';
const DIST = './dist';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('⚠️  No Supabase env — skipping prerender. Pages will serve the SPA shell.');
  process.exit(0);
}

const TEMPLATE_PATH = path.join(DIST, 'index.html');
if (!fs.existsSync(TEMPLATE_PATH)) {
  console.error('❌ dist/index.html missing — run vite build first.');
  process.exit(1);
}
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// JSON-LD sits inside <script>, so only </script> and the JSON itself matter.
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

/** PostgREST caps every response at 1000 rows — page or silently lose the tail. */
async function fetchAll(select, extra = '') {
  const PAGE = 1000;
  let all = [];
  for (let from = 0; ; from += PAGE) {
    const rows = await fetch(`${url}/rest/v1/songs?select=${select}${extra}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + PAGE - 1}`,
      },
    }).then((r) => r.json());
    all = all.concat(rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/**
 * Replace the <head> tags Helmet would have set, and fill #root with real content.
 * `data-rh="true"` on the description lets Helmet replace ours rather than append
 * a second one once the app mounts.
 */
function render({ title, description, canonical, ogImage, ogType, structuredData, body, noindex }) {
  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(
    /<meta data-rh="true" name="description"[^>]*>/,
    `<meta data-rh="true" name="description" content="${esc(description)}" />`
  );

  const head = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    noindex ? `<meta name="robots" content="noindex, follow" />` : '',
    ...structuredData.map((d) => `<script type="application/ld+json">${jsonLd(d)}</script>`),
  ]
    .filter(Boolean)
    .join('\n    ');

  html = html.replace('</head>', `  ${head}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

function songBody(song, chineseLines, pinyinLines, englishLines) {
  const artist = song.artist_en || song.artist_zh || 'Unknown';
  const displayTitle = song.title_zh || song.title_en || 'Untitled';

  const lines = [];
  const count = Math.max(chineseLines.length, pinyinLines.length, englishLines.length);
  for (let i = 0; i < count; i++) {
    const zh = (chineseLines[i] || '').trim();
    const py = (pinyinLines[i] || '').trim();
    const en = (englishLines[i] || '').trim();
    if (!zh && !en) continue;
    lines.push(
      `<div class="p-4">` +
        (zh ? `<p class="text-2xl font-medium text-slate-200">${esc(zh)}</p>` : '') +
        (py ? `<p class="text-xs text-slate-500">${esc(py)}</p>` : '') +
        // No "translation unavailable" filler — an absent translation renders nothing.
        (en ? `<p class="text-sm text-slate-400">${esc(en)}</p>` : '') +
        `</div>`
    );
  }

  return (
    `<div class="min-h-screen bg-slate-950 text-white">` +
    `<main class="max-w-5xl mx-auto px-6 py-12">` +
    `<h1 class="text-4xl font-black mb-2">${esc(displayTitle)}</h1>` +
    (song.title_en && song.title_en !== song.title_zh
      ? `<p class="text-2xl text-slate-400 italic mb-2">${esc(song.title_en)}</p>`
      : '') +
    `<p class="text-2xl text-primary mb-8">${esc(artist)}</p>` +
    (song.year ? `<p class="text-sm text-slate-500 mb-6">Released ${esc(song.year)}</p>` : '') +
    `<div class="space-y-4">${lines.join('')}</div>` +
    (song.bio ? `<section class="mt-16"><h2 class="text-xl font-bold mb-4">About This Song</h2><p class="text-slate-300 whitespace-pre-wrap">${esc(song.bio)}</p></section>` : '') +
    (song.credits ? `<section class="mt-10"><h2 class="text-xl font-bold mb-4">Credits</h2><p class="text-slate-300 whitespace-pre-wrap">${esc(song.credits)}</p></section>` : '') +
    `</main></div>`
  );
}

/**
 * Write as `<route>.html`, NOT `<route>/index.html`.
 *
 * Directory-index resolution only matches with a trailing slash on some static
 * servers (vite preview included), and our canonicals and sitemap use the
 * slash-less form — which is what Googlebot requests. Vercel serves `foo.html`
 * at the extensionless path `/foo`, made explicit by `cleanUrls: true` in
 * vercel.json. A route with no file falls through to the SPA rewrite, so
 * newly-added songs still work before the next deploy.
 */
function writePage(routePath, html) {
  const target = path.join(DIST, `${routePath}.html`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
}

// Static routes serve the same shell as the homepage, so they were duplicates of
// each other too. The real page renders over this once React mounts.
const STATIC_ROUTES = [
  {
    route: 'faq',
    title: 'FAQ — CN Lyric Hub',
    description: 'How Pinyin works, switching between Simplified and Traditional, community translations, adding songs, and DMCA takedown requests.',
    h1: 'Frequently Asked Questions',
  },
  {
    route: 'stats',
    title: 'Catalogue Statistics — CN Lyric Hub',
    description: 'Character frequency, tone distribution, rhyme patterns and vocabulary diversity across the Chinese lyrics catalogue.',
    h1: 'Catalogue Statistics',
  },
  {
    route: 'privacy',
    title: 'Privacy Policy — CN Lyric Hub',
    description: 'What data CN Lyric Hub collects, how it is stored, and how to have it deleted. No ads, no data sales, no advertising trackers.',
    h1: 'Privacy Policy',
  },
  {
    route: 'terms',
    title: 'Terms of Service — CN Lyric Hub',
    description: 'The terms for using CN Lyric Hub: contributed translations and comments, acceptable use, content moderation, and the absence of any warranty.',
    h1: 'Terms of Service',
  },
];

function prerenderStaticRoutes() {
  for (const page of STATIC_ROUTES) {
    const canonical = `${DOMAIN}/${page.route}`;
    writePage(
      page.route,
      render({
        title: page.title,
        description: page.description,
        canonical,
        ogType: 'website',
        ogImage: `${DOMAIN}/logo.png`,
        structuredData: [],
        body:
          `<div class="min-h-screen bg-slate-950 text-white"><main class="max-w-3xl mx-auto px-6 py-16">` +
          `<h1 class="text-4xl font-black mb-4">${esc(page.h1)}</h1>` +
          `<p class="text-slate-400">${esc(page.description)}</p>` +
          `</main></div>`,
      })
    );
  }
  return STATIC_ROUTES.length;
}

async function main() {
  const staticCount = prerenderStaticRoutes();
  const songs = await fetchAll(
    'slug,title_zh,title_en,artist_en,artist_zh,lyrics_chinese,lyrics_pinyin,lyrics_english,cover_url,year,bio,credits,source'
  );
  console.log(`Prerendering ${songs.length} songs…`);

  let done = 0;
  const artists = new Map(); // name -> song count

  for (const song of songs) {
    if (!song.slug) continue;

    const chineseLines = (song.lyrics_chinese || '').split('\n');
    const pinyinLines = (song.lyrics_pinyin || '').split('\n');
    const englishLines = (song.lyrics_english || '').split('\n');

    const displayTitle = song.title_zh || song.title_en || 'Untitled';
    const artist = song.artist_en || song.artist_zh || 'Unknown';
    const canonical = `${DOMAIN}/song/${song.slug}`;
    const hasTranslation = englishLines.some((l) => l.trim());

    // Unique, non-boilerplate description — this is what stops Google collapsing
    // the whole catalogue into one page.
    const firstLine = chineseLines.find((l) => l.trim()) || '';
    const description =
      `${displayTitle} by ${artist} — full Chinese lyrics with character-by-character Pinyin` +
      (hasTranslation ? ' and English translation' : '') +
      (song.year ? `. Released ${song.year}` : '') +
      (firstLine ? `. Opens with "${firstLine.trim()}".` : '.');

    for (const col of [song.artist_en, song.artist_zh]) {
      for (const name of (col || '').split(',')) {
        const t = name.trim();
        if (t) artists.set(t, (artists.get(t) || 0) + 1);
      }
    }

    const html = render({
      title: `${displayTitle} — ${artist} | Lyrics, Pinyin${hasTranslation ? ' & English' : ''} | CN Lyric Hub`,
      description,
      canonical,
      ogImage: song.cover_url || `${DOMAIN}/logo.png`,
      ogType: 'music.song',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'MusicComposition',
          name: song.title_zh || song.title_en,
          alternativeHeadline: song.title_en || undefined,
          inLanguage: 'zh',
          url: canonical,
          image: song.cover_url || undefined,
          datePublished: song.year ? String(song.year) : undefined,
          composer: artist !== 'Unknown' ? { '@type': 'MusicGroup', name: artist } : undefined,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` },
            ...(artist !== 'Unknown'
              ? [{ '@type': 'ListItem', position: 2, name: artist, item: `${DOMAIN}/artist/${encodeURIComponent(artist)}` }]
              : []),
            { '@type': 'ListItem', position: artist !== 'Unknown' ? 3 : 2, name: displayTitle, item: canonical },
          ],
        },
      ],
      body: songBody(song, chineseLines, pinyinLines, englishLines),
    });

    writePage(path.join('song', song.slug), html);
    done++;
  }

  // Artist pages have the same duplicate-shell problem.
  let artistCount = 0;
  for (const [name, songCount] of artists) {
    // The file must be named with the RAW name, not the percent-encoded one: a
    // server percent-decodes the request path before matching the filesystem, so
    // "/artist/%E5%91%A8%E6%9D%B0%E4%BC%A6" looks for "artist/周杰伦.html".
    // Skip names carrying characters that can't be a path segment — a mangled
    // filename wouldn't match its URL anyway.
    if (/[/\\:*?"<>|]/.test(name)) continue;
    const canonical = `${DOMAIN}/artist/${encodeURIComponent(name)}`;
    const html = render({
      title: `${name} — Song Lyrics with Pinyin & English | CN Lyric Hub`,
      description: `All ${songCount} ${name} song${songCount === 1 ? '' : 's'} on CN Lyric Hub, with character-by-character Pinyin and English translations.`,
      canonical,
      ogType: 'profile',
      ogImage: `${DOMAIN}/logo.png`,
      structuredData: [
        { '@context': 'https://schema.org', '@type': 'MusicGroup', name, url: canonical },
      ],
      body:
        `<div class="min-h-screen bg-slate-950 text-white"><main class="max-w-6xl mx-auto px-6 py-12">` +
        `<h1 class="text-4xl font-black mb-2">${esc(name)}</h1>` +
        `<p class="text-slate-400">${songCount} song${songCount === 1 ? '' : 's'} with Pinyin and English translations.</p>` +
        `</main></div>`,
    });
    writePage(path.join('artist', name), html);
    artistCount++;
  }

  console.log(`✅ Prerendered ${done} songs + ${artistCount} artists + ${staticCount} static pages`);
}

main().catch((err) => {
  // Never fail the deploy over SEO markup — the SPA shell still works.
  console.error('⚠️  Prerender failed, continuing with SPA shell:', err.message);
  process.exit(0);
});
