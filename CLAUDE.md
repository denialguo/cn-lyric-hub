# CN Lyrics — Project Context

Read by Claude Code (`CLAUDE.md`) and Codex (`AGENTS.md` is a symlink to this file — edit CLAUDE.md only).

**This file is rules and architecture only.** No dated logs, no verification transcripts, no to-do lists:
- History → commit messages (`git log`).
- Work to do → GitHub Issues (`gh issue list`). One issue per session; commit with `fixes #N`.
- Only add something here if every future session needs it.

## What This Is
CN Lyrics (formerly CN Lyric Hub): a place to read Chinese lyrics with per-character ruby pinyin, English line translations (community-contributed, with voting), and a live Simplified/Traditional toggle. Personal project by Daniel. Live: https://cnlyrics.app

## Stack
- React 19 + Vite 6 + Tailwind v4 + react-router v7, on Vercel.
- Supabase (Postgres + Auth + PostgREST). **No API server** — the browser calls PostgREST with the public anon key, so **RLS is the only authorization layer**. A `role === 'admin'` check in React is UX, not security.
- `pinyin-pro` (pinyin), `chinese-conv` (`sify`/`tify`), `recharts`, `lucide-react`, `react-helmet-async`.
- `react-is` is a required Recharts peer. `.npmrc` sets `legacy-peer-deps=true`, so it must stay in package.json or Vercel builds fail.

## Where things live
- `src/lib/queries.js` — **the data-access seam.** Any query with more than one caller goes here (sanitising, paging past the 1000-row cap, errors). Includes `publishSong()` (the `publish_song` RPC).
- `src/lib/pageMeta.js` — **the only place page titles/descriptions are templated** (React Helmet and `prerender.cjs` both import it; never hand-write a `<title>`). Tests reject `CN Lyric Hub` in public output.
- `src/utils/lyrics.js` — **the only pinyin module**: `isChinese`, `generatePinyin`, `alignSyllables`, `generateCharacterPinyin`. The importer uses it via dynamic `import()`, so stored and rendered pinyin can't drift. Never write a second copy.
- `src/lib/slugs.js` — **the only slug generator** (`/song/{primary-artist}-{romanized-title}`, ≤70 chars, `newSongSlug` for new songs, `assignSlugs` for the migration). `songs.slug` is persistent: never regenerate it when title/artist change. Old slugs live in `song_slug_aliases` (trigger-recorded) and redirect via `vercel.json` (`npm run redirects:sync`; Vercel caps `redirects` at 2,048). Japanese/Korean romanization tooling is script-only (`scripts/generate-slug-map.mjs`), never bundled.
- `src/lib/identity.js` — the only place that decides "real account vs anonymous". Use `isRealAccount` / `isAdmin` / `submitterName`, never bare `if (user)` or `user.email`.
- `src/lib/storage.js` — all localStorage access (never throws).
- `src/lib/lineAnchors.js`, `lineEdits.js` — contribution anchoring and the line-edit guard.
- `src/lib/catalogueStats.js` — stats analyses, run by `scripts/refresh-stats.mjs`, not in the browser.
- `supabase/migrations/` — schema + RLS, applied by pasting into the Supabase SQL editor (in order; check each file's header for rollout notes). `supabase/tests/` — transactional SQL tests.

## Database — traps
- Song ids are **bigint**; every other id is uuid.
- `songs` has **no `status` column** (only `song_submissions` does) — sending one fails the insert with `PGRST204`. `song_submissions` has no `source` column.
- `songs.submitted_by` / `last_edited_by` are free-text display names, not usernames.
- `lyrics_chinese` is a legacy name: it holds the **original performed lyric in any language**. `lyrics_pinyin` is pronunciation help; `lyrics_english` is the English rendering. A line originally sung in English is stored identically in both original and English columns; the UI shows it once (`src/lib/multilingual.js`).
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
- ⚠️ Scripts that write the live DB (`migrate:slugs`, `backfill:pinyin`) are dry-run by default; never pass `--write` without Daniel's explicit go-ahead for that run.
- Run `npm run verify:rls` after any policy change. It probes the REST API as an attacker, uses disposable rows/users, and cleans up by exact id.
- ⚠️ Never restore a row from a `Prefer: return=representation` PATCH response — it returns the row *after* the write. Snapshot first, or restore from the corpus (`~/Downloads/Chinese_Lyrics/`).
- Service-role key (scripts only) bypasses RLS and is deliberately not `VITE_`-prefixed so it can't be bundled.

## Lyric content rules
- Simplified, Traditional or mixed script, Cantonese/Taiwanese/slang/poetry and multilingual lines are valid, not errors. Never flag script variants as typos or silently rewrite source lyrics.
- Alignment failure ≠ bad data (mixed Latin/Han lines legitimately fail). Zhuyin/Bopomofo passages (solfège like `ㄒ一ㄌㄚ`) are real lyrics: `generatePinyin` keeps them verbatim, never "fix" them to pinyin.
- Translation jobs may write only `lyrics_english`; re-read the row before writing and refuse if the source changed. **Do not publish a translation batch to production without explicit authorization for that batch; draft/review files are not upload approval.**
- **Source-lyric ingestion gate:** `src/lib/lyricMetadata.js` detects credits, studios, source-site junk, instrumental markers and suspicious headers without rewriting lyrics. Bulk imports, add/edit screens and catalogue audits use it. On a warning, pause for source review; never silently delete or shift actual sung/spoken lines.
- **Database safeguard:** `songs_metadata_guard` rejects high-confidence scraped metadata on inserts and source-lyric updates, including direct SQL writes by agents. Existing source lines and English-only translation updates are unaffected. Source edits must preserve 1:1 pinyin/English alignment and reanchor any existing community contributions before changing indices.
- Display-only tweaks (e.g. hiding repeated adjacent English via `dedupeAdjacentEnglish`) happen in the presentation layer; never change stored text or line indices, since contributions key on them.
- Public pages show no implementation provenance (`source = import` is hidden). Keep such fields in the DB.
- Behaviour rules belong in tests, not just prose; add a test with each rule.

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
- Prerender and sitemap errors fail the build. Missing Supabase settings also fail `npm run build`, production mode and Vercel; only standalone local prerender may skip without settings. Both use `scripts/build-fetch.cjs` retries.
- A full corpus import (~49,760 files) would exceed the 50,000-URL single-sitemap limit.

## Git
- Commit locally; push only when Daniel says so. **Push with gh credentials, not plain `git push`** (the keychain holds a different account and returns 403): `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push`. If rejected as non-fast-forward, `git pull --rebase --autostash` with the same helper, re-run `npm test`, then push.
- Commit only the files for your task; the working tree often holds unrelated uncommitted work.
- No Claude/Co-Authored-By attribution lines in commits.

## Commands
```
npm run dev            # vite dev server
npm test               # unit tests (node --test); npm run test:browser for Playwright
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
