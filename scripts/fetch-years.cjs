/**
 * CN Lyric Hub — Bulk Release Year Fetcher
 * 
 * Uses iTunes Search API to find release years for songs missing year data.
 * 
 * Usage:
 *   node scripts/fetch-years.cjs
 *   node scripts/fetch-years.cjs --dry-run
 *   node scripts/fetch-years.cjs --limit 50
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) : Infinity;

const { search, sleep } = require('./itunes.cjs');

async function searchYear(title, artist) {
  const queries = [`${title} ${artist}`, title].filter(Boolean);

  for (const query of queries) {
    // CN store first, then fall back to global.
    const results = (await search(query.trim(), { country: 'CN' }))
      || (await search(query.trim()));

    const release = results?.[0]?.releaseDate;
    if (release) {
      const parsed = new Date(release);
      // Read the year in UTC — releaseDate is a UTC instant, and using local
      // time would report the wrong year for Jan 1 releases west of UTC.
      if (!Number.isNaN(parsed.valueOf())) return parsed.getUTCFullYear();
    }
    await sleep(500);
  }
  return null;
}

async function main() {
  console.log('\n📅 Release Year Fetcher\n');
  if (dryRun) console.log('🔍 DRY RUN\n');

  const { data: songs, error } = await supabase
    .from('songs')
    .select('id, title_zh, title_en, artist_en, artist_zh')
    .is('year', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌', error.message);
    process.exit(1);
  }

  const toProcess = songs.slice(0, limit);
  console.log(`Found ${songs.length} songs without years, processing ${toProcess.length}\n`);

  let found = 0, notFound = 0;

  for (const song of toProcess) {
    const title = song.title_zh || song.title_en || '';
    const artist = song.artist_zh || song.artist_en || '';
    const display = `${title} — ${artist || 'Unknown'}`;

    const year = await searchYear(title, artist);

    if (year) {
      console.log(`  ✅ ${display} → ${year}`);
      found++;

      if (!dryRun) {
        await supabase.from('songs').update({ year }).eq('id', song.id);
      }
    } else {
      console.log(`  ⬜ ${display}`);
      notFound++;
    }

    await sleep(1000);
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`✅ Found:    ${found}`);
  console.log(`⬜ No match: ${notFound}`);
  console.log(`${'='.repeat(40)}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
