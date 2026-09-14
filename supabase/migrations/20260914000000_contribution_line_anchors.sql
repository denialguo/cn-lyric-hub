-- Apply before deploying the anchor-aware client. Refresh older open tabs.
-- Existing contributions intentionally remain NULL: their historical lyric is
-- unknown and must not be guessed from today's line index.
begin;
alter table public.line_translations add column if not exists original_line text;
alter table public.line_comments add column if not exists original_line text;

create or replace function public.guard_contribution_anchor()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  lyrics text;
  expected text;
  linked_song bigint;
  linked_index integer;
  linked_text text;
begin
  if tg_op = 'UPDATE' then
    if (new.song_id, new.line_index, new.original_line) is distinct from
       (old.song_id, old.line_index, old.original_line) then
      raise exception 'A contribution cannot be moved to another lyric.' using errcode = '22023';
    end if;
    if tg_table_name = 'line_comments' then
      -- Allow FK-triggered SET NULL when a parent is deleted, never retargeting.
      if (new.parent_id is distinct from old.parent_id and (new.parent_id is not null or pg_trigger_depth() = 1))
         or (new.translation_id is distinct from old.translation_id and (new.translation_id is not null or pg_trigger_depth() = 1)) then
        raise exception 'A reply cannot be moved to another thread.' using errcode = '22023';
      end if;
    end if;
    return new;
  end if;

  -- Serializes with song UPDATE so a stale browser cannot anchor to newer text.
  select lyrics_chinese into lyrics from public.songs where id = new.song_id for share;
  if not found then
    raise exception 'Song not found.' using errcode = '22023';
  end if;
  expected := (string_to_array(coalesce(lyrics, ''), E'\n'))[new.line_index + 1];
  if new.line_index is null or new.line_index < 0 or expected is null
     or new.original_line is null or new.original_line is distinct from expected then
    raise exception 'Lyrics changed or this page is outdated. Refresh before contributing; keep your draft.' using errcode = '22023';
  end if;

  if tg_table_name = 'line_comments' then
    if new.parent_id is not null then
      select song_id, line_index, original_line into linked_song, linked_index, linked_text
        from public.line_comments where id = new.parent_id;
      if not found or (linked_song, linked_index, linked_text) is distinct from
         (new.song_id, new.line_index, new.original_line) then
        raise exception 'This reply belongs to an earlier or different lyric.' using errcode = '22023';
      end if;
    end if;
    if new.translation_id is not null then
      select song_id, line_index, original_line into linked_song, linked_index, linked_text
        from public.line_translations where id = new.translation_id;
      if not found or (linked_song, linked_index, linked_text) is distinct from
         (new.song_id, new.line_index, new.original_line) then
        raise exception 'This translation belongs to an earlier or different lyric.' using errcode = '22023';
      end if;
    end if;
  end if;
  return new;
end $$;

-- The trigger needs row-lock access even though contributors cannot edit songs.
revoke all on function public.guard_contribution_anchor() from public, anon, authenticated;

drop trigger if exists contribution_anchor on public.line_translations;
create trigger contribution_anchor before insert or update on public.line_translations
  for each row execute function public.guard_contribution_anchor();
drop trigger if exists contribution_anchor on public.line_comments;
create trigger contribution_anchor before insert or update on public.line_comments
  for each row execute function public.guard_contribution_anchor();
notify pgrst, 'reload schema';
commit;
