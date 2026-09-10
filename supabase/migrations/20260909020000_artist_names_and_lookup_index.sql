-- REVIEW REQUIRED: targeted production edits, not applied by the agent.
-- UUIDs and old values verified with read-only queries on 2026-09-09.
begin;
do $$
declare changed integer;
begin
  update public.artists a
  set name_en = v.name_en, name_zh = v.name_zh
  from (values
    ('aa7b37e9-a4a8-480c-8765-9acbedd42a74'::uuid, '林俊杰', '林俊杰', 'JJ Lin', '林俊杰'),
    ('a591375b-95ee-43fe-9855-dd9be4110e1d'::uuid, '', 'SING女團', 'SING', 'SING女團'),
    ('0aee1a65-7c9c-4af1-b370-741b7458ff33'::uuid, '王菲', '王菲', 'Faye Wong', '王菲'),
    ('16f2e48b-8691-4412-8964-b63c9a504021'::uuid, '陈奕迅', '陈奕迅', 'Eason Chan', '陈奕迅'),
    ('bd296979-866e-4042-a88d-aaf7bf35d17b'::uuid, '邓丽君', '邓丽君', 'Teresa Teng', '邓丽君')
  ) as v(id, old_en, old_zh, name_en, name_zh)
  where a.id = v.id and a.name_en = v.old_en and a.name_zh = v.old_zh;
  get diagnostics changed = row_count;
  if changed <> 5 then
    raise exception 'Expected 5 artist rows, changed %. Recheck current names.', changed;
  end if;
end $$;
create index if not exists song_artists_artist_id_idx on public.song_artists (artist_id);
commit;
