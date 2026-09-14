-- Apply in the Supabase SQL editor BEFORE deploying the RPC-based save handlers.
-- Requires the existing admin-write RLS migration. Safe to re-run; no data backfill.
-- Refresh open admin tabs after deployment so they use the new save handlers.
-- Each PostgREST RPC runs in one transaction: any error rolls back artists,
-- song content (and its revision trigger), links, and submission approval.
begin;

create or replace function public.publish_song(
  p_song jsonb,
  p_artists jsonb,
  p_song_id bigint default null,
  p_submission_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft public.songs;
  submission public.song_submissions;
  artist public.artists;
  entry jsonb;
  artist_ids uuid[] := '{}';
  english_names text[] := '{}';
  chinese_names text[] := '{}';
  target_id bigint := p_song_id;
  editor_name text;
begin
  -- Anonymous Supabase sessions also hold the authenticated role.
  if public.is_admin() is not true then
    raise exception 'Only admins can publish songs.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_song) is distinct from 'object'
     or jsonb_typeof(p_artists) is distinct from 'array' then
    raise exception 'Song and artists must be an object and an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_artists) = 0 then
    raise exception 'Choose at least one artist before saving.' using errcode = '22023';
  end if;

  draft := jsonb_populate_record(null::public.songs, p_song);
  if coalesce(btrim(draft.title_en), '') = '' and coalesce(btrim(draft.title_zh), '') = '' then
    raise exception 'Please add a song title.' using errcode = '22023';
  end if;
  if coalesce(btrim(draft.slug), '') = '' then
    raise exception 'A song slug is required.' using errcode = '22023';
  end if;
  editor_name := coalesce(nullif(draft.last_edited_by, ''), nullif(draft.submitted_by, ''), 'Community');

  if p_submission_id is not null then
    if p_song_id is not null then
      raise exception 'A review takes its target from the submission.' using errcode = '22023';
    end if;
    -- Concurrent approvals wait here, then see the committed approved status.
    select * into submission from public.song_submissions where id = p_submission_id for update;
    if not found then
      raise exception 'Submission not found or unavailable.' using errcode = 'P0002';
    end if;
    if submission.status is distinct from
       (case when submission.original_song_id is null then 'pending' else 'pending_edit' end) then
      raise exception 'This submission has already been reviewed or is not pending.' using errcode = '22023';
    end if;
    target_id := submission.original_song_id;
    editor_name := coalesce(nullif(submission.submitted_by, ''), 'Community');
  end if;

  if target_id is not null then
    -- Serialize replacement of a song's complete artist set with its content.
    perform 1 from public.songs where id = target_id for update;
    if not found then
      raise exception 'Song not found or unavailable.' using errcode = 'P0002';
    end if;
  end if;

  for entry in select value from jsonb_array_elements(p_artists) loop
    if jsonb_typeof(entry) is distinct from 'object' then
      raise exception 'Each artist must be an object.' using errcode = '22023';
    end if;
    if entry ->> 'id' is not null then
      select * into artist from public.artists where id = (entry ->> 'id')::uuid;
      if not found then
        raise exception 'A selected artist no longer exists.' using errcode = 'P0002';
      end if;
    else
      if coalesce(btrim(entry ->> 'name_en'), '') = '' then
        raise exception 'A new artist needs a name.' using errcode = '22023';
      end if;
      select * into artist from public.artists
        where name_en = btrim(entry ->> 'name_en') order by id limit 1;
      if not found then
        insert into public.artists (name_en, name_zh, slug)
        values (btrim(entry ->> 'name_en'), coalesce(entry ->> 'name_zh', ''),
          regexp_replace(lower(btrim(entry ->> 'name_en')), '[^a-z0-9]', '-', 'g') || '-' || gen_random_uuid()::text)
        returning * into artist;
        if not found then
          raise exception 'Could not create the artist.';
        end if;
      end if;
    end if;
    if not (artist.id = any(artist_ids)) then
      artist_ids := array_append(artist_ids, artist.id);
      english_names := array_append(english_names, coalesce(nullif(artist.name_en, ''), artist.name_zh, ''));
      chinese_names := array_append(chinese_names, coalesce(artist.name_zh, ''));
    end if;
  end loop;

  -- Explicit column lists keep IDs, ownership, timestamps, and submission-only
  -- fields out of updates. Artist display names come from the resolved rows.
  if target_id is null then
    insert into public.songs (
      title_en, title_zh, artist_en, artist_zh, slug, lyrics_chinese, lyrics_pinyin,
      lyrics_english, cover_url, youtube_url, tags, bio, credits, year, source,
      submitted_by, last_edited_by, user_id
    ) values (
      coalesce(draft.title_en, ''), draft.title_zh,
      array_to_string(english_names, ', '), array_to_string(chinese_names, ', '), draft.slug,
      draft.lyrics_chinese, draft.lyrics_pinyin, draft.lyrics_english,
      coalesce(draft.cover_url, ''), draft.youtube_url, draft.tags, draft.bio, draft.credits, draft.year, 'user',
      editor_name, case when p_submission_id is not null then editor_name end,
      case when p_submission_id is not null then submission.user_id else auth.uid() end
    ) returning id into target_id;
  else
    update public.songs set
      title_en = coalesce(draft.title_en, ''), title_zh = draft.title_zh,
      artist_en = array_to_string(english_names, ', '), artist_zh = array_to_string(chinese_names, ', '),
      slug = draft.slug, lyrics_chinese = draft.lyrics_chinese, lyrics_pinyin = draft.lyrics_pinyin,
      lyrics_english = draft.lyrics_english, cover_url = coalesce(draft.cover_url, ''),
      youtube_url = draft.youtube_url, tags = draft.tags, bio = draft.bio, credits = draft.credits,
      year = draft.year, source = 'user', last_edited_by = editor_name
    where id = target_id;
  end if;
  if not found then
    raise exception 'Could not save the song.' using errcode = '42501';
  end if;

  insert into public.song_artists (song_id, artist_id, role)
    select target_id, id, 'main' from unnest(artist_ids) as ids(id)
    on conflict (song_id, artist_id) do nothing;
  delete from public.song_artists where song_id = target_id and not (artist_id = any(artist_ids));

  -- RLS can silently hide a DELETE target. Verify the complete resulting set.
  if (select array_agg(artist_id order by artist_id) from public.song_artists where song_id = target_id)
     is distinct from (select array_agg(id order by id) from unnest(artist_ids) as ids(id)) then
    raise exception 'Could not save all artist links.' using errcode = '42501';
  end if;

  if p_submission_id is not null then
    update public.song_submissions set status = 'approved' where id = p_submission_id
      returning * into submission;
    if not found or submission.status is distinct from 'approved' then
      raise exception 'Could not approve the submission.' using errcode = '42501';
    end if;
  end if;
  return jsonb_build_object('id', target_id, 'slug', draft.slug);
end;
$$;

revoke all on function public.publish_song(jsonb, jsonb, bigint, uuid) from public, anon;
grant execute on function public.publish_song(jsonb, jsonb, bigint, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
