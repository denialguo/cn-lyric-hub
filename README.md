# CN Lyric Hub

A community database of Chinese song lyrics with per-character ruby Pinyin and
English translations. Every line renders as HTML `<ruby>` markup so the Pinyin
sits directly above each hanzi, and a toggle flips the whole page between
Simplified and Traditional instantly, client-side.

**Live:** https://cnlyrichub.vercel.app

## Stack

React 19 + Vite 6 + Tailwind v4 on Vercel, talking directly to Supabase
(PostgreSQL + Auth). There is no API server — the browser hits PostgREST, which
means Postgres row-level security *is* the authorization layer.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase keys
npm run dev
```

`.env.local`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # scripts only, never bundled
```

Only `VITE_`-prefixed variables reach the browser. The service-role key is
deliberately unprefixed so Vite cannot inline it.

## Commands

| | |
|---|---|
| `npm run dev` | dev server |
| `npm test` | unit tests for the Pinyin generation and ruby alignment |
| `npm run lint` | ESLint |
| `npm run verify:rls` | probe live RLS policies; exits non-zero on a hole |
| `npm run build` | regenerate the sitemap, then build |

## How the Pinyin alignment works

Lyrics are stored as three parallel newline-delimited columns
(`lyrics_chinese`, `lyrics_pinyin`, `lyrics_english`) where line *N* of each is
the same line of the song.

Pinyin is generated once at ingest rather than per render, because `pinyin-pro`
needs a whole word to resolve polyphonic characters — 音乐 is `yīn yuè` only
when the pair is passed together; character by character it comes out `yīn lè`.

At render, `alignSyllables()` in [`src/utils/lyrics.js`](src/utils/lyrics.js)
maps stored syllables onto Han characters positionally, and returns `null` when
the counts don't line up so `LyricLine` can fall back to per-character
generation. About 99.5% of lines take the fast path.

## Database

Schema and RLS policies live in [`supabase/`](supabase/). Policies are applied
by pasting the migration into the Supabase SQL editor; see
[`supabase/README.md`](supabase/README.md).

## Bulk scripts

```bash
node scripts/import-lyrics.cjs ~/Downloads/Chinese_Lyrics --limit 500 --dry-run
node scripts/fetch-covers.cjs --limit 50
node scripts/fetch-years.cjs --limit 50
```

All support `--dry-run` and `--limit`, read `.env.local`, and use the
service-role key. Enrichment scripts only touch rows where the target column is
still empty, so they are safe to re-run.
