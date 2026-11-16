-- Run in a disposable database with the app schema and migrations applied. Rolls back.
begin;
do $$
declare song bigint; t_minor uuid; t_swap uuid; c_minor uuid;
begin
  insert into public.songs(title_en, artist_en, slug, lyrics_chinese)
    values ('Reanchor test', 'Reanchor test', 'reanchor-test-' || gen_random_uuid(), E'我们一起走过很多年\n你好\n愛你') returning id into song;
  insert into public.line_translations(song_id, line_index, original_line, content) values (song, 0, '我们一起走过很多年', 'a') returning id into t_minor;
  insert into public.line_translations(song_id, line_index, original_line, content) values (song, 1, '你好', 'b') returning id into t_swap;
  insert into public.line_comments(song_id, line_index, original_line, content) values (song, 0, '我们一起走过很多年', 'c') returning id into c_minor;
  update public.songs set lyrics_chinese = E'我们一起走过许多年\n愛你\n你好' where id = song;
  assert (select original_line = '我们一起走过许多年' from public.line_translations where id = t_minor), 'minor edit not carried over';
  assert (select original_line = '我们一起走过许多年' from public.line_comments where id = c_minor), 'comment not carried over';
  assert (select original_line = '你好' from public.line_translations where id = t_swap), 'reordered line must stay archived';
  begin
    update public.line_translations set original_line = '伪造' where id = t_minor;
    assert false, 'direct anchor move accepted';
  exception when invalid_parameter_value then null; end;
  update public.songs set lyrics_chinese = E'一\n二' where id = song;
  assert (select original_line = '我们一起走过许多年' from public.line_translations where id = t_minor), 'line-count change must not re-anchor';
end $$;
rollback;
