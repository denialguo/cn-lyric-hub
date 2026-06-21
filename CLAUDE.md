# CN Lyric Hub — Project Context

## What This Is
Community-driven Chinese lyrics platform. Users browse Chinese songs with pinyin pronunciation guides and English translations. The core differentiator: per-line ruby pinyin alignment, community translation voting (like Genius but for Chinese music), and real-time traditional/simplified script toggling. Built by Daniel as a personal project.

## Tech Stack
- **Frontend**: React 18 + Vite, Tailwind CSS, deployed on Vercel
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Key libraries**: `pinyin-pro` (pinyin generation), `opencc-js` (simplified ↔ traditional via `sify()`/`tify()`), `recharts` (stats charts), `lucide-react` (icons)
- **Domain**: https://cnlyrichub.vercel.app

## File Structure
- `src/components/` — Navbar, SongCard, LyricLine, LineSidebar, CommentsSection, CommentItem, ArtistSearch, LyricsEditor, ThemeSettings, TagInput
- `src/pages/` — HomePage, SongPage, AddSongPage, EditSongPage, AdminDashboard, AuthPage, ProfilePage, PublicProfile, ArtistPage, StatsPage, NotFoundPage
- `src/context/` — AuthContext (lazy anon auth), ThemeContext (dark/light, script mode, accent color, lyric sizes/colors), ToastContext (toast.success/error/warning/info + confirm())
- `scripts/` — import-lyrics.cjs, fetch-covers.cjs, fetch-years.cjs, generate-sitemap.cjs

## Database Schema (Supabase)
### Core Tables
- `songs` — id (UUID PK), title_zh, title_en, slug (unique), lyrics_chinese, lyrics_pinyin, lyrics_english (parallel newline-delimited), cover_url, youtube_url, artist_en, artist_zh, tags (text[]), bio, credits, year (int), submitted_by, last_edited_by, user_id, created_at, updated_at
- `artists` — id (UUID PK), name_en, name_zh, slug
- `song_artists` — junction table, FKs to songs + artists
- `profiles` — id (UUID FK → auth.users), username (unique), display_name, avatar_url, role (admin/user)
- `song_submissions` — staging table mirroring songs schema, for non-admin submissions
- `line_translations` — song_id (FK), line_index, translation_text, user_id (FK), votes
- `comments` — song_id (FK), line_index, user_id (FK), content, created_at
- `comment_votes` — comment_id (FK), user_id (FK), unique per user
- `song_likes` — song_id (FK), user_id (FK), unique per user

### RLS
- songs: public read, authenticated insert/update
- profiles: public read, own-row update
- likes/votes: own-row insert/delete
- Bulk scripts use SUPABASE_SERVICE_ROLE_KEY to bypass RLS

### Triggers
- `songs_updated_at` — auto-updates `updated_at` on any row change

## Key Architecture Decisions
- **Lyrics as parallel columns** (not a lines table) — keeps inserts atomic, editing simple, avoids hundreds of rows per song
- **Script conversion is client-side only** — database stores one canonical form, ThemeContext converts on render
- **Lazy anonymous auth** — no signInAnonymously() on page load, only on first interaction via ensureUser()
- **N+1 elimination** — HomePage batch-fetches all user liked song IDs in one query
- **Pinyin auto-fill segments Chinese vs Latin** — only converts Chinese character runs through pinyin-pro, passes Latin/numbers through as-is
- **Latin-only lyric lines** — detected via regex, rendered at smaller italic text size instead of hanzi scale
- **No "No translation available" message** — if no translation exists, show nothing; the sidebar handles contribution flow
- **Toast system replaces all alert()/confirm()** — ToastContext with promise-based confirm()

## Bulk Scripts
All in `scripts/`, all use `.env.local` auto-detection and SUPABASE_SERVICE_ROLE_KEY:
- `import-lyrics.cjs` — Reads Chinese Lyric Corpus folder structure, auto-generates pinyin, dedup checks title_zh + artist_en before insert. Supports --limit, --artists, --dry-run
- `fetch-covers.cjs` — iTunes API for album art on songs with empty cover_url, 3 search strategies
- `fetch-years.cjs` — iTunes API for release dates, populates year column
- `generate-sitemap.cjs` — Uses updated_at for lastmod, runs as Vercel build step

## Environment Variables (.env.local)
```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
No spaces after `=`. Vite exposes VITE_ prefixed vars to frontend. Service role key is scripts-only.

## Daniel's Preferences
- Hates unnecessary UI noise — no "No translation available" on every line, no verbose empty states
- Wants things to look intentional, not broken — missing covers show gradient + music icon placeholder, not broken img tags
- Prefers direct, fast iteration — "just do it" over lengthy planning discussions
- Dark mode first aesthetic, slate-950 backgrounds
- Do NOT create summary documents, .md files, or READMEs as deliverables
- Casual communication style
- Values deduplication in code — shared components over copy-paste (ArtistSearch, LyricsEditor extracted)

## Pending Work
- [ ] Admin "Make Official" button — promote top-voted community translation into lyrics_english column
- [ ] FAQ page — static accordion page
- [ ] ArtistPage/PublicProfile N+1 likes optimization
- [ ] Error boundaries (React error boundary wrapper)
- [ ] Light mode CSS refactor to CSS custom properties
- [ ] Navbar button click jank — ThemeSettings and profile buttons occasionally unresponsive. Multiple fixes attempted (isolate, click-outside removal, z-index). Root cause not fully identified. Need DevTools element inspector screenshot of blocking element.
- [ ] Run full import: `node scripts/import-lyrics.cjs ~/Downloads/Chinese_Lyrics --limit 500` then `fetch-covers.cjs` then `fetch-years.cjs`
- [ ] Auto-promote translations by vote threshold (deferred until user base grows)

## What NOT to Do
- Don't create .md or README deliverable files (user preference)
- Don't show "No translation available" anywhere
- Don't use alert() or window.confirm() — use ToastContext
- Don't use window.location.reload() — use React state
- Don't fetch all user votes site-wide — scope queries to current context
- Don't sign in anonymously on page load — use lazy ensureUser()
