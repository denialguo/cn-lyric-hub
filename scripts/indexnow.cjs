// Usage: --liked = only songs with likes.
// Usage: npm run indexnow -- <url> [url...]   (no args = every URL in public/sitemap.xml)
const fs = require('fs')
const key = 'cf253a099c95f7ae9d2b54800ad07809'
const host = 'cnlyrics.app'
const args = process.argv.slice(2)
async function likedUrls() {
  require('dotenv').config({ path: '.env.local' })
  const base = process.env.VITE_SUPABASE_URL
  const h = { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` }
  // !inner join keeps only songs with at least one like
  const r = await fetch(`${base}/rest/v1/songs?select=slug,song_likes!inner(song_id)&limit=1000`, { headers: h })
  if (!r.ok) throw new Error('liked query failed: ' + r.status)
  return (await r.json()).map((s) => `https://${host}/song/${s.slug}`)
}
async function main() {
let urls = args.filter((a) => a !== '--liked')
if (args.includes('--liked')) urls = await likedUrls()
else if (!urls.length) {
  const xml = fs.readFileSync(__dirname + '/../public/sitemap.xml', 'utf8')
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}
// ponytail: one POST, IndexNow caps at 10k URLs; chunk if the sitemap outgrows that
return fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urls }),
}).then((r) => {
  console.log(r.status, r.statusText, `(${urls.length} urls)`)
  process.exit(r.ok ? 0 : 1)
})
}
main().catch((e) => { console.error(e.message); process.exit(1) })
