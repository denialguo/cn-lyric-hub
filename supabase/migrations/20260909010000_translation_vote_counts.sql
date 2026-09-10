-- Deploy the app that reads line_votes(count) BEFORE applying this migration.
-- Column REVOKE alone does not override a table-level UPDATE grant.
-- https://www.postgresql.org/docs/current/sql-revoke.html
begin;
revoke update on public.line_translations from public, anon, authenticated;
revoke update (votes) on public.line_translations from public, anon, authenticated;
-- RLS still limits editing to the author. Anchors and attribution are immutable.
grant update (content, language) on public.line_translations to authenticated;

-- Counts ignore this legacy column, including values supplied on INSERT.
create index if not exists line_votes_translation_id_idx
  on public.line_votes (translation_id) where translation_id is not null;

do $$
begin
  if has_column_privilege('anon', 'public.line_translations', 'votes', 'UPDATE')
     or has_column_privilege('authenticated', 'public.line_translations', 'votes', 'UPDATE') then
    raise exception 'Client UPDATE on votes is still granted';
  end if;
end $$;
commit;
