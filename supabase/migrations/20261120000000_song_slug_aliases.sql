-- Slug history. songs.slug is the persistent public identifier; when it changes, the old slug is
-- kept here so the old URL can 301 to the current one (vercel.json redirects, plus an in-app
-- fallback in SongPage). Rollout order for the slug migration:
--   1. paste this file into the Supabase SQL editor
--   2. npm run backup, then npm run migrate:slugs (dry run), review, then -- --write
--   3. npm run redirects:sync, commit vercel.json, push (the build re-prerenders new slugs)
-- Aliases point at song_id, not at a slug, so there are never redirect chains.
begin;

create unique index if not exists songs_slug_key on public.songs (slug);

create table if not exists public.song_slug_aliases (
  old_slug text primary key check (old_slug <> ''),
  song_id bigint not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists song_slug_aliases_song_id_idx on public.song_slug_aliases (song_id);

alter table public.song_slug_aliases enable row level security;
drop policy if exists "slug aliases are public" on public.song_slug_aliases;
create policy "slug aliases are public" on public.song_slug_aliases for select to anon, authenticated using (true);
-- No insert/update/delete policy: only the trigger below (and the service role) writes aliases.
revoke all on public.song_slug_aliases from anon, authenticated;
grant select on public.song_slug_aliases to anon, authenticated;

create or replace function public.record_slug_alias() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(old.slug, '') <> '' and new.slug is distinct from old.slug then
    insert into public.song_slug_aliases (old_slug, song_id) values (old.slug, new.id)
    on conflict (old_slug) do update set song_id = excluded.song_id;
  end if;
  -- a slug that is live again is no longer an alias (also what makes a rollback clean)
  delete from public.song_slug_aliases where old_slug = new.slug;
  return new;
end $$;

drop trigger if exists songs_record_slug_alias on public.songs;
create trigger songs_record_slug_alias after update of slug on public.songs
  for each row execute function public.record_slug_alias();

commit;
