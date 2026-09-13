// A song write precedes this step. Never announce completion until its artist
// links and (for reviews) the contributor's submission status are saved too.
export async function finishSongSave(client, songId, artistIds, submissionId) {
  const ids = [...new Set(artistIds)];
  if (!ids.length) throw new Error('Choose at least one artist before saving.');
  const { error: linkError } = await client.from('song_artists')
    .upsert(ids.map(artist_id => ({ song_id: songId, artist_id })), { onConflict: 'song_id,artist_id', ignoreDuplicates: true });
  if (linkError) throw linkError;

  // Add the desired links before removing old ones, so an insert failure cannot
  // strip every artist from a published song.
  const { error: cleanupError } = await client.from('song_artists').delete()
    .eq('song_id', songId).not('artist_id', 'in', `(${ids.join(',')})`);
  if (cleanupError) throw cleanupError;

  if (submissionId != null) {
    const { error } = await client.from('song_submissions').update({ status: 'approved' })
      .eq('id', submissionId).select('id').single();
    if (error) throw error;
  }
}
