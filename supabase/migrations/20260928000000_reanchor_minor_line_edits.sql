-- When a lyric line is only slightly edited, carry its translations and comments
-- over to the new text instead of leaving them under "Earlier contributions".
-- Apply after 20260914000000. Safe to re-run.
--
-- Rule (deliberately conservative): the edit keeps the same number of lines, and a
-- line counts as a minor edit when its shared prefix + shared suffix cover at least
-- 60% of the longer version. Anything else (reordered, rewritten, lines added or
-- removed) is left alone and stays archived exactly as before.
begin;

create or replace function public.is_minor_line_edit(a text, b text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  la int := char_length(coalesce(a, ''));
  lb int := char_length(coalesce(b, ''));
  m int := least(la, lb);
  p int := 0;
  s int := 0;
begin
  if a is null or b is null or a = b or m = 0 then return false; end if;
  while p < m and substr(a, p + 1, 1) = substr(b, p + 1, 1) loop p := p + 1; end loop;
  while s < m - p and substr(a, la - s, 1) = substr(b, lb - s, 1) loop s := s + 1; end loop;
  return (p + s) >= 0.6 * greatest(la, lb);
end $$;

-- Same guard as 20260914000000, plus a bypass used only by the trigger below.
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
    -- Only the songs re-anchor trigger (nested one level down) may move an anchor.
    if pg_trigger_depth() > 1 and current_setting('cnlyrics.reanchor', true) = 'on' then
      return new;
    end if;
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


create or replace function public.reanchor_minor_line_edits()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o text[] := string_to_array(coalesce(old.lyrics_chinese, ''), E'\n');
  n text[] := string_to_array(coalesce(new.lyrics_chinese, ''), E'\n');
  i int;
begin
  if array_length(o, 1) is distinct from array_length(n, 1) then return null; end if;
  perform set_config('cnlyrics.reanchor', 'on', true);
  for i in 1 .. coalesce(array_length(o, 1), 0) loop
    if public.is_minor_line_edit(o[i], n[i]) then
      update public.line_translations set original_line = n[i]
       where song_id = new.id and line_index = i - 1 and original_line = o[i];
      update public.line_comments set original_line = n[i]
       where song_id = new.id and line_index = i - 1 and original_line = o[i];
    end if;
  end loop;
  perform set_config('cnlyrics.reanchor', 'off', true);
  return null;
end $$;

revoke all on function public.is_minor_line_edit(text, text) from public, anon, authenticated;
revoke all on function public.reanchor_minor_line_edits() from public, anon, authenticated;

drop trigger if exists songs_reanchor on public.songs;
create trigger songs_reanchor after update of lyrics_chinese on public.songs
  for each row when (old.lyrics_chinese is distinct from new.lyrics_chinese)
  execute function public.reanchor_minor_line_edits();
notify pgrst, 'reload schema';
commit;
