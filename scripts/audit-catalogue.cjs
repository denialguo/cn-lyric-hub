#!/usr/bin/env node
/**
 * Read-only catalogue health audit. Writes reports/catalogue-audit.json and prints a summary.
 *
 * READ ONLY: this script only calls .select(). It never inserts, updates, upserts, deletes or
 * calls an RPC, and scripts/audit-catalogue.test.cjs fails if that ever stops being true.
 *
 * Every table is paged past PostgREST's 1000-row cap and its row count is checked against the
 * server's exact count, so a short read aborts instead of producing a misleading report.
 * The report holds display names (submitted_by), so reports/ is gitignored.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ quiet: true });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const PAGE = 1000;
const REPORT = path.join('reports', 'catalogue-audit.json');

async function readAll(table, columns, order) {
  const { count, error: countError } = await db.from(table).select('*', { count: 'exact', head: true });
  if (countError) throw new Error(`${table}: count failed: ${countError.message}`);
  const rows = [];
  for (let from = 0; from < count; from += PAGE) {
    let query = db.from(table).select(columns);
    for (const column of order) query = query.order(column);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: read failed at offset ${from}: ${error.message}`);
    rows.push(...data);
  }
  if (rows.length !== count) throw new Error(`${table}: expected ${count} rows, read ${rows.length}. Catalogue changed mid-read; rerun.`);
  return rows;
}

async function main() {
  const { auditCatalogue, summarize, formatSummary } = await import('../src/lib/catalogueAudit.js');
  const [songs, artists, songArtists, lineTranslations, lineComments, songComments, submissions] = await Promise.all([
    readAll('songs', '*', ['id']),
    readAll('artists', 'id,name_en,name_zh', ['id']),
    readAll('song_artists', 'id,song_id,artist_id,role', ['song_id', 'artist_id']),
    readAll('line_translations', 'id,song_id', ['id']),
    readAll('line_comments', 'id,song_id', ['id']),
    readAll('comments', 'id,song_id', ['id']),
    readAll('song_submissions', 'id,original_song_id,status', ['id']),
  ]);
  const records = auditCatalogue({ songs, artists, songArtists, lineTranslations, lineComments, songComments, submissions });
  const summary = summarize(records);
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify({ generated_at: new Date().toISOString(), summary, songs: records }, null, 2));
  console.log(formatSummary(summary));
  console.log(`\nFull report: ${REPORT}`);
}

main().catch(error => {
  console.error('❌ Audit failed:', error.message);
  process.exit(1);
});
