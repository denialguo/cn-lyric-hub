/**
 * CN Lyric Hub — Bulk Release Year Fetcher
 * 
 * Uses iTunes Search API to find release years for songs missing year data.
 * 
 * Usage:
 *   node scripts/fetch-years.cjs
 *   node scripts/fetch-years.cjs --dry-run
 *   node scripts/fetch-years.cjs --limit 50
 *   node scripts/fetch-years.cjs --refresh    # re-evaluate songs that already have a year
 *   node scripts/fetch-years.cjs --refresh --delay 2500   # pace to avoid 429s
 *
 * --refresh REWRITES existing years, but only where a confident match is found;
 * an unmatchable song keeps whatever it had. Add --clear-unverified to null those
 * out instead — that costs about half the catalogue's coverage, so measure first.
 * Take a backup either way (`npm run backup`). A plain run only fills nulls.
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
const refresh = args.includes('--refresh');
// Clearing is opt-in, and deliberately so. Measured on a live run: 52% of songs
// produced no confident match — far worse than the 20% a Teresa Teng sample
// suggested, because live cuts, talk tracks and medleys dominate some
// catalogues. Clearing by default would have traded 1277 dated songs for ~600.
const clearUnverified = args.includes('--clear-unverified');
const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) : Infinity;
// Apple's guidance is ~20 requests/min and this path makes up to 2 per song, so
// the default 1000ms provokes constant 429s (126 in one full pass). Backing off
// is not just politeness — a throttled lookup falls back to a weaker query or
// gives up, which silently degrades the data it writes.
const delayArg = args.indexOf('--delay');
const delay = delayArg !== -1 ? parseInt(args[delayArg + 1]) : 1000;

const { search, sleep, bestReleaseYear } = require('./itunes.cjs');

async function searchYear(title, artists) {
  const primary = artists[0] || '';
  const queries = [`${title} ${primary}`, title].filter((q) => q.trim());

  for (const query of queries) {
    // limit=25, not the default 3: the original pressing is usually ranked below
    // the compilations, so a short result list never contains the right album.
    // CN store first, then fall back to global.
    const results = (await search(query.trim(), { country: 'CN', limit: 25 }))
      || (await search(query.trim(), { limit: 25 }));

    const year = bestReleaseYear(results, { title, artist: artists });
    if (year) return year;
    await sleep(500);
  }
  return null;
}

async function main() {
  console.log('\n📅 Release Year Fetcher\n');
  if (dryRun) console.log('🔍 DRY RUN\n');

  const songs = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from('songs')
      .select('id, title_zh, title_en, artist_en, artist_zh, year')
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    // --refresh re-reads everything; the default only fills the gaps.
    if (!refresh) query = query.is('year', null);

    const { data, error } = await query;
    if (error) {
      console.error('❌', error.message);
      process.exit(1);
    }
    songs.push(...data);
    if (data.length < 1000) break;
  }

  const toProcess = songs.slice(0, limit);
  console.log(`${refresh ? 'Re-evaluating' : 'Found'} ${songs.length} songs${refresh ? '' : ' without years'}, processing ${toProcess.length} at ${delay}ms spacing\n`);

  let found = 0, notFound = 0, corrected = 0, cleared = 0;

  for (const song of toProcess) {
    const title = song.title_zh || song.title_en || '';
    const artist = song.artist_zh || song.artist_en || '';
    const display = `${title} — ${artist || 'Unknown'}`;

    const year = await searchYear(title, [song.artist_zh, song.artist_en].filter(Boolean));

    if (year) {
      const delta = song.year && song.year !== year ? ` (was ${song.year})` : '';
      if (delta) corrected++;
      console.log(`  ✅ ${display} → ${year}${delta}`);
      found++;
    } else {
      // No confident match. Keep whatever the row had unless explicitly told to
      // clear: an unverifiable year may still be right, and a blank Classics tab
      // is a worse outcome than an approximate date.
      if (clearUnverified && song.year) cleared++;
      console.log(`  ⬜ ${display}${clearUnverified && song.year ? ` (clearing ${song.year})` : ''}`);
      notFound++;
    }

    if (!dryRun && (year || (clearUnverified && song.year))) {
      const { error: writeError } = await supabase
        .from('songs').update({ year: year ?? null }).eq('id', song.id);
      // The old code ignored this, so a failed write counted as a success.
      if (writeError) console.error(`     ⚠️  write failed: ${writeError.message}`);
    }

    await sleep(delay);
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`✅ Found:    ${found}`);
  console.log(`⬜ No match: ${notFound}`);
  if (refresh) {
    console.log(`✏️  Corrected: ${corrected}`);
    console.log(`🧹 Cleared:   ${cleared}`);
  }
  console.log(`${'='.repeat(40)}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
