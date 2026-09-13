// Only public, published activity: no likes, pending submissions, or updated_at
// (which also changes during cover/year maintenance).
const SOURCES = [
  ['songs', 'id', 'created_at'],
  ['song_revisions', 'song_id', 'revised_at'],
  ['line_translations', 'song_id', 'created_at'],
  ['line_comments', 'song_id', 'created_at'],
  ['comments', 'song_id', 'created_at'],
];

export async function recentActivityIds(client, limit) {
  const batchSize = Math.min(1000, Math.max(100, limit));
  const sources = await Promise.all(SOURCES.map(async ([table, songKey, timeKey]) => {
    const latest = new Map();
    // Repeated comments on one song must not hide activity on other songs.
    // ponytail: a very busy song can require many event pages; move this merge
    // to a database aggregate when community activity makes that costly.
    for (let from = 0; latest.size < limit; from += batchSize) {
      let query = client.from(table).select(`${songKey},${timeKey}`)
        .order(timeKey, { ascending: false, nullsFirst: false })
        .order(songKey, { ascending: false });
      if (songKey !== 'id') query = query.order('id', { ascending: false });
      const { data, error } = await query.range(from, from + batchSize - 1);
      if (error) throw error;
      for (const row of data || []) {
        const time = Date.parse(row[timeKey]);
        if (row[songKey] != null && Number.isFinite(time) && !latest.has(row[songKey])) {
          latest.set(row[songKey], time);
        }
        if (latest.size === limit) break;
      }
      if (!data || data.length < batchSize) break;
    }
    return latest;
  }));

  const latest = new Map();
  for (const source of sources) {
    for (const [id, time] of source) latest.set(id, Math.max(latest.get(id) ?? -Infinity, time));
  }
  return [...latest].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))
    .slice(0, limit).map(([id]) => id);
}
