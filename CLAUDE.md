# CN Lyric Hub — Project Context

## What This Is
Community-driven Chinese lyrics platform. Users browse Chinese songs with pinyin pronunciation guides and English translations. The core differentiator: per-character ruby pinyin alignment, community translation voting (like Genius but for Chinese music), and real-time traditional/simplified script toggling. Built by Daniel as a personal project.

## Tech Stack
- **Frontend**: React 19 + Vite 6, Tailwind CSS v4, deployed on Vercel
- **Backend**: Supabase (PostgreSQL + Auth + RLS). No API server — the browser talks to PostgREST directly.
- **Key libraries**: `pinyin-pro` (pinyin generation), `chinese-conv` (simplified ↔ traditional via `sify()`/`tify()`), `recharts` (stats charts), `lucide-react` (icons), `react-router-dom` v7, `react-helmet-async`
- **Domain**: https://cnlyrichub.vercel.app

> Local build note: `npm run build` works on this machine as of 2026-09-09 (~3s). An older note claimed `vite build` failed here on a missing `@rollup/rollup-darwin-x64` — that is no longer reproducible.

## File Structure
- `src/components/` — Navbar, Footer, SongCard, SubmissionCard, LyricLine, LineSidebar, CommentsSection, CommentItem, ArtistSearch, LyricsEditor, ThemeSettings, TagInput, **ErrorBoundary**, **LegalLayout**
- `src/pages/` — HomePage, SongPage, AddSongPage, EditSongPage, AdminDashboard, AuthPage, ProfilePage, PublicProfile, ArtistPage, StatsPage, FaqPage, NotFoundPage, **PrivacyPage**, **TermsPage**
- `src/context/` — AuthContext (lazy anon auth), ThemeContext (dark/light, script mode, accent color, lyric sizes/colors), ToastContext (toast.success/error/warning/info + confirm())
- `src/hooks/` — useArtistSelection, useTagSuggestions
- `src/lib/` — supabaseClient, **queries.js** (the shared data-access seam), **identity.js** (real-account vs anonymous), **storage.js** (localStorage that can't throw)
- `src/utils/lyrics.js` — **the single shared pinyin module**: `isChinese`, `generatePinyin`, `alignSyllables`. Imported by the app *and* by `scripts/import-lyrics.cjs` (via dynamic import) so stored and rendered pinyin can never drift.
- `scripts/` — import-lyrics.cjs, fetch-covers.cjs, fetch-years.cjs, itunes.cjs (shared API client), generate-sitemap.cjs, **prerender.cjs**, verify-rls.cjs
- `AGENTS.md` is a **symlink to CLAUDE.md** — edit CLAUDE.md only. It was a copy that had drifted 108 lines.
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
- ⚠️ **song_likes: NO ownership check.** Verified: a forged `user_id` is accepted, and an insert succeeds with **no auth at all** (raw anon key).
- Bulk scripts use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS

### RLS migration applied — verified after user confirmation
`supabase/migrations/20260909000000_likes_ownership_and_admin_song_writes.sql` was applied by Daniel after correcting the constraint drop. Latest `npm run verify:rls`: **27 passed, 0 failed**, including exact-ID cleanup of all disposable rows and both accounts. The earlier four verified song-write/like-ownership holes are closed. The live-state bullets above describe the initial audit, before this migration.

It also creates the three indexes the app actually needs and drops the duplicate `unique_username`.

⚠️ **Read before applying**: it makes direct `songs` writes admin-only, and **only `danielguo1098@gmail.com` is admin** (`profiles.id = 55c256da-…`). `danieldenialdeveloping@gmail.com` (`d090e155-…`) is NOT — after applying, that account's edits become submissions instead of direct writes. The SQL contains the one-line `update` to promote it if you want that. The `role` column is frozen by RLS, so promotion is only possible from the SQL editor or dashboard, never the app.

The app side is already done and is safe either way: non-admins route to `song_submissions`, and that path was verified to still work for anonymous *and* fully unauthenticated visitors.

Run `npm run verify:rls` after any policy change — it probes the REST API as an attacker would and exits non-zero if a policy regressed. It is non-destructive and cleans up after itself (verified: 0 leftover rows, probe auth users deleted).

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

Redundant: `unique_username` backs a UNIQUE constraint, duplicating `profiles_username_key`. Remove it with `alter table public.profiles drop constraint if exists unique_username;` — PostgreSQL removes the backing index automatically, while `profiles_username_key` continues enforcing uniqueness. Direct `DROP INDEX` fails with `2BP01`; the migration was corrected after that SQL-editor error.

Unindexable by btree: `artist_en.ilike.%name%` (leading wildcard). Needs `pg_trgm`/FTS — or better, the `song_artists` join.

### Storage (audited 2026-09-09)
- **Only one bucket: `avatars`** — `public=true`, `file_size_limit=null`, `allowed_mime_types=null`. No cap and no MIME allowlist; `accept="image/*"` on the input is client-side only. Fix in the dashboard (the real enforcement point), not in JS. Contains 2 objects, both the admin's — old avatars are never deleted, so every change orphans a file permanently.
- **Cover art is hotlinked, not stored.** 814/1000 covers point at `is1-ssl.mzstatic.com` (Apple), rewritten by `itunes.cjs` from `artworkUrl100` → `600x600bb` (~56 KB each). 176 rows have `cover_url = ''` (empty string, **never NULL** — HomePage's `cover_url.neq.""` filter depends on this; a NULL would be silently excluded from All Songs).
  - **No `onError` handler exists anywhere in `src/`** — a rotated Apple URL renders the browser's broken-image glyph, NOT the gradient placeholder (that only triggers on a falsy `cover_url`).
  - ~2 MB of art per homepage (36 cards × 56 KB) at 600×600 into a ~300px slot; no `srcset`.
  - Third-party requests to Apple disclose visitor IP/referer → must be named in the privacy policy. iTunes artwork terms cover promoting iTunes content, not acting as someone else's permanent CDN.
- **The DB is the only copy of the data.** The corpus in `~/Downloads/Chinese_Lyrics/` can restore imported `lyrics_chinese` only — it cannot restore the 27 user songs, community translations, comments, likes, curated `lyrics_english`, or script-backfilled covers/years. No `pg_dump` routine exists. Song 391 was recovered in the 2026-09-09 audit purely because the corpus happened to still be on disk.
- Only one RPC exists (`current_profile_role`), so the non-atomic `songs`/`song_artists` insert has no server-side function to move into yet.

## SEO / rendering (added 2026-09-09)
The app is a client-rendered SPA, so **every URL used to serve the same 915-byte shell** — identical `<title>`, identical description, empty `<div id="root">`, no lyrics. `react-helmet-async` only sets those tags after JS runs. Googlebot deduped 1608 byte-identical pages into one; **only 2 pages were indexed**. The sitemap was never the problem.

`scripts/prerender.cjs` runs after `vite build` and writes `dist/song/<slug>/index.html`, `dist/artist/<name>/index.html` and the static routes, each with a unique title, description, canonical, OG tags, JSON-LD and the real lyrics in the markup (915 B → ~8 KB; 1608 distinct titles and descriptions verified). **Vercel resolves static files before `rewrites`**, so these win over the SPA shell and the shell still handles anything not prerendered. The script exits 0 on failure so SEO can never break a deploy.

**Three non-obvious constraints — easy to regress, each found by testing rather than assumption:**
1. **Files are written flat as `<route>.html`, never `<route>/index.html`.** Directory-index resolution only matches with a *trailing slash* on many static servers (`vite preview` included), and our canonicals and sitemap use the slash-less form — which is what Googlebot requests. Verified: the directory form served the generic SPA shell for `/song/foo` and only worked for `/song/foo/`.
2. **`vercel.json` needs `"cleanUrls": true`** (plus `"trailingSlash": false`) for Vercel to serve `song/foo.html` at `/song/foo`. Without it the SPA rewrite wins and the prerender is dead weight.
3. **Artist filenames use the RAW name, not `encodeURIComponent(name)`.** A server percent-decodes the request path before matching the filesystem, so `/artist/%E5%91%A8%E6%9D%B0%E4%BC%A6` looks for `artist/周杰伦.html`. Encoded filenames never match. Names containing `/ \ : * ? " < > |` are skipped — a mangled filename couldn't match its URL anyway.

⚠️ **Verify after the next deploy** — the above was proven against a local server that emulates Vercel's resolution order (static file → `.html` → SPA rewrite), which is not Vercel itself:
```
curl -s https://cnlyrichub.vercel.app/song/xin-tian-di-live-live-5061 | grep -o '<title>[^<]*'
```
Should print the song's own title, not "CN Lyric Hub — Chinese Lyrics with…". If it prints the generic one, `cleanUrls` isn't taking effect.

Consequences to remember:
- Prerendered HTML is **stale until the next deploy**. Users always see live data (React refetches); only crawlers see the snapshot.
- Adding a new page route means adding it to `STATIC_ROUTES` in `prerender.cjs` *and* to `generate-sitemap.cjs`, or it serves the homepage's title.
- A full corpus import (~49,760 files, see below) would write ~49k HTML files per build and push the sitemap past the 50,000-URL limit for a single file, which then needs a sitemap index.

## The corpus vs the database
`~/Downloads/Chinese_Lyrics/` holds **49,760 lyric files across 494 artist folders**. The DB has **1,608 songs from 19 artists** — roughly 3% imported. Everything in the "won't scale" column below is sized against 1608, so a full import is a 31x jump that turns each of those into a live problem at once. Import deliberately, not all at once.

## Content coverage (measured 2026-09-09)
Worth knowing before building features that sort or filter on these:
- `lyrics_english` non-empty: **7 of 1608**. The site's English-translation promise is essentially unfulfilled.
- `tags`: **4 of 1000** sampled rows have any tag. The Classics tab used to filter on tags and rendered **zero cards**.
- `year`: 322 of 1608 (`year < 2000` → 112). `fetch-years.cjs` needs more runs.
- `category`: all 1608 rows are `'pop'` — a constant, read by nothing. Dead column.
- `translation_credit`: 2 non-null rows.
- `cover_url`: 1340 have one; 176 are `''` (never NULL — `cover_url.neq.""` depends on that).
- `song_likes`: 18 rows over **7 distinct songs**. Trending used to be the default tab and rendered 7 cards out of 1608; the default is now All Songs.

## Key Architecture Decisions
- **Lyrics as parallel columns** (not a lines table) — keeps inserts atomic, editing simple, avoids hundreds of rows per song. ⚠️ Nothing in Postgres enforces equal line counts across the three columns; that invariant is application-level only.
- **Pinyin is pre-generated at ingest, not at render** — `pinyin-pro` is handed whole Chinese runs so it resolves polyphones by word context (音乐 → `yīn yuè`, never `yīn lè`). Per-character generation loses this.
- **Alignment is a count-gated positional zip** — `alignSyllables()` returns one syllable per Han char, or `null` when it can't match, in which case `LyricLine` asynchronously regenerates per character through the shared module. ~99.5% of real lines take the fast path.
- **Script conversion is client-side only** — the DB stores one canonical form; `sify`/`tify` run at render. Conversion preserves character count, which is what keeps ruby alignment valid in traditional mode.
- **Lazy anonymous auth** — no `signInAnonymously()` on page load. Every write path calls `ensureUser()` first so rows carry a real uid for RLS.
- **N+1 elimination** — HomePage batch-fetches liked song IDs in one query; the importer preloads a dedup cache instead of querying per song.
- **Latin-only lyric lines** — rendered at smaller italic size instead of hanzi scale.
- **No "No translation available" message** — if no translation exists, show nothing.
- **Toast system replaces all alert()/confirm()**
- **One shared data-access seam** — `src/lib/queries.js` owns every query with more than one caller (search, catalogue lists, tab queries, artist lookup, `fetchAllRows` for paging past the 1000-row cap, `likedSongIds`). Before it, `supabase` was imported into 15 components and each re-decided sanitising / paging / error handling independently, which is why the same bug appeared in four variants. **Add new multi-caller queries here, not in components.**
- **`src/lib/identity.js` is the only place that decides "is this a real account"** — a Supabase anonymous session has the Postgres role `authenticated`, so `if (user)` is true for throwaway visitors. Use `isRealAccount` / `isAdmin` / `submitterName`, never a bare `if (user)` or `user.email`.
- **`src/lib/storage.js` wraps all localStorage** — reads and writes never throw. Accessing localStorage at all throws when a browser blocks site data, and a bare `JSON.parse` in ThemeProvider used to white-screen the whole app unrecoverably.
- **`ErrorBoundary` is mounted outside ThemeProvider** in `main.jsx`, because ThemeProvider's own storage read was the most likely thing to throw.
- **Direct `songs` writes are admin-only** (app + RLS). Every non-admin — signed in, anonymous, or signed out — routes through `song_submissions` for review. Approve/reject set `status`; they no longer delete the row, so submitters can see the outcome.

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

Ranked from the full-codebase audit on **2026-09-09**, updated during the hardening follow-up below.

### ✅ Fixed 2026-09-09 (commits f3e226d → HEAD)
Code is done for all of these; the one thing still outstanding is the RLS migration above, which only you can apply.

- **Publishing songs** — `AddSongPage` sent `status` to `songs`, which has no such column (`PGRST204`, whole insert rejected). Payloads are now built per target table.
- **Anonymous-session crashes** — `user.email.split('@')` on accounts with no email. All three sites use `src/lib/identity.js` now.
- **StatsPage** analysed 1000 of 1608 songs; pages via `fetchAllRows`.
- **Filter injection** in `ArtistPage` (×2) and `ArtistSearch` — a comma or bracket in a name produced a 400 that rendered as "no results". One sanitiser in `queries.js` now.
- **All 5 unguarded `JSON.parse(localStorage…)`** — the ThemeProvider one white-screened the whole app irrecoverably. Everything goes through `storage.js`; `ErrorBoundary` added outside the providers.
- **SongPage state leaked between songs** — `customTranslations` was a `useState` initializer (runs once per mount) so `/song/a → /song/b` carried A's data *and persisted it under B's key*. Now an effect on `slug`; also resets song/selectedLine/loading, and `LineSidebar` refetches on `songId`.
- **~1600 dead "Submitted by" links** → imports read "Imported"; a link renders only for a confirmed profile.
- **Only 2 pages indexed** → `prerender.cjs`. See the SEO section.
- **/privacy and /terms** exist, are linked from the footer, and are in the sitemap.
- **Anonymous users could comment as "Unknown"** — every `if (user)` gate that meant "real account" now says so.
- **Optimistic deletes with no rollback** in LineSidebar (×2) and CommentsSection; `CommentItem` like gained rollback + a double-click guard.
- **N+1 likes** on ArtistPage / PublicProfile — counts batched from `CARD_COLUMNS`.
- **Soft 404s** — bad song slug, unknown artist, unknown username all render real not-found states with `noindex`. `/artist/%` no longer throws on `decodeURIComponent`.
- **Submission outcomes invisible** — approve/reject set `status` instead of deleting, so ProfilePage's existing 'approved'/'rejected' branches finally render. (Verified the column accepts both values.)
- **/profile signed out** hung on "Loading profile…" forever.
- **Default tab showed 7 of 1608** → All Songs. **Classics rendered 0** → `year < 2000`. **Trending** stopped pulling every like row site-wide.
- **Cover `onError`** → gradient placeholder, since 814 covers are hotlinked from Apple.
- Misc: `Clear Draft` left `bio` behind; unused deps (`shadcn`, `sitemap`) dropped and `dotenv` moved to dev; dead `data-theme-<color>` loop removed; Navbar's fake "close on navigation" effect removed and click-outside added; avatar type/size validated; `23505` username collision reads like English; `youtube-nocookie` + security headers in `vercel.json`; `ArtistPage`/`PublicProfile` gained the Navbar they never had.

### Still outstanding
- [x] **RLS migration applied by Daniel.** Live verifier: 27 passed, 0 failed; probe cleanup confirmed.
- [ ] 🔴 **Set `avatars` bucket limits in the Supabase dashboard** — `file_size_limit` ~2 MB, `allowed_mime_types` `image/png,image/jpeg,image/webp`. The client-side check is in place but the bucket is the enforcement point. Currently unbounded public file hosting, and an uploaded SVG is script-capable on that origin.
- [ ] 🔴 **No backups.** The DB is the only copy of all user-generated content; the corpus can only restore imported `lyrics_chinese`. Check whether the current Supabase plan has PITR, and set up a `pg_dump`.
- [ ] **Apply translation-counter migration after deploying the app change.** LineSidebar now derives translation counts from `line_votes(count)` and never writes `line_translations.votes`. `20260909010000_translation_vote_counts.sql` removes table-level UPDATE, then grants only content/language edits. The legacy counter is ignored even on INSERT. Comment counters are a separate, still outstanding issue.
- [x] **Line-count edit warning.** `lineEdits.js` checks fresh live lyrics and exact contribution counts before direct edits, suggestions, and review approval. Cancel prevents writes; read errors fail closed. Same-length reorders and concurrent writes remain outside this count-only guard; stable-anchor proposal below.
- [x] **Artist reconciliation applied by Daniel; fallback removed.** Five corrected English names verified live. `songsByArtist` reads only through the junction and preserves punctuation and both Chinese scripts. Junction reads verified: JJ Lin 124, SING 1, Faye Wong 222, Eason Chan 399, Teresa Teng 217 songs.
- [ ] **StatsPage is still client-side aggregation** — it now downloads all 1608 songs' lyrics (~2 MB) and runs 11 `useMemo` passes. Wants a materialised view before the catalogue grows.
- [ ] **Deferred indexes** — see the Indexes section for the set to add as tables grow.
- [x] **Lazy pinyin dictionary.** `lyrics.js` remains the single shared module; `generatePinyin` and `generateCharacterPinyin` are async and dynamically import the dictionary. Add/Edit and the importer await generation. LyricLine loads fallback only for unaligned Han text with pinyin visible, ignores stale async results, and keeps lyrics visible on load failure. Initial helper: 302.68 → 1.11 kB; deferred dictionary: 302.00 kB.
- [ ] **No CSP.** The other security headers are set; a CSP needs its own pass because getting it wrong silently breaks Supabase/YouTube/analytics.
- [ ] **Light mode is ~30 `.light .bg-slate-950 { !important }` overrides.** Works, but any new Tailwind shade is silently uncovered.
- [ ] **39 anonymous auth rows** have accumulated (42 users, 3 real). A trigger creates a profile per auth user. Unbounded by design — worth a periodic cleanup of anonymous accounts that never contributed.
- [ ] Component + E2E tests (only the 12 pinyin/alignment units exist).
- [ ] Dead columns to drop: `songs.category` (all 1608 = `'pop'`, read by nothing), `songs.translation_credit` (2 rows).
- [ ] Admin "Make Official" button — promote top-voted community translation into lyrics_english.
- [ ] `songs`/`song_artists` insert isn't atomic — needs a Postgres function via `rpc()`. Only one RPC exists today (`current_profile_role`).

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


## Hardening follow-up — 2026-09-09

### Verification and rollout
- `npm test`: 14 tests (all 12 original cases preserved with async generation, plus fallback and edit-guard coverage). Importer dry run: 1 song, no errors, no writes.
- `npm run lint`: 0 errors, the same 9 existing warnings.
- `npm run build`: succeeds, with 1608 songs and 31 artists prerendered. Before → after: shared lyrics 302.68 → 1.11 kB (gzip 138.81 → 0.60); dictionary is now a separate 302.00 kB chunk (gzip 138.47), loaded only for fallback on song pages. Add/Edit slug generation and StatsPage still need it on their own routes. Main entry remains roughly 521 kB; this change removes the dictionary from the song route's static dependency graph, not from the entire site.
- `verify:rls` was unsafe despite earlier notes: it PATCHed existing profiles/translations, DELETEd existing comments, and cleaned up songs by a broad title filter. It now creates two disposable users and explicit probe rows, targets their exact returned IDs, and confirms cleanup. After Daniel applied the RLS migration: 27 passing checks including cleanup, 0 failures. A two-voter check confirms the embedded count reads both vote rows. An anonymous author's counter PATCH was blocked under current RLS; that does **not** prove the column is revoked for every real account. The new migration's `has_column_privilege` assertions cover that after application.
- Daniel applied `20260909000000_likes_ownership_and_admin_song_writes.sql`; live probes now pass. Its filename uses **ownership**, not the `ommership` typo in the pasted request. Avatar bucket limits and backups remain Daniel's actions too.
- Daniel confirmed successful application of `20260909020000_artist_names_and_lookup_index.sql`; corrected names were independently read back, and the fallback was then removed. No production artist data or migrations were written by the agent.
- **After deploying the new vote-reading code:** apply `20260909010000_translation_vote_counts.sql`. Do not apply all migrations blindly by filename order: artist reconciliation must precede fallback removal, while counter privileges follow the app deployment. Existing open tabs running the old vote code may need refreshing.
- Artist read-only checks passed for `G.E.M.`, `周杰倫`, and `邓寓君 (等什么君)`, plus malformed/filter-injection names. All five reconciled English-name routes also passed through the junction after fallback removal. Names/slugs use exact matches; no song-name fallback remains.
- Additional data discrepancy found read-only: `song_artists` links song **11** (a SING song in the song metadata) to both SING and Silence Wang (`10092190-1f71-416b-a2ff-013cabdb1575`). No link was deleted: confirm credits before changing attribution. 100% junction coverage is not proof of correct attribution.
- No deployment was performed. Preserve flat prerender filenames, raw artist names, `cleanUrls: true`, and `trailingSlash: false`. Check the live song title after the eventual deploy as documented above.

### Stable line anchors — proposal only
The count warning deliberately does not remap contributions. A cheap next step is to store the **exact original line text** beside each contribution, then compare it before display; mismatches become explicitly detached instead of silently attached to a different lyric. Exact text is easier to inspect than a hash and avoids choosing a hash/normalisation protocol. Backfill only against a reviewed snapshot because historical indices may already be wrong. Repeated identical lines remain ambiguous; fully stable anchoring needs persisted line UUIDs and an editor that preserves them across edits. Build that only when edits must retain contributions automatically.

### StatsPage aggregation — proposal only, SQL not applied
Moving all 11 analyses into PostgreSQL is not simpler than the current code: PostgreSQL cannot run `pinyin-pro`, script conversion and word-context readings would drift, and materialised-view refresh still needs a job. Prefer one precomputed JSON snapshot behind a read-only RPC. Extract the existing analyses into a shared JS module, reuse them from a service-role batch job, and publish all results in a single atomic upsert. The browser would fetch the small snapshot through `queries.js` instead of downloading lyrics or importing pinyin for stats. Keep the current page until the complete snapshot exists; moving only three charts would leave the 2 MB download intact.

Proposed SQL (review before applying):
```sql
create table public.catalogue_stats_snapshot (
  id boolean primary key default true check (id),
  generated_at timestamptz not null default now(),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload ?& array['characters', 'tones', 'rhymes']
  )
);
alter table public.catalogue_stats_snapshot enable row level security;
revoke all on public.catalogue_stats_snapshot from public, anon, authenticated;
grant select on public.catalogue_stats_snapshot to anon, authenticated;
grant select, insert, update on public.catalogue_stats_snapshot to service_role;
create policy catalogue_stats_read on public.catalogue_stats_snapshot
  for select to anon, authenticated using (true);

create function public.get_catalogue_stats()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('generated_at', generated_at, 'data', payload)
  from public.catalogue_stats_snapshot where id = true
$$;
revoke all on function public.get_catalogue_stats() from public;
grant execute on function public.get_catalogue_stats() to anon, authenticated;
```

The job sends `{id: true, generated_at, payload}` using the service role; payload includes character frequencies, tone totals, per-song rhyme densities and the remaining existing chart results. The single upsert replaces the complete snapshot; failures retain the previous one. Page through the full catalogue using a consistent snapshot/export if imports can run concurrently. Run after controlled imports/curation and on a daily schedule, show the generated timestamp, and monitor failures; no secrets belong in the client. Script toggling requires totals computed from simplified and traditional inputs separately where conversion merges characters, not merely relabelled output. Before extraction, fix the tone analyzer's `/g` regex `.test()` statefulness and lock expected tone/rhyme examples in tests. This proposal is intentionally not implemented: the batch job, refresh lifecycle, and all-chart migration are more work than the requested hardening pass.

### Vercel dependency fix
`react-is` is a required Recharts peer dependency, not an unused package. Keep it explicitly in `package.json`: `.npmrc` sets `legacy-peer-deps=true`, so clean installs do not install peers automatically. Its earlier removal was masked by the local node_modules and stale lockfile; Vercel failed resolving Recharts/ReactUtils.js. Restore it and verify with `npm ci` before building.

Verified after restoring `react-is@19.2.5`: clean `npm ci`, full sitemap/Vite/prerender build, all 14 tests, and lint (0 errors, 9 existing warnings) passed. Regenerated package-lock.json also removes stale entries for the previously removed shadcn/sitemap packages.
