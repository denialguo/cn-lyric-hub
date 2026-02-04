import { createClient } from '@supabase/supabase-js'; // <--- FIXED THIS LINE
import { SitemapStream, streamToPromise } from 'sitemap';
import { createWriteStream } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

// 1. Get Credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generate() {
  try {
    console.log("Fetching songs for sitemap...");
    
    // 2. Fetch Slugs
    const { data: songs, error } = await supabase.from('songs').select('slug');
    if (error) throw error;

    // 3. Start Stream
    const smStream = new SitemapStream({ hostname: 'https://cnlyrichub.vercel.app' });
    
    // 4. Add Pages
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

    // 5. Save to File
    const sitemapOutput = await streamToPromise(smStream);
    const outputPath = resolve(process.cwd(), 'public/sitemap.xml');
    
    createWriteStream(outputPath).write(sitemapOutput);
    
    console.log(`✅ Sitemap generated successfully at ${outputPath}`);
  } catch (err) {
    console.error('❌ Sitemap generation failed:', err);
    process.exit(1);
  }
}

generate();