// Returns false on cancellation; read errors throw so an unverified edit cannot save.
export async function confirmLineEdit(supabase, targetSongId, lyrics, confirm) {
  if (!targetSongId) return true;
  // Read the current live version, including when approving an older submission.
  const { data: current, error } = await supabase.from('songs')
    .select('lyrics_chinese').eq('id', targetSongId).single();
  if (error) throw error;
  if ((current.lyrics_chinese || '').split('\n').length !== (lyrics || '').split('\n').length) {
    const counts = await Promise.all(['line_translations', 'line_comments'].map(table =>
      supabase.from(table).select('*', { count: 'exact', head: true }).eq('song_id', targetSongId)
    ));
    for (const result of counts) if (result.error) throw result.error;
    const [translations, comments] = counts.map(result => result.count);
    // ponytail: count-only warning misses same-length reorders; stable line IDs are the upgrade.
    if ((translations || comments) && !await confirm(
      `Changing the lyric line count may attach ${translations} community translations and ${comments} line comments to the wrong lyrics. Continue without remapping?`,
      { destructive: true, confirmLabel: 'Save anyway' }
    )) return false;
  }

  return true;
}
