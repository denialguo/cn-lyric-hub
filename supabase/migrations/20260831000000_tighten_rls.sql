-- ============================================================================
-- Tighten row-level security.
--
-- Context: this app has no API server. The browser talks to PostgREST directly
-- with the publishable anon key, which Vite inlines into the JS bundle. That
-- key is public, so RLS is the only authorization layer that exists. Any check
-- in React (e.g. `profile?.role === 'admin'`) is UX, not security.
--
-- Fixes three verified holes:
--   1. songs      — UPDATE was reachable by the unauthenticated `anon` role,
--                   letting anyone with the bundle key rewrite the catalog.
--   2. profiles   — the own-row UPDATE policy covered the `role` column, so a
--                   visitor could set role='admin' on themselves and unlock
--                   the entire admin UI.
--   3. likes/votes— INSERT lacked `auth.uid() = user_id`, so likes and votes
--                   could be forged on behalf of other users.
--
-- Existing policy names are unknown (policies were created by hand in the
-- dashboard), so each block drops whatever is currently there for that
-- table+command before creating the replacement. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- helper: read the caller's current role without recursing into profiles' RLS
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer            -- bypasses RLS inside the function, so the policy
set search_path = public    -- below cannot recurse back into itself
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- 1. songs: public read, writes require a logged-in (incl. anonymous) session
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'songs' and cmd in ('UPDATE', 'DELETE')
  loop
    execute format('drop policy %I on public.songs', pol.policyname);
  end loop;
end $$;

alter table public.songs enable row level security;

create policy songs_update_authenticated on public.songs
  for update to authenticated
  using (true) with check (true);

-- No DELETE policy: nothing in the app deletes songs, so leave it denied.

-- ---------------------------------------------------------------------------
-- 2. profiles: own-row updates only, and `role` is frozen
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'
  loop
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end $$;

alter table public.profiles enable row level security;

create policy profiles_update_own_except_role on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role must come back out unchanged; promotion happens via the dashboard
    -- (service_role bypasses RLS entirely and is unaffected by this).
    and role is not distinct from public.current_profile_role()
  );

-- ---------------------------------------------------------------------------
-- 3. song_likes / line_votes / comment_votes: a row must belong to its author
--
-- Drops EVERY policy on these tables, not just the INSERT/DELETE ones: a policy
-- created as FOR ALL reports cmd = 'ALL' in pg_policies, so filtering by cmd
-- silently leaves it in place and the table stays wide open. Because that also
-- removes public read, the SELECT policies are recreated explicitly below.
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('song_likes', 'line_votes', 'comment_votes')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table public.song_likes    enable row level security;
alter table public.line_votes    enable row level security;
alter table public.comment_votes enable row level security;

-- public read: like counts and vote tallies render for logged-out visitors
create policy song_likes_select_all    on public.song_likes    for select using (true);
create policy line_votes_select_all    on public.line_votes    for select using (true);
create policy comment_votes_select_all on public.comment_votes for select using (true);

create policy song_likes_insert_own on public.song_likes
  for insert to authenticated with check (auth.uid() = user_id);
create policy song_likes_delete_own on public.song_likes
  for delete to authenticated using (auth.uid() = user_id);

create policy line_votes_insert_own on public.line_votes
  for insert to authenticated with check (auth.uid() = user_id);
create policy line_votes_delete_own on public.line_votes
  for delete to authenticated using (auth.uid() = user_id);

create policy comment_votes_insert_own on public.comment_votes
  for insert to authenticated with check (auth.uid() = user_id);
create policy comment_votes_delete_own on public.comment_votes
  for delete to authenticated using (auth.uid() = user_id);
