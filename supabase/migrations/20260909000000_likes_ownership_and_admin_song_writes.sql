-- ============================================================================
-- Close the two holes the 2026-09-09 audit verified live, and add the indexes
-- every list query needs.
--
-- Apply by pasting into the Supabase SQL editor, then run `npm run verify:rls`.
-- Safe to re-run.
--
-- Context: there is no API server. The browser talks to PostgREST with the
-- publishable anon key, which Vite inlines into the bundle. RLS is the ONLY
-- authorization layer. `profile?.role === 'admin'` in React is UX, not security.
--
-- ⚠️ THE TRAP THIS FIXES, STATED PLAINLY: in Supabase, an *anonymous* session
--    has the Postgres role `authenticated`. So `to authenticated` does NOT mean
--    "has a real account" — it includes every throwaway visitor. The previous
--    migration's `songs_update_authenticated` therefore let anyone with the
--    bundle key rewrite the entire catalogue. Verified by probe, not assumed.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------

-- Already created by 20260831000000, repeated here so this file stands alone.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer            -- bypasses RLS inside the function, so a policy
set search_path = public    -- using it cannot recurse into itself
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- True only for a signed-in account, never a lazy anonymous session.
-- auth.jwt() ->> 'is_anonymous' is the only reliable signal for this.
create or replace function public.is_real_account()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is not true
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.is_real_account() and public.current_profile_role() = 'admin'
$$;


-- ---------------------------------------------------------------------------
-- 1. song_likes — VERIFIED HOLE
--
-- The probe inserted a like with someone else's user_id and got 201, both with
-- a throwaway session AND with no auth at all (raw anon key). Anyone could
-- inflate like counts on any song, attributed to any real user — and likes feed
-- the Trending tab and the stats page.
--
-- Drops EVERY policy on the table rather than filtering by cmd: a policy created
-- as FOR ALL reports cmd = 'ALL', so filtering by cmd silently leaves it in
-- place and the table stays open. Public SELECT is recreated explicitly.
--
-- Note anonymous visitors can still like things — that is intended. They hold
-- the `authenticated` role, so they satisfy these policies; what they can no
-- longer do is claim a like belongs to a different user.
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'song_likes'
  loop
    execute format('drop policy %I on public.song_likes', pol.policyname);
  end loop;
end $$;

alter table public.song_likes enable row level security;

-- like counts must render for logged-out visitors
create policy song_likes_select_all on public.song_likes
  for select using (true);

create policy song_likes_insert_own on public.song_likes
  for insert to authenticated with check (auth.uid() = user_id);

create policy song_likes_delete_own on public.song_likes
  for delete to authenticated using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 2. songs — VERIFIED HOLE
--
-- The probe rewrote a real song's lyrics from a throwaway anonymous session.
-- Direct writes are now admin-only; everyone else routes through
-- song_submissions for review, which is what the UI already does as of the
-- matching app change. Confirmed before applying this: anonymous sessions and
-- fully unauthenticated visitors can both still INSERT into song_submissions,
-- so the review path does not break.
--
-- ⚠️ Only ONE account is currently admin: danielguo1098@gmail.com
--    (profiles.id = 55c256da-5161-4210-a034-f5f6d5b8e122).
--    danieldenialdeveloping@gmail.com is NOT. After this migration, that second
--    account can no longer edit songs directly — its edits become submissions.
--    To promote it, run (as service_role / in the SQL editor):
--      update public.profiles set role = 'admin'
--       where id = 'd090e155-80e7-40e2-a6b6-f673fdf20c6a';
--    The profiles UPDATE policy freezes `role`, so this cannot be done from the
--    app — only here or from the dashboard. That is deliberate.
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'songs'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy %I on public.songs', pol.policyname);
  end loop;
end $$;

alter table public.songs enable row level security;

create policy songs_insert_admin on public.songs
  for insert to authenticated with check (public.is_admin());

create policy songs_update_admin on public.songs
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Still no DELETE policy: nothing in the app deletes songs, so leave it denied.
-- Bulk scripts use the service role, which bypasses RLS entirely.


-- ---------------------------------------------------------------------------
-- 3. Indexes
--
-- Every index in this database exists as a byproduct of a primary key or a
-- uniqueness constraint — there was not one query-serving index. These are the
-- three that pay for themselves immediately; the rest are listed in CLAUDE.md
-- against the tables that will need them as they grow.
-- ---------------------------------------------------------------------------

-- Every list and search path ends in `order by created_at/updated_at desc`, so
-- without these Postgres sorts the whole table on each request.
create index if not exists songs_created_at_idx on public.songs (created_at desc);
create index if not exists songs_updated_at_idx on public.songs (updated_at desc);

-- SongCard counts likes with `.eq('song_id', …)`, but the only index is
-- (user_id, song_id). A btree can't serve a filter on its trailing column, so
-- that count was a sequential scan per card.
create index if not exists song_likes_song_id_idx on public.song_likes (song_id);

-- profiles_username_key already covers this column identically; the duplicate
-- just made every profile write maintain two indexes.
drop index if exists public.unique_username;


-- ---------------------------------------------------------------------------
-- 4. OPTIONAL — require a real account to submit
--
-- Currently anyone, including a fully unauthenticated visitor, can insert into
-- song_submissions. That is the "anyone can request an edit" behaviour, and it
-- is deliberately left alone. It is also an unauthenticated write endpoint, so
-- if it ever gets spammed, uncomment this to require a signed-in account.
-- ---------------------------------------------------------------------------
-- do $$
-- declare pol record;
-- begin
--   for pol in
--     select policyname from pg_policies
--     where schemaname = 'public' and tablename = 'song_submissions' and cmd = 'INSERT'
--   loop
--     execute format('drop policy %I on public.song_submissions', pol.policyname);
--   end loop;
-- end $$;
--
-- create policy song_submissions_insert_real_account on public.song_submissions
--   for insert to authenticated with check (public.is_real_account());


-- ---------------------------------------------------------------------------
-- Known and deliberately NOT changed here
--
-- line_translations.votes is a plain integer the browser writes as an absolute
-- value (`votes: currentCount + 1`). Any authenticated user can PATCH it to any
-- number, and two simultaneous voters lose an update. Locking the column would
-- break the app as currently written, so the fix is an app change first —
-- derive the count from line_votes, or move the increment into an RPC — and
-- only then revoke the column. Tracked in CLAUDE.md.
-- ---------------------------------------------------------------------------
