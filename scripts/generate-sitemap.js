const { createClient } = require('@supabase/supabase-client');
const { SitemapStream, streamToPromise } = require('sitemap');
const { createWriteStream } = require('fs');
const { resolve } = require('path');

// Use process.env for Vercel compatibility
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generate() {
  try {
    const { data: songs, error } = await supabase.from('songs').select('slug');
    if (error) throw error;

    const smStream = new SitemapStream({ hostname: 'https://cnlyrichub.vercel.app' });
    
    smStream.write({ url: '/', changefreq: 'daily', priority: 1.0 });

    if (songs) {
      songs.forEach((song) => {
        smStream.write({
          url: `/song/${song.slug}`,
          changefreq: 'weekly',
          priority: 0.8,
        });
      });
    }

    smStream.end();

    const sitemapOutput = await streamToPromise(smStream);
    createWriteStream(resolve(__dirname, '../public/sitemap.xml')).write(sitemapOutput);
    
    console.log('Sitemap generated successfully!');
  } catch (err) {
    console.error('Sitemap generation failed:', err);
    process.exit(1);
  }
}

generate();