-- Anchor the 10 pre-anchor contributions (Feb–Apr 2026) to their current lyric line.
-- Each was checked by hand against today's lyrics on 2026-09-27; ids are explicit so
-- nothing else is guessed. Paste into the SQL editor after 20260914000000.
-- The anchor trigger forbids retargeting on UPDATE, so it's disabled for this
-- transaction only (ALTER TABLE takes a lock, so no contributor write slips through).
alter table public.line_translations disable trigger contribution_anchor;
alter table public.line_comments disable trigger contribution_anchor;

update public.line_translations t
   set original_line = (string_to_array(s.lyrics_chinese, E'\n'))[t.line_index + 1]
  from public.songs s
 where s.id = t.song_id and t.original_line is null and t.id in (
   '58ebd616-f977-43e9-a275-50ebd6b1601f', 'bbf1a869-b507-4f76-8075-7755fd115529',
   '2d2bed78-315d-4fdc-a57c-4870c48b4350', '4186d275-3cb9-4ece-875e-62807dc3a280');

update public.line_comments c
   set original_line = (string_to_array(s.lyrics_chinese, E'\n'))[c.line_index + 1]
  from public.songs s
 where s.id = c.song_id and c.original_line is null and c.id in (
   '4bef68d6-16e7-4519-91ae-43d781d051e4', '32a1710c-b632-4d05-92ca-fb16ce1c400a',
   '9edd3cdb-b19a-43e5-845f-99fa585f3430', 'e61e174a-c7a1-4738-9c6d-970f03eaa800',
   '01228226-f4da-47fb-8a2a-0f678af5f5e7', '4c908b45-f1c7-4d9b-b59d-bc9cabe73040');

alter table public.line_translations enable trigger contribution_anchor;
alter table public.line_comments enable trigger contribution_anchor;
commit;

-- Expect 0 and 0.
select (select count(*) from public.line_translations where original_line is null) as translations_unanchored,
       (select count(*) from public.line_comments where original_line is null) as comments_unanchored;
