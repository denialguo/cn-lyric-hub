/**
 * Shared iTunes Search API client for the enrichment scripts.
 *
 * The API is unauthenticated and Apple's guidance is roughly 20 requests/min,
 * enforced per-IP with HTTP 429. fetch() does not throw on 4xx/5xx, so every
 * status has to be checked explicitly.
 */

const TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class RateLimitError extends Error {
  constructor(term) {
    super(`iTunes rate limit persisted after ${MAX_RETRIES + 1} attempts (term: "${term}")`);
    this.name = 'RateLimitError';
  }
}

/**
 * One search. Returns a non-empty results array, or null when there is
 * genuinely no match / the request failed in a non-retryable way.
 *
 * Throws RateLimitError when 429s persist. That deliberately aborts the run:
 * continuing would march through the catalog recording "no cover found" for
 * songs that were only ever throttled, which silently poisons the data.
 */
async function search(term, { country } = {}) {
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=3` +
    (country ? `&country=${country}` : '');

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

      if (res.status === 429 || res.status >= 500) {
        if (attempt >= MAX_RETRIES) {
          if (res.status === 429) throw new RateLimitError(term);
          return null;
        }
        // Honour Retry-After when Apple sends one, otherwise back off exponentially.
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2000 * 2 ** attempt;
        console.warn(`    ⏳ HTTP ${res.status} — waiting ${wait}ms before retry`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) return null;

      const data = await res.json();
      return data.results?.length ? data.results : null;
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      // AbortError (timeout) and network failures land here.
      if (attempt >= MAX_RETRIES) {
        console.error(`    fetch error: ${err.message}`);
        return null;
      }
      await sleep(2000 * 2 ** attempt);
    }
  }
}

/**
 * Pull the largest artwork URL out of a result. iTunes encodes the dimensions
 * in the path, so swapping the segment yields a bigger image from the same CDN
 * — undocumented, hence the guards: an unrecognised format returns the
 * original URL rather than a mangled one.
 */
function artworkUrl(result) {
  const raw = result?.artworkUrl100 || result?.artworkUrl60;
  if (!raw) return null;
  if (raw.includes('100x100bb')) return raw.replace('100x100bb', '600x600bb');
  if (raw.includes('60x60bb')) return raw.replace('60x60bb', '600x600bb');
  return raw;
}

module.exports = { search, artworkUrl, sleep, RateLimitError };
