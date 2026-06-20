/**
 * CN Lyric Hub — Bulk Import Script
 * 
 * Usage:
 *   node scripts/import-lyrics.cjs ./path/to/Chinese_Lyrics --limit 100
 * 
 * Options:
 *   --limit N      Only import N songs (default: all)
 *   --artists "A,B" Only import from these artist folders (comma-separated, partial match)
 *   --dry-run      Preview what would be imported without touching the database
 * 
 * Expects folder structure:
 *   ArtistName_ID/
 *     SongTitle_SongID.txt
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { pinyin } = require('pinyin-pro');
require('dotenv').config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' });

// --- CONFIG ---
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  No SUPABASE_SERVICE_ROLE_KEY found — using anon key. This may fail due to RLS policies.');
  console.warn('   Add SUPABASE_SERVICE_ROLE_KEY to your .env.local (find it in Supabase → Settings → API)\n');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- PARSE CLI ARGS ---
const args = process.argv.slice(2);
const inputDir = args.find(a => !a.startsWith('--'));
const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) : Infinity;
const artistFilterArg = args.indexOf('--artists');
const artistFilter = artistFilterArg !== -1 
  ? args[artistFilterArg + 1].split(',').map(s => s.trim().toLowerCase()) 
  : null;
const dryRun = args.includes('--dry-run');

if (!inputDir || !fs.existsSync(inputDir)) {
  console.error('❌ Usage: node scripts/import-lyrics.cjs ./path/to/Chinese_Lyrics [--limit N] [--artists "name1,name2"] [--dry-run]');
  process.exit(1);
}

// --- HELPERS ---
function parseArtistFolder(folderName) {
  // "C_AllStar_2312" → artist: "C AllStar", id: "2312"
  // "G.E.M.邓紫棋_7763" → artist: "G.E.M.邓紫棋", id: "7763"
  const lastUnderscore = folderName.lastIndexOf('_');
  if (lastUnderscore === -1) return { name: folderName, netease_id: null };
  
  const name = folderName.substring(0, lastUnderscore).replace(/_/g, ' ');
  const netease_id = folderName.substring(lastUnderscore + 1);
  return { name, netease_id };
}

function parseSongFile(fileName) {
  // "切肤之痛_28310579.txt" → title: "切肤之痛", id: "28310579"
  // "hui_se_gui_ji_-_album_version_28310579.txt" → title: "hui se gui ji - album version"
  const withoutExt = fileName.replace('.txt', '');
  const lastUnderscore = withoutExt.lastIndexOf('_');
  if (lastUnderscore === -1) return { title: withoutExt, netease_id: null };

  const rawTitle = withoutExt.substring(0, lastUnderscore);
  const netease_id = withoutExt.substring(lastUnderscore + 1);
  // Replace underscores with spaces for cleaner display
  const title = rawTitle.replace(/_/g, ' ').trim();
  return { title, netease_id };
}

function generateSlug(title) {
  // Try to romanize Chinese, fall back to random
  let slug;
  try {
    slug = pinyin(title, { toneType: 'none', nonZh: 'consecutive', separator: '-' })
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  } catch {
    slug = 'song';
  }
  if (!slug) slug = 'song';
  return slug + '-' + Math.floor(Math.random() * 10000);
}

function generatePinyin(lyrics) {
  return lyrics.split('\n').map(line => {
    if (!line.trim()) return '';
    const clean = line
      .replace(/，/g, ',').replace(/。/g, '.').replace(/！/g, '!')
      .replace(/？/g, '?').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Split into Chinese vs non-Chinese segments, only convert Chinese
    return clean.split(/([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+)/g).map(segment => {
      if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(segment)) {
        return pinyin(segment, { toneType: 'symbol' });
      }
      return segment;
    }).join('');
  }).join('\n');
}

// --- MAIN ---
async function main() {
  console.log(`\n📂 Reading from: ${inputDir}`);
  if (dryRun) console.log('🔍 DRY RUN — no database writes\n');

  const artistFolders = fs.readdirSync(inputDir)
    .filter(f => fs.statSync(path.join(inputDir, f)).isDirectory());

  console.log(`Found ${artistFolders.length} artist folders\n`);

  // Cache existing artists to avoid duplicates
  const { data: existingArtists } = await supabase.from('artists').select('id, name_en, name_zh');
  const artistCache = new Map();
  (existingArtists || []).forEach(a => {
    if (a.name_en) artistCache.set(a.name_en.toLowerCase(), a.id);
    if (a.name_zh) artistCache.set(a.name_zh.toLowerCase(), a.id);
  });

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const folder of artistFolders) {
    if (imported >= limit) break;

    const { name: artistName } = parseArtistFolder(folder);

    // Apply artist filter if specified
    if (artistFilter && !artistFilter.some(f => artistName.toLowerCase().includes(f))) {
      continue;
    }

    // Determine if artist name is Chinese, English, or mixed
    const hasChinese = /[\u4e00-\u9fff]/.test(artistName);
    const artistNameEn = hasChinese ? '' : artistName;
    const artistNameZh = hasChinese ? artistName : '';

    // Find or create artist
    let artistId = artistCache.get(artistName.toLowerCase());

    if (!artistId && !dryRun) {
      const artistSlug = artistName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Math.floor(Math.random() * 1000);
      const { data: newArtist, error } = await supabase
        .from('artists')
        .insert({ name_en: artistNameEn || artistName, name_zh: artistNameZh, slug: artistSlug })
        .select()
        .single();

      if (error) {
        console.error(`  ❌ Failed to create artist "${artistName}": ${error.message}`);
        continue;
      }
      artistId = newArtist.id;
      artistCache.set(artistName.toLowerCase(), artistId);
    }

    // Read song files
    const songFiles = fs.readdirSync(path.join(inputDir, folder))
      .filter(f => f.endsWith('.txt'));

    console.log(`🎤 ${artistName} (${songFiles.length} songs)`);

    for (const file of songFiles) {
      if (imported >= limit) break;

      const { title } = parseSongFile(file);
      const lyrics = fs.readFileSync(path.join(inputDir, folder, file), 'utf-8').trim();

      if (!lyrics) {
        skipped++;
        continue;
      }

      // Check for existing song with same title + artist
      const checkArtist = artistNameEn || artistNameZh || artistName;
      const { data: existing } = await supabase
        .from('songs')
        .select('id')
        .eq('title_zh', title)
        .eq('artist_en', checkArtist)
        .limit(1)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const slug = generateSlug(title);
      const lyricsPinyin = generatePinyin(lyrics);

      if (dryRun) {
        console.log(`  📝 ${title} → ${slug} (${lyrics.split('\n').length} lines)`);
        imported++;
        continue;
      }

      // Insert song
      const { data: song, error: songError } = await supabase
        .from('songs')
        .insert({
          title_zh: title,
          title_en: '',
          artist_en: artistNameEn || artistName,
          artist_zh: artistNameZh,
          lyrics_chinese: lyrics,
          lyrics_pinyin: lyricsPinyin,
          lyrics_english: '',
          slug,
          cover_url: '',
          youtube_url: '',
          tags: [],
          source: 'import',
        })
        .select()
        .single();

      if (songError) {
        // Likely a duplicate slug — try once more with a different slug
        if (songError.message.includes('duplicate') || songError.message.includes('unique')) {
          skipped++;
          continue;
        }
        console.error(`  ❌ ${title}: ${songError.message}`);
        errors++;
        continue;
      }

      // Link artist
      if (artistId && song) {
        await supabase.from('song_artists').insert({ 
          song_id: song.id, 
          artist_id: artistId, 
          role: 'main' 
        });
      }

      console.log(`  ✅ ${title}`);
      imported++;
    }
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭️  Skipped:  ${skipped}`);
  console.log(`❌ Errors:   ${errors}`);
  console.log(`${'='.repeat(40)}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
