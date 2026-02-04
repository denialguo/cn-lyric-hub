import { createClient } from '@supabase/supabase-client';
import { SitemapStream, streamToPromise } from 'sitemap';
import { createWriteStream } from 'fs';
import { resolve } from 'path';

// Use your actual Supabase credentials here
const supabase = createClient('https://gxxxgycqqoivkqcpwxvd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHhneWNxcW9pdmtxY3B3eHZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MzA1NjUsImV4cCI6MjA4MTUwNjU2NX0.Xqi9Pd233PxDfKWhPqfeagIJnyT07pf4C7TafWtMfTU');

async function generate() {
  const { data: songs } = await supabase.from('songs').select('slug');

  const smStream = new SitemapStream({ hostname: 'https://cnlyrichub.vercel.app' });
  
  // Add static pages
  smStream.write({ url: '/', changefreq: 'daily', priority: 1.0 });
  smStream.write({ url: '/add', changefreq: 'monthly', priority: 0.5 });

  // Add dynamic song pages
  songs.forEach((song) => {
    smStream.write({
      url: `/song/${song.slug}`,
      changefreq: 'weekly',
      priority: 0.8,
    });
  });

  smStream.end();

  const sitemapOutput = await streamToPromise(smStream);
  createWriteStream(resolve('./public/sitemap.xml')).write(sitemapOutput);
  
  console.log('Sitemap generated successfully!');
}

generate();