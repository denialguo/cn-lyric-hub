// scripts/generate-sitemap.js
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // You might need: npm install dotenv

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const DOMAIN = 'https://your-domain-here.com'; // REPLACE THIS WITH YOUR ACTUAL DOMAIN

async function generateSitemap() {
  console.log('Fetching songs...');
  const { data: songs, error } = await supabase
    .from('songs')
    .select('slug, updated_at');

  if (error) {
    console.error('Error fetching songs:', error);
    return;
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${DOMAIN}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${songs.map(song => `
  <url>
    <loc>${DOMAIN}/song/${song.slug}</loc>
    <lastmod>${new Date(song.updated_at || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  `).join('')}
</urlset>`;

  // Write to the PUBLIC folder so it's accessible at your-site.com/sitemap.xml
  fs.writeFileSync('./public/sitemap.xml', sitemap);
  console.log(`✅ Sitemap generated with ${songs.length} songs at ./public/sitemap.xml`);
}

generateSitemap();