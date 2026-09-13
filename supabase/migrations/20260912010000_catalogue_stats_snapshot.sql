-- Apply, then run npm run stats:refresh BEFORE deploying the snapshot reader.
begin;
create table public.catalogue_stats_snapshot (
  id boolean primary key default true check (id),
  generated_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and (payload->>'version' = '1') is true)
);
alter table public.catalogue_stats_snapshot enable row level security;
revoke all on public.catalogue_stats_snapshot from public, anon, authenticated;
grant select on public.catalogue_stats_snapshot to anon, authenticated;
grant select, insert, update on public.catalogue_stats_snapshot to service_role;
create policy catalogue_stats_read on public.catalogue_stats_snapshot
  for select to anon, authenticated using (true);
commit;
