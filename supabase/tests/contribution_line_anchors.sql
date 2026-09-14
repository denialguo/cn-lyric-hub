-- Run in a disposable database with the app schema and migrations applied.
-- All fixtures roll back. Never run these broad setup tests in production.
begin;
set local plpgsql.check_asserts = on;
do $$
declare
  song bigint;
  translation uuid;
  comment_id uuid;
  reply_id uuid;
  bad text;
begin
  insert into public.songs(title_en, artist_en, slug, lyrics_chinese)
    values ('Anchor test', 'Anchor test', 'anchor-test-' || gen_random_uuid(), E'你好\n愛你') returning id into song;
  insert into public.line_translations(song_id, line_index, original_line, content)
    values(song, 1, '愛你', 'Love you') returning id into translation;
  insert into public.line_comments(song_id, line_index, original_line, content, translation_id)
    values(song, 1, '愛你', 'Translation discussion', translation) returning id into comment_id;
  insert into public.line_comments(song_id, line_index, original_line, content, parent_id)
    values(song, 1, '愛你', 'Reply', comment_id) returning id into reply_id;
  update public.line_comments set content = 'Edited comment' where id = comment_id;
  begin
    update public.line_comments set original_line = '伪造' where id = comment_id;
    assert false, 'anchor mutation accepted';
  exception when invalid_parameter_value then null; end;
  begin
    update public.line_comments set line_index = 0 where id = comment_id;
    assert false, 'line movement accepted';
  exception when invalid_parameter_value then null; end;
  -- Same line count, different text. Existing contributions retain old anchors.
  update public.songs set lyrics_chinese = E'愛你\n你好' where id = song;
  assert (select original_line = '愛你' from public.line_translations where id = translation);
  foreach bad in array array['愛你', null] loop
    begin
      insert into public.line_translations(song_id, line_index, original_line, content)
        values(song, 1, bad, 'Stale browser');
      assert false, 'stale or missing anchor accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    insert into public.line_comments(song_id, line_index, original_line, content, translation_id)
      values(song, 1, '你好', 'Wrong thread', translation);
    assert false, 'reply reattached to changed lyric';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.line_comments(song_id, line_index, original_line, content, parent_id)
      values(song, 1, '你好', 'Wrong parent', comment_id);
    assert false, 'reply reattached to changed parent lyric';
  exception when invalid_parameter_value then null; end;
  update public.songs set lyrics_chinese = '愛你' where id = song;
  begin
    insert into public.line_comments(song_id, line_index, original_line, content)
      values(song, 1, '你好', 'Deleted line');
    assert false, 'deleted line accepted';
  exception when invalid_parameter_value then null; end;
  assert (select original_line = '愛你' from public.line_comments where id = reply_id);
  -- FK SET NULL must still work when an author deletes a parent.
  delete from public.line_translations where id = translation;
  delete from public.line_comments where id = comment_id;
end $$;
rollback;
