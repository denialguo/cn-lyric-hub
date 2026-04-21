/**
 * CN Lyric Hub — Bulk Cover Art Fetcher
 * 
 * Uses the iTunes Search API (free, no auth needed) to find album art
 * for songs that are missing cover images.
 * 
 * Usage:
 *   node scripts/fetch-covers.cjs
 *   node scripts/fetch-covers.cjs --dry-run     # Preview without updating DB
 *   node scripts/fetch-covers.cjs --limit 20    # Only process 20 songs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- CLI ARGS ---
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) : Infinity;

// --- HELPERS ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchITunes(query) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://itunes.apple.com/search?term=${encoded}&media=music&limit=3&country=CN`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
      // Try artworkUrl100 first, fall back to artworkUrl60
      const raw = data.results[0].artworkUrl100 || data.results[0].artworkUrl60;
      if (!raw) return null;
      
      // Only upscale if the standard pattern exists
      if (raw.includes('100x100bb')) {
        return raw.replace('100x100bb', '600x600bb');
      } else if (raw.includes('60x60bb')) {
        return raw.replace('60x60bb', '600x600bb');
      }
      // Return as-is if pattern doesn't match
      return raw;
    }
    return null;
  } catch (err) {
    console.error(`    fetch error: ${err.message}`);
    return null;
  }
}

async function searchITunesGlobal(query) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://itunes.apple.com/search?term=${encoded}&media=music&limit=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
      const raw = data.results[0].artworkUrl100 || data.results[0].artworkUrl60;
      if (!raw) return null;
      
      if (raw.includes('100x100bb')) {
        return raw.replace('100x100bb', '600x600bb');
      } else if (raw.includes('60x60bb')) {
        return raw.replace('60x60bb', '600x600bb');
      }
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

// --- MAIN ---
async function main() {
  console.log('\n🎨 Cover Art Fetcher\n');
  if (dryRun) console.log('🔍 DRY RUN — no database writes\n');

  // Fetch songs with no cover
  const { data: songs, error } = await supabase
    .from('songs')
    .select('id, title_zh, title_en, artist_en, artist_zh')
    .or('cover_url.is.null,cover_url.eq.')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch songs:', error.message);
    process.exit(1);
  }

  const toProcess = songs.slice(0, limit);
  console.log(`Found ${songs.length} songs without covers, processing ${toProcess.length}\n`);

  let found = 0;
  let notFound = 0;

  for (const song of toProcess) {
    const title = song.title_zh || song.title_en || '';
    const artist = song.artist_zh || song.artist_en || '';
    const display = `${title} — ${artist || 'Unknown'}`;

    // Strategy 1: Chinese title + Chinese artist (best match for C-pop)
    let coverUrl = null;
    if (song.title_zh) {
      const query1 = `${song.title_zh} ${song.artist_zh || song.artist_en || ''}`.trim();
      coverUrl = await searchITunes(query1);
    }

    // Strategy 2: English title + English artist
    if (!coverUrl && song.title_en) {
      const query2 = `${song.title_en} ${song.artist_en || ''}`.trim();
      coverUrl = await searchITunesGlobal(query2);
    }

    // Strategy 3: Just the Chinese title (broader search)
    if (!coverUrl && song.title_zh) {
      coverUrl = await searchITunesGlobal(song.title_zh);
    }

    if (coverUrl) {
      console.log(`  ✅ ${display}`);
      console.log(`     → ${coverUrl}`);
      found++;

      if (!dryRun) {
        const { error: updateErr } = await supabase
          .from('songs')
          .update({ cover_url: coverUrl })
          .eq('id', song.id);
        
        if (updateErr) {
          console.log(`     ❌ DB update failed: ${updateErr.message}`);
        }
      }
    } else {
      console.log(`  ⬜ ${display} — no match`);
      notFound++;
    }

    // Rate limit: ~3 requests per song max, iTunes allows ~20/min
    await sleep(1500);
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`✅ Found covers:    ${found}`);
  console.log(`⬜ No match:        ${notFound}`);
  console.log(`${'='.repeat(40)}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
