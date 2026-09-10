-- ============================================================================
-- Song edit history: immutable snapshots of the PREVIOUS version of a song,
-- captured by the database itself.
--
-- APPLIED 2026-09-09 by Daniel in the SQL editor. This file records what was
-- run so the schema change is in version control. Safe to re-run.
--
-- WHY A TRIGGER AND NOT APP CODE: every edit path ends in `update public.songs`
-- — EditSongPage's admin branch, its review/approve branch, and the service-role
-- backfill scripts. A trigger is the only capture point that covers all three,
-- and it is atomic with the edit by construction. No client writes this table.
--
-- WHAT THIS DOES NOT DO: it does not make restore safe. Community translations
-- and line comments anchor by `line_index` into `lyrics_chinese` split on '\n'.
-- `confirmLineEdit` only warns when the line COUNT changes, so restoring a
-- revision that reorders or rewords lines at the same length silently reattaches
-- every contribution to different lyrics. Stable anchors come before restore.
-- ============================================================================

create table if not exists public.song_revisions (
  id bigserial primary key,
  song_id bigint not null references public.songs(id) on delete cascade,
  snapshot jsonb not null,          -- the whole songs row as it was, pre-edit
  revised_at timestamptz not null default now()
);

-- The only access pattern: one song's history, newest first.
create index if not exists song_revisions_song_id_idx
  on public.song_revisions (song_id, revised_at desc);

-- Readable by everyone (history is public, like the songs themselves); written
-- by nobody. The REVOKE is what makes it immutable — RLS alone would still let a
-- DELETE report success against zero visible rows.
alter table public.song_revisions enable row level security;
revoke all on public.song_revisions from public, anon, authenticated;
grant select on public.song_revisions to anon, authenticated;
grant usage, select on sequence public.song_revisions_id_seq to service_role;

drop policy if exists song_revisions_read on public.song_revisions;
create policy song_revisions_read on public.song_revisions
  for select using (true);

-- security definer so the insert succeeds despite the REVOKE above.
create or replace function public.snapshot_song()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Content columns ONLY. cover_url and year are excluded deliberately: a
  -- fetch-covers or fetch-years pass over the catalogue would otherwise write
  -- one revision per row touched (~49k if the full corpus is ever imported).
  -- The snapshot still contains those columns; they just don't trigger one.
  if (old.lyrics_chinese, old.lyrics_pinyin, old.lyrics_english, old.title_zh,
      old.title_en, old.artist_en, old.artist_zh, old.bio, old.credits)
     is distinct from
     (new.lyrics_chinese, new.lyrics_pinyin, new.lyrics_english, new.title_zh,
      new.title_en, new.artist_en, new.artist_zh, new.bio, new.credits) then
    insert into public.song_revisions (song_id, snapshot) values (old.id, to_jsonb(old));
  end if;
  return new;
end $$;

drop trigger if exists songs_snapshot on public.songs;
create trigger songs_snapshot before update on public.songs
  for each row execute function public.snapshot_song();

-- ---------------------------------------------------------------------------
-- Verified live 2026-09-09 against ONE disposable song, deleted by exact id
-- (16/16 checks): INSERT writes no revision; year-only and cover-only updates
-- write none; a lyric edit writes exactly one holding the PREVIOUS text; a
-- second edit appends; a no-op write adds nothing; each snapshot carries the
-- `last_edited_by` that produced that version; anon cannot insert, rewrite, or
-- delete a revision; revisions cascade-delete with their song.
-- The immutability half is now permanent regression cover in verify-rls.cjs.
-- ---------------------------------------------------------------------------
