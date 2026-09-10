# CN Lyric Hub — Project Context

## What This Is
Community-driven Chinese lyrics platform. Users browse Chinese songs with pinyin pronunciation guides and English translations. The core differentiator: per-character ruby pinyin alignment, community translation voting (like Genius but for Chinese music), and real-time traditional/simplified script toggling. Built by Daniel as a personal project.

## Tech Stack
- **Frontend**: React 19 + Vite 6, Tailwind CSS v4, deployed on Vercel
- **Backend**: Supabase (PostgreSQL + Auth + RLS). No API server — the browser talks to PostgREST directly.
- **Key libraries**: `pinyin-pro` (pinyin generation), `chinese-conv` (simplified ↔ traditional via `sify()`/`tify()`), `recharts` (stats charts), `lucide-react` (icons), `react-router-dom` v7, `react-helmet-async`
- **Domain**: https://cnlyrichub.vercel.app

> Local build note: this machine is arm64 but Node runs as x64, so `vite build` can fail on a missing `@rollup/rollup-darwin-x64`. Vercel (linux-x64) is unaffected.

## File Structure
- `src/components/` — Navbar, Footer, SongCard, SubmissionCard, LyricLine, LineSidebar, CommentsSection, CommentItem, ArtistSearch, LyricsEditor, ThemeSettings, TagInput
- `src/pages/` — HomePage, SongPage, AddSongPage, EditSongPage, AdminDashboard, AuthPage, ProfilePage, PublicProfile, ArtistPage, StatsPage, FaqPage, NotFoundPage
- `src/context/` — AuthContext (lazy anon auth), ThemeContext (dark/light, script mode, accent color, lyric sizes/colors), ToastContext (toast.success/error/warning/info + confirm())
- `src/hooks/` — useArtistSelection, useTagSuggestions
- `src/utils/lyrics.js` — **the single shared pinyin module**: `isChinese`, `generatePinyin`, `alignSyllables`. Imported by the app *and* by `scripts/import-lyrics.cjs` (via dynamic import) so stored and rendered pinyin can never drift.
- `scripts/` — import-lyrics.cjs, fetch-covers.cjs, fetch-years.cjs, itunes.cjs (shared API client), generate-sitemap.cjs, verify-rls.cjs
- `supabase/migrations/` — RLS policies as SQL. Applied by pasting into the Supabase SQL editor.

## Database Schema (Supabase)
### Core Tables
- `songs` — **id (bigint PK)**, title_en (NOT NULL), artist_en (NOT NULL), title_zh, artist_zh, slug (unique), lyrics_chinese, lyrics_pinyin, lyrics_english (parallel newline-delimited), cover_url, youtube_url, category, tags (text[]), bio, credits, translation_credit, year (int), source (NOT NULL: 'import' | 'user'), submitted_by, last_edited_by, user_id, created_at, updated_at
- `artists` — id (uuid PK), name_en, name_zh, slug, avatar_url
- `song_artists` — junction table: song_id (bigint → songs), artist_id (uuid → artists), role
- `profiles` — id (uuid, FK → auth.users), username, display_name, avatar_url, bio, role ('admin' | 'user')
- `song_submissions` — staging table for non-admin submissions; status, submitter_ip, original_song_id (bigint → songs)
- `line_translations` — song_id (bigint), line_index, **content** (not `translation_text`), language, user_id, votes
- `line_comments` — line-level comments: song_id, line_index, content, user_id, translation_id, **parent_id (self-FK, one-level threading)**, votes
- `comments` — song-level comments: song_id, content, user_id. **No `line_index`** — that's `line_comments`.
- `line_votes` — song_id, line_index, translation_id (null = vote on the official line), user_id
- `comment_votes` / `comment_likes` — both FK to **`line_comments`**, not `comments`
- `song_likes` — song_id (bigint), user_id

⚠️ Song-referencing FKs are **bigint**; everything else is uuid. Don't pass a uuid as a song_id.

### RLS
Policies live in `supabase/migrations/`. RLS is the **only** authorization layer — the anon key is public (Vite inlines it into the bundle), so any `role === 'admin'` check in React is UX, not security.
- songs: public read; INSERT/UPDATE require `authenticated`; no DELETE policy
- profiles: public read; own-row UPDATE only, and the `role` column is frozen by `current_profile_role()`
- line_translations / line_comments / comments: INSERT requires `auth.uid() = user_id`
- song_likes / line_votes / comment_votes: INSERT/DELETE require `auth.uid() = user_id`
- Bulk scripts use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS

Run `npm run verify:rls` after any policy change — it probes the REST API as an attacker would and exits non-zero if a policy regressed.

### Triggers
- `songs_updated_at` — auto-updates `updated_at` on any row change

## Key Architecture Decisions
- **Lyrics as parallel columns** (not a lines table) — keeps inserts atomic, editing simple, avoids hundreds of rows per song. ⚠️ Nothing in Postgres enforces equal line counts across the three columns; that invariant is application-level only.
- **Pinyin is pre-generated at ingest, not at render** — `pinyin-pro` is handed whole Chinese runs so it resolves polyphones by word context (音乐 → `yīn yuè`, never `yīn lè`). Per-character generation loses this.
- **Alignment is a count-gated positional zip** — `alignSyllables()` returns one syllable per Han char, or `null` when it can't match, in which case `LyricLine` regenerates per character. ~99.5% of real lines take the fast path.
- **Script conversion is client-side only** — the DB stores one canonical form; `sify`/`tify` run at render. Conversion preserves character count, which is what keeps ruby alignment valid in traditional mode.
- **Lazy anonymous auth** — no `signInAnonymously()` on page load. Every write path calls `ensureUser()` first so rows carry a real uid for RLS.
- **N+1 elimination** — HomePage batch-fetches liked song IDs in one query; the importer preloads a dedup cache instead of querying per song.
- **Latin-only lyric lines** — rendered at smaller italic size instead of hanzi scale.
- **No "No translation available" message** — if no translation exists, show nothing.
- **Toast system replaces all alert()/confirm()**

## Commands
```
npm run dev          # vite dev server
npm test             # node --test, unit tests for the pinyin/alignment logic
npm run lint         # eslint (0 errors expected)
npm run verify:rls   # probe live RLS policies; exits 1 on a hole
npm run build        # generate-sitemap.cjs && vite build
```

## Bulk Scripts
All in `scripts/`, all use `.env.local` auto-detection and SUPABASE_SERVICE_ROLE_KEY:
- `import-lyrics.cjs` — Reads Chinese Lyric Corpus folder structure, generates pinyin via the shared `src/utils/lyrics.js`, dedups on title_zh + artist_en against a preloaded cache. Supports --limit, --artists, --dry-run. Skips unique violations by SQLSTATE `23505`.
- `itunes.cjs` — shared iTunes Search client: 10s timeout, exponential backoff, honours `Retry-After`, throws `RateLimitError` (aborting the run) rather than silently recording "no match" for throttled songs.
- `fetch-covers.cjs` — album art for songs with empty cover_url, 3 search strategies
- `fetch-years.cjs` — release years. ⚠️ PostgREST caps reads at 1000 rows, so a full backfill needs repeat runs (it's idempotent — it only selects rows where `year is null`).
- `generate-sitemap.cjs` — pages past the 1000-row cap; uses updated_at for lastmod; runs as a Vercel build step
- `verify-rls.cjs` — non-destructive RLS policy probe

## Environment Variables (.env.local)
```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
No spaces after `=`. Vite exposes only VITE_ prefixed vars to the frontend — the service role key has no prefix precisely so it cannot be bundled.

## Daniel's Preferences
- Hates unnecessary UI noise — no "No translation available" on every line, no verbose empty states
- Wants things to look intentional, not broken — missing covers show gradient + music icon placeholder
- Prefers direct, fast iteration — "just do it" over lengthy planning discussions
- Dark mode first aesthetic, slate-950 backgrounds
- Do NOT create summary documents, .md files, or READMEs as deliverables
- Casual communication style
- Values deduplication in code — shared components over copy-paste

## Pending Work
- [ ] **Apply `supabase/migrations/20260831000000_tighten_rls.sql` in the Supabase SQL editor**, then `npm run verify:rls` (currently 5 checks fail)
- [ ] Admin "Make Official" button — promote top-voted community translation into lyrics_english
- [ ] ~0.5% of lines have word-grouped stored pinyin (`píngguǒ` for 蘋果) that can't be split; they fall back to per-char. Fix by regenerating `lyrics_pinyin` for affected rows.
- [ ] ArtistPage/PublicProfile N+1 likes optimization
- [ ] Error boundaries (React error boundary wrapper)
- [ ] Light mode CSS refactor to CSS custom properties
- [ ] Navbar button click jank — root cause not identified
- [ ] Component + E2E tests (only the pinyin/alignment units exist so far)
- [ ] `songs`/`song_artists` insert isn't atomic — needs a Postgres function called via `rpc()`

## What NOT to Do
- Don't create .md or README deliverable files (user preference)
- Don't show "No translation available" anywhere
- Don't use alert() or window.confirm() — use ToastContext
- Don't use window.location.reload() — use React state
- Don't fetch all user votes site-wide — scope queries to current context
- Don't sign in anonymously on page load — use lazy ensureUser()
- Don't write a second copy of the pinyin logic — import `src/utils/lyrics.js`
- Don't rely on a frontend role check for security — it's a UX affordance only
