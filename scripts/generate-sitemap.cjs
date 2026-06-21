const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
// Prefer .env.local (the project's convention); Vercel injects real env vars so this is a no-op there
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const DOMAIN = 'https://cnlyrichub.vercel.app';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('⚠️  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — skipping sitemap generation.');
  console.warn('   Add these to your Vercel Environment Variables if building on Vercel.');
  // Write a basic sitemap with just the homepage so the build doesn't fail
  fs.writeFileSync('./public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${DOMAIN}/</loc><priority>1.0</priority></url>
</urlset>`);
  process.exit(0);
}

const supabase = createClient(url, key);

// Timeout so the build never hangs
const timeout = setTimeout(() => {
  console.error('❌ Sitemap generation timed out after 30s');
  process.exit(1);
}, 30000);

// Supabase caps each request at 1000 rows — page through with .range() to get the whole catalog
async function fetchAllSongs() {
  const PAGE = 1000;
  let all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('songs')
      .select('slug, updated_at, artist_en, artist_zh')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
  }
  return all;
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function urlTag(loc, { lastmod, changefreq, priority } = {}) {
  return `<url>
    <loc>${xmlEscape(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}${changefreq ? `\n    <changefreq>${changefreq}</changefreq>` : ''}${priority ? `\n    <priority>${priority}</priority>` : ''}
  </url>`;
}

async function generateSitemap() {
  console.log('Fetching songs...');
  let songs;
  try {
    songs = await fetchAllSongs();
  } catch (err) {
    console.error('Error fetching songs:', err.message);
    clearTimeout(timeout);
    process.exit(1);
  }

  // Distinct artist set (names live in comma-joined en/zh columns)
  const artists = new Set();
  for (const song of songs) {
    for (const col of [song.artist_en, song.artist_zh]) {
      if (!col) continue;
      for (const name of col.split(',')) {
        const trimmed = name.trim();
        if (trimmed) artists.add(trimmed);
      }
    }
  }

  const staticUrls = [
    urlTag(`${DOMAIN}/`, { changefreq: 'daily', priority: '1.0' }),
    urlTag(`${DOMAIN}/faq`, { changefreq: 'monthly', priority: '0.5' }),
    urlTag(`${DOMAIN}/stats`, { changefreq: 'weekly', priority: '0.5' }),
  ];

  const songUrls = songs.map(song => urlTag(`${DOMAIN}/song/${song.slug}`, {
    lastmod: new Date(song.updated_at || Date.now()).toISOString(),
    changefreq: 'weekly',
    priority: '0.8',
  }));

  const artistUrls = [...artists].map(name => urlTag(`${DOMAIN}/artist/${encodeURIComponent(name)}`, {
    changefreq: 'weekly',
    priority: '0.6',
  }));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${[...staticUrls, ...songUrls, ...artistUrls].join('\n  ')}
</urlset>`;

  fs.writeFileSync('./public/sitemap.xml', sitemap);
  console.log(`✅ Sitemap generated: ${songs.length} songs, ${artists.size} artists, ${staticUrls.length} static pages`);
  clearTimeout(timeout);
}

generateSitemap();
