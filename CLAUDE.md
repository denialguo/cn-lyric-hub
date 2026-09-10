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
Column lists below were dumped from the live DB on 2026-09-09 — trust them over older notes.

- `songs` — **id (bigint PK)**, title_en (NOT NULL), artist_en (NOT NULL), title_zh, artist_zh, slug (unique), lyrics_chinese, lyrics_pinyin, lyrics_english (parallel newline-delimited), cover_url, youtube_url, category, tags (text[]), bio, credits, translation_credit, year (int), source (NOT NULL, **DEFAULT 'user'**: 'import' | 'user'), submitted_by, last_edited_by, user_id, created_at, updated_at
  - ⚠️ **There is NO `status` column on `songs`.** Sending one returns `PGRST204` and the whole insert fails. `status` exists only on `song_submissions`.
  - `submitted_by` / `last_edited_by` hold **free-text display names** ('Anonymous', 'admin', 'Community'), NOT usernames — so they do not resolve against `profiles.username`. 1608 songs, most are `'Anonymous'`.
  - `source` defaults to `'user'`, so omitting it from an insert is safe.
- `artists` — id (uuid PK), name_en, name_zh, slug, avatar_url
- `song_artists` — junction table: song_id (bigint → songs), artist_id (uuid → artists), role
- `profiles` — id (uuid, FK → auth.users), username, display_name, avatar_url, bio, role ('admin' | 'user'), updated_at
  - **No `website` column and no `email`/PII.** Public read exposes only the fields above, so there is no data leak — but `PublicProfile.jsx` renders a `profile.website` block that can therefore never display.
  - 41 rows, most with `username: null` — accumulated anonymous sessions (a trigger creates a profile per auth user, anonymous included). Unbounded by design.
- `song_submissions` — staging table; **currently 0 rows**, not publicly readable (own-row select only). Columns: id, created_at, title_en, title_zh, artist_en, artist_zh, lyrics_chinese, lyrics_pinyin, lyrics_english, cover_url, youtube_url, tags, credits, status, **submitter_ip**, user_id, original_song_id (bigint → songs), slug, submitted_by, bio, updated_at, year. Note: **no `source` column** (unlike `songs`).
- `line_translations` — song_id (bigint), line_index, **content** (not `translation_text`), language, user_id, votes
- `line_comments` — line-level comments: song_id, line_index, content, user_id, translation_id, **parent_id (self-FK, one-level threading)**, votes
- `comments` — song-level comments: song_id, content, user_id. **No `line_index`** — that's `line_comments`.
- `line_votes` — song_id, line_index, translation_id (null = vote on the official line), user_id
- `comment_votes` (id, user_id, **comment_id**, created_at) / `comment_likes` (user_id, comment_id, created_at — no id) — both FK to **`line_comments`**, not `comments`
- `song_likes` — song_id (bigint), user_id

⚠️ Song-referencing FKs are **bigint**; everything else is uuid. Don't pass a uuid as a song_id.

### RLS
Policies live in `supabase/migrations/`. RLS is the **only** authorization layer — the anon key is public (Vite inlines it into the bundle), so any `role === 'admin'` check in React is UX, not security.

**Live state as verified 2026-09-09** (`20260831000000_tighten_rls.sql` IS applied, except its `song_likes` block):
- songs: public read ✅; anon-role INSERT/UPDATE blocked ✅
  - ⚠️ **UPDATE is granted `to authenticated`, and a Supabase anonymous session IS `authenticated`.** Verified: a throwaway anon session can rewrite any song's lyrics. `to authenticated` ≠ "has a real account".
- profiles: public read ✅; own-row UPDATE only ✅; `role` frozen by `current_profile_role()` ✅ (escalation verified blocked)
- line_translations / line_comments / comments: INSERT requires `auth.uid() = user_id` ✅; **cross-user UPDATE and DELETE verified blocked** ✅
- line_votes / comment_votes: own-row INSERT/DELETE ✅ (forgery verified blocked)
- ⚠️ **song_likes: NO ownership check.** Verified: a forged `user_id` is accepted, and an insert succeeds with **no auth at all** (raw anon key). The migration's block 3 would fix this but was never applied for this table.
- Bulk scripts use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS

Run `npm run verify:rls` after any policy change — it probes the REST API as an attacker would and exits non-zero if a policy regressed. Currently **2 failures, both `song_likes`** (not 5 — that count was stale).

⚠️ **Never write a probe that restores a row from a `Prefer: return=representation` response after a PATCH** — that header returns the row *after* the write, so "restoring" from it re-saves the corrupted value. This destroyed `songs.lyrics_chinese` on song 391 during the 2026-09-09 audit (recovered from `~/Downloads/Chinese_Lyrics/`). Snapshot before the write, or restore from the corpus.

### Triggers
- `songs_updated_at` — auto-updates `updated_at` on any row change

### Indexes (dumped 2026-09-09)
**All 21 indexes are UNIQUE — there is not one plain index in the DB.** Every index exists as a byproduct of a PK or uniqueness constraint; none was created to serve a query.

Protections these give you for free (do NOT re-add app-level guards for these):
- `profiles_username_key (username)` — username uniqueness IS enforced. The check-then-upsert in ProfilePage can't create duplicates; it raises `23505`.
- `song_likes_user_id_song_id_key (user_id, song_id)`, `unique_comment_vote (user_id, comment_id)`, `unique_community_vote (user_id, translation_id) WHERE translation_id IS NOT NULL`, `unique_original_vote (user_id, song_id, line_index) WHERE translation_id IS NULL` — double-click like/vote races raise `23505` instead of double-counting. Optimistic-UI drift is still possible; duplicate *rows* are not.

⚠️ **Leftmost-prefix rule** — a btree on `(a, b)` serves filters on `a` or `a+b`, never `b` alone. These queries therefore seq-scan despite an index that looks relevant:
- `song_likes.eq('song_id')` (SongCard count) vs index `(user_id, song_id)` → seq scan **per card**
- `comment_likes.eq('comment_id')` (CommentItem count) vs PK `(user_id, comment_id)` → seq scan per comment
- `line_votes.eq('song_id').eq('line_index').is('translation_id',null)` vs `(user_id, song_id, line_index)` → seq scan
- `song_artists` artist→songs lookups vs `(song_id, artist_id)` → needs `(artist_id)` before any ArtistPage junction refactor

Missing and actually used by every list query: **`songs` has no index on `created_at` or `updated_at`**, yet every list/search path orders by one of them → full sort of the table per request.

Redundant: `unique_username` is byte-identical to `profiles_username_key`. Safe to `drop index public.unique_username;`.

Unindexable by btree: `artist_en.ilike.%name%` (leading wildcard). Needs `pg_trgm`/FTS — or better, the `song_artists` join.

### Storage (audited 2026-09-09)
- **Only one bucket: `avatars`** — `public=true`, `file_size_limit=null`, `allowed_mime_types=null`. No cap and no MIME allowlist; `accept="image/*"` on the input is client-side only. Fix in the dashboard (the real enforcement point), not in JS. Contains 2 objects, both the admin's — old avatars are never deleted, so every change orphans a file permanently.
- **Cover art is hotlinked, not stored.** 814/1000 covers point at `is1-ssl.mzstatic.com` (Apple), rewritten by `itunes.cjs` from `artworkUrl100` → `600x600bb` (~56 KB each). 176 rows have `cover_url = ''` (empty string, **never NULL** — HomePage's `cover_url.neq.""` filter depends on this; a NULL would be silently excluded from All Songs).
  - **No `onError` handler exists anywhere in `src/`** — a rotated Apple URL renders the browser's broken-image glyph, NOT the gradient placeholder (that only triggers on a falsy `cover_url`).
  - ~2 MB of art per homepage (36 cards × 56 KB) at 600×600 into a ~300px slot; no `srcset`.
  - Third-party requests to Apple disclose visitor IP/referer → must be named in the privacy policy. iTunes artwork terms cover promoting iTunes content, not acting as someone else's permanent CDN.
- **The DB is the only copy of the data.** The corpus in `~/Downloads/Chinese_Lyrics/` can restore imported `lyrics_chinese` only — it cannot restore the 27 user songs, community translations, comments, likes, curated `lyrics_english`, or script-backfilled covers/years. No `pg_dump` routine exists. Song 391 was recovered in the 2026-09-09 audit purely because the corpus happened to still be on disk.
- Only one RPC exists (`current_profile_role`), so the non-atomic `songs`/`song_artists` insert has no server-side function to move into yet.

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

Ranked from the full-codebase audit on **2026-09-09**. Nothing below is fixed yet — the audit was read-only by request.

### P0 — broken in production right now
- [ ] **Publishing a song fails for every signed-in user.** `AddSongPage.jsx:100` sends `status: 'active'` into `songs`, which has no such column → `PGRST204`, insert rejected. Same bug at `EditSongPage.jsx:179` (that one targets `song_submissions`, which *does* have `status`, so it survives). Proven: removing the field returns `201`. One-line fix.
- [ ] **Anonymous-session users crash the submit path.** Both pages do `user.email.split('@')[0]`; an anonymous user has no `email` → TypeError, swallowed into a nonsense error toast. `EditSongPage.jsx:108` already uses `user.email?.split(...)` — the other two sites don't.
- [ ] **StatsPage computes every statistic on 1000 of 1608 songs.** No `.range()` paging, so PostgREST's cap silently truncates ~38% of the catalog. Also downloads ~1.2 MB of lyrics twice.

### P1 — security (all verified live against the REST API)
- [ ] **`song_likes` accepts forged likes with no auth at all.** Apply block 3 of `20260831000000_tighten_rls.sql` (or just the `song_likes` half), then `npm run verify:rls`.
- [ ] **Any anonymous session can rewrite the whole catalog.** Decision made 2026-09-09: direct `songs` UPDATE should be **admin-only**; everyone else routes through `song_submissions` for review. Open question: whether anonymous sessions may submit edit *requests* at all.
- [ ] **Translation vote counts are client-written absolute values** (`votes: currentCount + 1` in `LineSidebar.jsx`) → any user can set any count to any number, and two concurrent voters lose an update. Fix by deriving from `line_votes` or moving the increment server-side.
- [ ] **`avatars` bucket has no size limit and no MIME allowlist, and is public.** Set `file_size_limit` (~2 MB) and `allowed_mime_types` (`image/png,image/jpeg,image/webp`) **in the Supabase dashboard** — that's the enforcement point; `accept="image/*"` in JS is bypassable. Today it's unbounded public file hosting, and an uploaded SVG is script-capable on that origin. Old avatars are never deleted (orphan per change).
- [ ] **No backups.** The DB is the only copy of all user-generated content. A `pg_dump` on a schedule (or even monthly to a private repo) — check whether the current Supabase plan includes PITR. This and the bucket settings are the only findings in the audit whose risk is **irreversible**.
- [ ] Add `onError` → gradient placeholder on every `<img src={cover_url}>`. 814 covers are hotlinked from Apple's CDN; when one rotates, users currently see a broken-image glyph instead of the intentional placeholder. Also consider `300x300bb` instead of `600x600bb` (halves ~2 MB/homepage, same visual size).

### P2 — crashes and stale state
- [ ] **Unguarded `JSON.parse(localStorage…)` in 5 places.** The worst is `ThemeContext.jsx:31`, which wraps the entire app — one corrupt value = permanent white screen with no error boundary to catch it. Others: `SongPage.jsx:34,43`, `AddSongPage.jsx:35`, `LineSidebar.jsx:34,39`.
- [ ] **SongPage keeps the previous song's state across navigation.** `customTranslations` is `useState(() => localStorage…)`, which only runs on first mount, so `/song/a` → `/song/b` carries A's custom translations onto B. `loading` is never reset either, and `setSong` is guarded by `if (data)`, so a failed fetch leaves the *old* song rendered. `selectedLine` also persists, and `LineSidebar` won't refetch because its `[lineIndex, user]` deps didn't change — it shows the old song's translations.
- [ ] **No error boundaries anywhere** (confirmed by grep).
- [ ] `/profile` while logged out hangs on "Loading profile…" forever — the `if (!user) return` sits above the `try`, so the `finally` that clears `dataLoading` never runs. No redirect to `/login` either.

### P3 — correctness and UX
- [ ] **~1600 dead "Submitted by" links.** `SongPage.jsx:400` links `submitted_by` to `/user/:username`, but it holds display text like `'Anonymous'`. Decision made 2026-09-09: **render `'Imported'`** for these instead of a link; only link when it resolves to a real profile.
- [ ] **PostgREST filter injection / breakage in `.or()` calls.** `ArtistPage.jsx:24,49,52` and `ArtistSearch.jsx:34` interpolate raw user input into filter strings. An artist name containing `,` `(` `)` `%` produces a malformed filter → 400 → page silently shows zero songs. `HomePage.jsx:47` already solved this with `.replace(/[,%()]/g,' ')` — that sanitizer needs extracting and reusing (see Deduplication below).
- [ ] Unencoded artist names in URLs: `` `/artist/${artist.trim()}` `` in `SongPage.jsx:246` and `SongCard.jsx:117` — should be `encodeURIComponent`, which the canonical tag at `ArtistPage.jsx:68` already does.
- [ ] **Submission outcomes are invisible.** ProfilePage renders `sub.status === 'rejected' | 'approved'` branches, but approve and reject both **delete** the row — so a submission just vanishes. Either set status instead of deleting, or drop the dead branches.
- [ ] `CommentsSection` gates commenting on `!user`, but an anonymous session *is* a user → anon comments post and render as "Unknown". Navbar checks `user.is_anonymous`; this doesn't.
- [ ] Bad song slug renders a bare unstyled "Song not found." — no Navbar, no `noindex`, no way back. `/artist/<garbage>` renders an indexable "0 Songs Available" page. Both are soft-404s.
- [ ] No `maxLength` on any comment/translation textarea → unbounded content inserts.
- [ ] Optimistic deletes in `LineSidebar` (`handleDelete`, `handleDeleteComment`) and `CommentsSection.handleDelete` have **no rollback and no error toast** — a blocked delete vanishes from the UI but stays in the DB. The vote handlers in the same file *do* roll back correctly; this is an inconsistency, not a missing pattern.
- [ ] `CommentItem.toggleLike` optimistic update has no rollback either.
- [ ] `AddSongPage.clearDraft` omits `bio` when resetting, so bio survives "Clear Draft".
- [ ] Logging out doesn't clear `userLikedIds` on HomePage → stale filled hearts.
- [ ] Navbar's "close panels on navigation" effect has `[]` deps and never fires. Dead code (harmless — Navbar remounts per page). No click-outside handler on its menus either, unlike `ArtistSearch`/`SongPage` which both implement one.

### P4 — performance and quality
- [ ] **N+1 likes**: `SongCard` self-fetches 2 queries per card wherever no `initialLikeCount` is passed (ArtistPage, PublicProfile, ProfilePage) — 50 songs = ~100 requests. `CommentItem` does the same, 2 per comment.
- [ ] **HomePage "Trending" fetches every like row site-wide** (`song_likes.select('song_id')`, no filter) and is silently capped at 1000 — trending breaks as likes grow.
- [ ] **296 KB of pinyin-pro loads on every song page.** `utils/lyrics.js` imports `pinyin-pro` at top level, and `LyricLine` imports `isChinese`/`alignSyllables` from it — neither of which needs the dictionary. Only `generatePinyin` and the ~0.5% per-char fallback do. Splitting the module is the biggest single bundle win. Entry chunk is 504 KB (React + router + supabase + chinese-conv dictionaries).
- [ ] `SizeControl` and `ColorRow` are defined **inside** `SongPage`'s render body → new component identity every render, remounting that subtree on each keystroke. Likely related to the "click jank" note.
- [ ] **Deduplication**: the `.or()` search-filter builder is copy-pasted 4 ways across HomePage/ArtistPage(×2)/ArtistSearch with only one sanitizing. `timeAgo` lives in `CommentsSection` while `CommentItem` uses raw `toLocaleDateString`. Slug generation is duplicated in AddSongPage/EditSongPage. Avatar fallback chains are repeated in 5 files.
- [ ] **Unused dependencies**: `react-is`, `shadcn`, and `sitemap` (the generator hand-rolls XML). `dotenv` + `sitemap` are build/script-only and belong in devDependencies.
- [ ] `ThemeContext.jsx:64-67` removes `data-theme-<color>` attributes that are never set — dead loop.
- [ ] Light mode is ~30 `.light .bg-slate-950 { !important }` overrides in `index.css`. Works, but any new Tailwind shade is silently uncovered. (Pre-existing refactor item, confirmed.)
- [ ] No `vercel.json` security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`). SPA rewrite itself is correct.
- [ ] ~~Username uniqueness is check-then-upsert (TOCTOU)~~ — **not a bug**, `profiles_username_key` enforces it. Only cosmetic: the race surfaces a raw `23505` string via `toast.error(error.message)`. Catch it and say "that username was just taken".
- [ ] `drop index public.unique_username;` — exact duplicate of `profiles_username_key`, every profile write maintains both.
- [ ] Add `songs (created_at desc)` + `songs (updated_at desc)` indexes — every list/search query sorts the whole table without them. Plus `song_likes (song_id)` for the SongCard N+1 (currently a seq scan per card). See the Indexes section for the deferred set.
- [ ] Only the pinyin/alignment units are tested (12 pass). No component or E2E tests.

### P5 — legal & compliance (not built yet)
- [ ] `/privacy` and `/terms` pages + footer links. FaqPage already carries the DMCA/takedown flow and contact (`danieldenialdeveloping@gmail.com`) to build on.
- [ ] Google OAuth requests `access_type: 'offline'` + `prompt: 'consent'` (`AuthPage.jsx:20-23`) — forces the consent screen on every single login and asks for a refresh token the app never uses. Drop both.
- [ ] `song_submissions.submitter_ip` exists → the privacy policy must disclose IP collection (table is empty today).
- [ ] Cookie/consent banner: app uses `localStorage` for preferences + Supabase auth tokens, no ad or tracking cookies. Vercel Analytics + Speed Insights are cookieless, so a banner is likely unnecessary — worth stating in the policy rather than adding a banner.

### Carried over (still true)
- [ ] Admin "Make Official" button — promote top-voted community translation into lyrics_english
- [ ] ~0.5% of lines have word-grouped stored pinyin (`píngguǒ` for 蘋果) that can't be split; they fall back to per-char. Fix by regenerating `lyrics_pinyin` for affected rows.
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
