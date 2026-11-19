-- Preserve per-artist identity on submissions so review never has to reconstruct
-- bilingual names from the lossy comma-separated artist_en / artist_zh display fields.
begin;

alter table public.song_submissions
  add column if not exists artist_data jsonb;

alter table public.song_submissions
  drop constraint if exists song_submissions_artist_data_is_array;

alter table public.song_submissions
  add constraint song_submissions_artist_data_is_array
  check (artist_data is null or jsonb_typeof(artist_data) = 'array');

comment on column public.song_submissions.artist_data is
  'Structured artist selections for review; legacy artist_en/artist_zh remain display strings.';

commit;
