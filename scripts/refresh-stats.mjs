import 'dotenv/config';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { buildCatalogueStats } from '../src/lib/catalogueStats.js';

dotenv.config({ path: '.env.local', quiet: true });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase URL or service role key');
const db = createClient(url, key, { auth: { persistSession: false } });
const rows = [];
let expected;
for (let from = 0; ; from += 1000) {
  const { data, error, count } = await db.from('songs')
    .select('id,title_zh,title_en,artist_en,artist_zh,lyrics_chinese,tags,slug,year,song_likes(count)', { count: 'exact' })
    .order('id').range(from, from + 999);
  if (error) throw error;
  expected ??= count;
  if (count !== expected) throw new Error('Catalogue changed during read; retry after the batch finishes');
  rows.push(...data);
  if (data.length < 1000) break;
}
if (rows.length !== expected) throw new Error('Incomplete catalogue; refusing to replace snapshot');
const counts = {};
for (const [table, name] of [['artists', 'artistCount'], ['line_translations', 'translationCount'], ['comments', 'commentCount']]) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  counts[name] = count;
}
const payload = { version: 1, ...buildCatalogueStats(rows, counts) };
const snapshot = { id: true, generated_at: new Date().toISOString(), payload };
// ponytail: paged REST reads are not a transactional snapshot; run after bulk jobs,
// or move reads into a snapshot RPC if concurrent catalogue churn becomes common.
if (!process.argv.includes('--dry-run')) {
  const { error } = await db.from('catalogue_stats_snapshot').upsert(snapshot);
  if (error) throw error;
}
console.log(`${process.argv.includes('--dry-run') ? 'Dry run' : 'Published'}: ${rows.length} songs, ${Buffer.byteLength(JSON.stringify(snapshot))} bytes`);
