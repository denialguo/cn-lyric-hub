# CN Lyric Hub — Project Context

Read by Claude Code (`CLAUDE.md`) and Codex (`AGENTS.md` is a symlink to this file — edit CLAUDE.md only).

**This file is rules and architecture only.** No dated logs, no verification transcripts, no to-do lists:
- History → commit messages (`git log`).
- Work to do → GitHub Issues (`gh issue list`). One issue per session; commit with `fixes #N`.
- Only add something here if every future session needs it.

## What This Is
Community Chinese-lyrics site: per-character ruby pinyin, community line translations with voting, and a live Simplified/Traditional toggle. Personal project by Daniel. Live: https://cnlyrichub.vercel.app

## Stack
- React 19 + Vite 6 + Tailwind v4 + react-router v7, on Vercel.
- Supabase (Postgres + Auth + PostgREST). **No API server** — the browser calls PostgREST with the public anon key, so **RLS is the only authorization layer**. A `role === 'admin'` check in React is UX, not security.
- `pinyin-pro` (pinyin), `chinese-conv` (`sify`/`tify`), `recharts`, `lucide-react`, `react-helmet-async`.
- `react-is` is a required Recharts peer. `.npmrc` sets `legacy-peer-deps=true`, so it must stay in package.json or Vercel builds fail.

## Where things live
- `src/lib/queries.js` — **the data-access seam.** Any query with more than one caller goes here (sanitising, paging past the 1000-row cap, errors). Includes `publishSong()` (the `publish_song` RPC).
- `src/utils/lyrics.js` — **the only pinyin module**: `isChinese`, `generatePinyin`, `alignSyllables`, `generateCharacterPinyin`. The importer uses it via dynamic `import()`, so stored and rendered pinyin can't drift. Never write a second copy.
- `src/lib/identity.js` — the only place that decides "real account vs anonymous". Use `isRealAccount` / `isAdmin` / `submitterName`, never bare `if (user)` or `user.email`.
- `src/lib/storage.js` — all localStorage access (never throws).
- `src/lib/lineAnchors.js`, `lineEdits.js` — contribution anchoring and the line-edit guard.
- `src/lib/catalogueStats.js` — stats analyses, run by `scripts/refresh-stats.mjs`, not in the browser.
- `supabase/migrations/` — schema + RLS, applied by pasting into the Supabase SQL editor (in order; check each file's header for rollout notes). `supabase/tests/` — transactional SQL tests.

## Database — traps
- Song ids are **bigint**; every other id is uuid.
- `songs` has **no `status` column** (only `song_submissions` does) — sending one fails the insert with `PGRST204`. `song_submissions` has no `source` column.
- `songs.submitted_by` / `last_edited_by` are free-text display names, not usernames.
- Lyrics are **three parallel newline-delimited columns** (`lyrics_chinese`, `lyrics_pinyin`, `lyrics_english`); line N of each is the same line. Postgres doesn't enforce equal line counts — the app does.
- `cover_url` is `''` when missing, **never NULL** (`cover_url.neq.""` filters depend on it). Covers are hotlinked from Apple; `SongCard` falls back on `onError`.
- `line_comments`, `comment_votes`, `comment_likes` FK to `line_comments`, not `comments`. `comments` (song-level) has no `line_index`.
- Line contributions (`line_translations`, `line_comments`) store `original_line`; a trigger rejects rows whose text doesn't match the live lyric line. Compare stored text, never the user's display script.
- `song_revisions` is written only by the `songs_snapshot` trigger (content columns only — cover/year backfills write none). Clients are read-only.
- PostgREST caps reads at **1000 rows** — page with `fetchAllRows` / `.range`.
- Btree leftmost-prefix rule: an index on `(a, b)` doesn't serve a filter on `b` alone. Leading-wildcard `ilike` can't use a btree at all.

## Auth and RLS
- **A Supabase anonymous session has the Postgres role `authenticated`.** `to authenticated` ≠ "real account". Policies use `is_real_account()` (JWT `is_anonymous`) and `is_admin()`.
- Direct `songs` writes are admin-only. Everyone else goes through `song_submissions`; admins publish/approve via the `publish_song` RPC (one transaction).
- Lazy anonymous auth: never `signInAnonymously()` on page load — write paths call `ensureUser()`.
- `profiles.role` is frozen by RLS; promotion only via the SQL editor.
- Run `npm run verify:rls` after any policy change. It probes the REST API as an attacker, uses disposable rows/users, and cleans up by exact id.
- ⚠️ Never restore a row from a `Prefer: return=representation` PATCH response — it returns the row *after* the write. Snapshot first, or restore from the corpus (`~/Downloads/Chinese_Lyrics/`).
- Service-role key (scripts only) bypasses RLS and is deliberately not `VITE_`-prefixed so it can't be bundled.

## Pinyin and scripts
- Pinyin is generated **at ingest**, from whole Han runs, so `pinyin-pro` resolves polyphones by context (音乐 → `yīn yuè`).
- `alignSyllables()` returns one syllable per Han char or `null`; on `null`, `LyricLine` lazily regenerates per character. 99.65% of real lines align; the rest have word-grouped stored pinyin (`píngguǒ`).
- Script conversion is client-side only; the DB stores one form. Conversion preserves character count, which keeps alignment valid in Traditional mode. Search expands queries to raw/`sify`/`tify` variants.

## SEO prerender — easy to regress
`scripts/prerender.cjs` writes static HTML per song/artist after `vite build`. Vercel serves static files before rewrites.
1. Files are flat `<route>.html`, never `<route>/index.html`.
2. `vercel.json` needs `"cleanUrls": true` and `"trailingSlash": false`.
3. Artist filenames use the **raw** name, not `encodeURIComponent` (servers decode the path before matching files).
- New page route → add it to `STATIC_ROUTES` in `prerender.cjs` **and** `generate-sitemap.cjs`.
- Prerender exits 0 on failure; sitemap failure fails the build. Both use `scripts/build-fetch.cjs` retries.
- A full corpus import (~49,760 files) would exceed the 50,000-URL single-sitemap limit.

## Commands
```
npm run dev            # vite dev server
npm test               # node --test src scripts
npm run lint           # eslint (0 errors expected)
npm run build          # sitemap → vite build → prerender
npm run verify:rls     # live RLS probe; exits 1 on a hole
npm run backup         # all tables → backups/*.json, aborts on row-count mismatch
npm run stats:refresh  # recompute the stats snapshot (also hourly via GitHub Actions)
```

## Bulk scripts (`scripts/`, service-role key from `.env.local`)
- `import-lyrics.cjs` — corpus import; `--limit`, `--artists`, `--dry-run`. Dedups on `title_zh + artist_en`.
- `fetch-covers.cjs`, `fetch-years.cjs` — iTunes enrichment via `itunes.cjs`. Use `fetch-years --delay 2500` or slower: throttling silently lowers accuracy. `--refresh` must not clear years unless `--clear-unverified` is passed.
- Take `npm run backup` before any bulk write. The DB is the only copy of user content.

## Data reality (check before building on a column)
- 1,608 songs from ~3% of the corpus. `lyrics_english` filled on only 7. `tags` almost empty. `category` is always `'pop'` (dead).
- Very few real users; most auth rows are anonymous sessions.

## Daniel's preferences
- Casual, direct, fast iteration — "just do it" over long planning.
- No UI noise: no "No translation available", no verbose empty states. Missing covers show gradient + music icon.
- Dark-mode-first (slate-950).
- Shared components over copy-paste.
- Don't create summary documents, .md files or READMEs as deliverables.

## Don't
- Don't use `alert()` / `window.confirm()` — use ToastContext.
- Don't use `window.location.reload()` — use React state.
- Don't fetch votes/likes site-wide — scope queries to the current context.
- Don't sign in anonymously on page load.
- Don't write a second pinyin implementation.
- Don't rely on a frontend role check for security.
- Don't append session logs to this file.
