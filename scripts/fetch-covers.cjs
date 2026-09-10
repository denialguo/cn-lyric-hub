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
const { search, artworkUrl, sleep } = require('./itunes.cjs');

async function findCover(term, country) {
  const results = await search(term, country ? { country } : {});
  return results ? artworkUrl(results[0]) : null;
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

    // Strategy 1: Chinese title + Chinese artist against the CN store (best for C-pop)
    let coverUrl = null;
    if (song.title_zh) {
      coverUrl = await findCover(`${song.title_zh} ${song.artist_zh || song.artist_en || ''}`.trim(), 'CN');
    }

    // Strategy 2: English title + English artist, global store
    if (!coverUrl && song.title_en) {
      coverUrl = await findCover(`${song.title_en} ${song.artist_en || ''}`.trim());
    }

    // Strategy 3: just the Chinese title, global store (broader)
    if (!coverUrl && song.title_zh) {
      coverUrl = await findCover(song.title_zh);
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
