-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/song_slug_aliases.sql
-- Slug change records the old slug, repeat change never chains, reclaiming a slug removes its alias.
begin;
set local plpgsql.check_asserts = on;

insert into public.songs (id, title_zh, artist_en, slug, lyrics_chinese)
values (900001, '测试', 'T', 'test-111', 'x') on conflict (id) do nothing;

update public.songs set slug = 'tester-test' where id = 900001;
do $$ begin
  assert (select song_id from public.song_slug_aliases where old_slug = 'test-111') = 900001, 'old slug recorded';
  assert not exists (select 1 from public.song_slug_aliases where old_slug = 'tester-test'), 'live slug is not an alias';
end $$;

update public.songs set slug = 'tester-test-2' where id = 900001;
do $$ begin
  assert (select count(*) from public.song_slug_aliases where song_id = 900001) = 2, 'both old slugs kept, pointing at the song';
end $$;

update public.songs set slug = 'test-111' where id = 900001;  -- rollback to the original
do $$ begin
  assert not exists (select 1 from public.song_slug_aliases where old_slug = 'test-111'), 'reclaimed slug leaves the alias table';
  assert (select count(*) from public.song_slug_aliases where song_id = 900001) = 2, 'the two newer slugs now redirect back';
end $$;

delete from public.songs where id = 900001;
do $$ begin assert not exists (select 1 from public.song_slug_aliases where song_id = 900001), 'aliases cascade'; end $$;
rollback;
