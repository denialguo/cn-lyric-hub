const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const DOMAIN = 'https://cn-lyric-hub.vercel.app'; // Update if your Vercel URL is different, or when you get a custom domain

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
  console.error('❌ Sitemap generation timed out after 15s');
  process.exit(1);
}, 15000);

async function generateSitemap() {
  console.log('Fetching songs...');
  const { data: songs, error } = await supabase
    .from('songs')
    .select('slug, created_at');

  if (error) {
    console.error('Error fetching songs:', error.message);
    clearTimeout(timeout);
    process.exit(1);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${DOMAIN}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${(songs || []).map(song => `<url>
    <loc>${DOMAIN}/song/${song.slug}</loc>
    <lastmod>${new Date(song.created_at || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n  ')}
</urlset>`;

  fs.writeFileSync('./public/sitemap.xml', sitemap);
  console.log(`✅ Sitemap generated with ${(songs || []).length} songs`);
  clearTimeout(timeout);
}

generateSitemap();
