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
 *
 * ⚠️ --refresh REWRITES existing years, including back to null when no confident
 * match exists. Take a backup first (`npm run backup`). It is for correcting the
 * reissue-date skew described in bestReleaseYear(); a plain run only fills nulls.
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
const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) : Infinity;

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
  console.log(`${refresh ? 'Re-evaluating' : 'Found'} ${songs.length} songs${refresh ? '' : ' without years'}, processing ${toProcess.length}\n`);

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
      // In --refresh mode an existing year with no confident match is cleared: a
      // wrong year is shown to readers as fact, a null renders as nothing.
      if (refresh && song.year) cleared++;
      console.log(`  ⬜ ${display}${refresh && song.year ? ` (clearing ${song.year})` : ''}`);
      notFound++;
    }

    if (!dryRun && (year || (refresh && song.year))) {
      const { error: writeError } = await supabase
        .from('songs').update({ year: year ?? null }).eq('id', song.id);
      // The old code ignored this, so a failed write counted as a success.
      if (writeError) console.error(`     ⚠️  write failed: ${writeError.message}`);
    }

    await sleep(1000);
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
