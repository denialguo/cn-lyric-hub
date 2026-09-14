-- Run against a disposable database with the app schema and migrations applied:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/publish_song.sql
-- Exercises the actual RPC and revision trigger; all fixtures roll back.
begin;
set local plpgsql.check_asserts = on;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a01', 'publish-admin@example.invalid'),
  ('00000000-0000-0000-0000-000000000a02', 'publish-user@example.invalid');
insert into public.profiles (id, role) values
  ('00000000-0000-0000-0000-000000000a01', 'admin'),
  ('00000000-0000-0000-0000-000000000a02', 'user')
on conflict (id) do update set role = excluded.role;

-- Inject failures after earlier writes have succeeded, including a silent RLS
-- delete denial (a successful HTTP/SQL response alone would miss that case).
create function pg_temp.fail_publication_step() returns trigger language plpgsql as $$
begin
  if current_setting('test.publish_failure', true) = tg_table_name then
    raise exception 'injected publication failure';
  end if;
  return new;
end $$;
create trigger test_fail_link before insert on public.song_artists
  for each row execute function pg_temp.fail_publication_step();
create trigger test_fail_approval before update on public.song_submissions
  for each row execute function pg_temp.fail_publication_step();
create policy test_hide_link_deletes on public.song_artists as restrictive
  for delete to authenticated using (current_setting('test.hide_links', true) is distinct from 'on');

create function pg_temp.publication_state() returns jsonb language sql as $$
  select jsonb_build_array(
    (select jsonb_agg(to_jsonb(s) order by id) from public.songs s),
    (select jsonb_agg(to_jsonb(a) order by id) from public.artists a),
    (select jsonb_agg(to_jsonb(l) order by id) from public.song_artists l),
    (select jsonb_agg(to_jsonb(s) order by id) from public.song_submissions s),
    (select jsonb_agg(to_jsonb(r) order by id) from public.song_revisions r)
  )
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a01","is_anonymous":false}';

do $$
declare
  payload jsonb := '{"title_en":"Publication test", "title_zh":"测试", "slug":"publication-test", "lyrics_chinese":"原文", "submitted_by":"Admin"}';
  result jsonb;
  v_song_id bigint;
  v_artist_id uuid;
  submission_id uuid;
  selections jsonb;
  before_state jsonb;
  step text;
  review_id uuid;
  invalid jsonb;
begin
  result := public.publish_song(payload, '[{"name_en":"Publication Artist", "name_zh":"歌手"}]');
  v_song_id := (result ->> 'id')::bigint;
  select a.id into v_artist_id from public.artists a where a.name_en = 'Publication Artist';
  selections := jsonb_build_array(jsonb_build_object('id', v_artist_id), jsonb_build_object('id', v_artist_id));
  assert result ->> 'slug' = 'publication-test';
  assert (select count(*) = 1 from public.song_artists l where l.song_id = v_song_id);
  assert (select s.source = 'user' and s.cover_url = '' and s.submitted_by = 'Admin'
    and s.user_id = auth.uid() and s.artist_zh = '歌手' from public.songs s where id = v_song_id);

  -- Reuse names and deduplicate selections; edits preserve original ownership.
  perform public.publish_song(payload || '{"lyrics_chinese":"新文", "last_edited_by":"Editor", "user_id":null}',
    selections || '[{"name_en":"Publication Artist"}]', v_song_id);
  assert (select count(*) = 1 from public.song_artists l where l.song_id = v_song_id);
  assert (select s.submitted_by = 'Admin' and s.user_id = auth.uid() and s.last_edited_by = 'Editor'
    from public.songs s where id = v_song_id);
  assert (select count(*) = 1 from public.song_revisions r where r.song_id = v_song_id);
  assert (select snapshot ->> 'lyrics_chinese' = '原文' from public.song_revisions r where r.song_id = v_song_id);

  -- Both new publications and edit approvals must roll back every preceding
  -- write, including new artists and song revisions, at either failure point.
  foreach step in array array['song_artists', 'song_submissions'] loop
    foreach review_id in array array[null::uuid, gen_random_uuid()] loop
      insert into public.song_submissions (title_en, artist_en, status, original_song_id, submitted_by, user_id)
      values ('Review test', 'Publication Artist', case when review_id is null then 'pending' else 'pending_edit' end,
        case when review_id is null then null else v_song_id end, 'Contributor', '00000000-0000-0000-0000-000000000a02')
      returning id into submission_id;
      before_state := pg_temp.publication_state();
      perform set_config('test.publish_failure', step, true);
      begin
        perform public.publish_song(payload || jsonb_build_object('slug', 'rollback-' || submission_id, 'lyrics_chinese', '失败'),
          '[{"name_en":"Must Roll Back"}]', p_submission_id => submission_id);
        assert false, 'injected failure unexpectedly succeeded';
      exception when raise_exception then
        assert sqlerrm = 'injected publication failure', sqlerrm;
      end;
      perform set_config('test.publish_failure', '', true);
      assert pg_temp.publication_state() = before_state, 'partial publication survived rollback';
    end loop;
  end loop;

  -- RLS may make the obsolete-link delete affect zero rows without an error.
  before_state := pg_temp.publication_state();
  perform set_config('test.hide_links', 'on', true);
  begin
    perform public.publish_song(payload, '[{"name_en":"Hidden Delete Artist"}]', v_song_id);
    assert false, 'hidden delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.hide_links', '', true);
  assert pg_temp.publication_state() = before_state;

  -- Retry the failed edit approval. Its stored target and contributor win over
  -- client-supplied ownership/credit, and its old artist link is replaced.
  result := public.publish_song(payload || '{"lyrics_chinese":"已审核", "last_edited_by":"Wrong admin"}',
    '[{"name_en":"Replacement Artist"}]', p_submission_id => submission_id);
  assert (result ->> 'id')::bigint = v_song_id;
  assert (select status = 'approved' from public.song_submissions where id = submission_id);
  assert (select last_edited_by = 'Contributor' and submitted_by = 'Admin' from public.songs where id = v_song_id);
  assert (select count(*) = 1 from public.song_artists l where l.song_id = v_song_id);
  assert not exists (select 1 from public.song_artists l where l.song_id = v_song_id and l.artist_id = v_artist_id);

  -- New-song approval preserves submitter ownership too. A later attempt after
  -- a refresh/lost response cannot insert a second song for this submission.
  insert into public.song_submissions (title_en, artist_en, submitted_by, user_id)
    values ('New review', 'Publication Artist', 'Contributor', '00000000-0000-0000-0000-000000000a02') returning id into submission_id;
  result := public.publish_song(payload || '{"slug":"new-review"}', selections, p_submission_id => submission_id);
  assert (select submitted_by = 'Contributor' and last_edited_by = 'Contributor'
    and user_id = '00000000-0000-0000-0000-000000000a02' from public.songs where id = (result ->> 'id')::bigint);
  before_state := pg_temp.publication_state();
  begin
    perform public.publish_song(payload || '{"slug":"duplicate-review"}', selections, p_submission_id => submission_id);
    assert false, 'duplicate approval unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  assert pg_temp.publication_state() = before_state;
  update public.song_submissions set status = 'rejected'
    where id = submission_id and status in ('pending', 'pending_edit');
  assert not found, 'a stale reject overwrote approval';

  insert into public.song_submissions (title_en, artist_en, status)
    values ('Rejected review', 'Publication Artist', 'rejected') returning id into submission_id;
  before_state := pg_temp.publication_state();
  begin
    perform public.publish_song(payload, selections, p_submission_id => submission_id);
    assert false, 'rejected submission unexpectedly published';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.publish_song(payload, selections, v_song_id, submission_id);
    assert false, 'a review accepted a caller-selected target';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.publish_song(payload, selections, p_submission_id => gen_random_uuid());
    assert false, 'missing submission unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.publish_song(payload, selections, -1);
    assert false, 'missing song unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.publish_song(payload, jsonb_build_array(jsonb_build_object('id', gen_random_uuid())));
    assert false, 'missing artist unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  foreach invalid in array array['[]'::jsonb, 'null', '{}', '[null]', '[{"name_en":" "}]'] loop
    begin
      perform public.publish_song(payload, invalid);
      assert false, 'invalid artists unexpectedly succeeded';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    perform public.publish_song(payload, '[{"name_en":"Slug Collision Artist"}]');
    assert false, 'duplicate slug unexpectedly succeeded';
  exception when unique_violation then null;
  end;
  assert pg_temp.publication_state() = before_state;
end $$;

-- Exercise both real non-admins and anonymous sessions, including an anonymous
-- session whose profile happens to say admin. Neither may call this RPC.
do $$
declare claims text;
begin
  foreach claims in array array[
    '{"sub":"00000000-0000-0000-0000-000000000a02","is_anonymous":false}',
    '{"sub":"00000000-0000-0000-0000-000000000a01","is_anonymous":true}'
  ] loop
    perform set_config('request.jwt.claims', claims, true);
    begin
      perform public.publish_song('{}', '[]');
      assert false, 'non-admin publication unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.publish_song('{}', '[]');
    assert false, 'unauthenticated execution unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
