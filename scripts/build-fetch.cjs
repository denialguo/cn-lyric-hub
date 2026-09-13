const { setTimeout: sleep } = require('node:timers/promises');

/** Retry only transient build-time read failures; never accept an error as rows. */
async function fetchRows(url, headers, { fetchImpl = fetch, wait = sleep } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let retry = false;
    try {
      const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(15000) });
      retry = [408, 429, 500, 502, 503, 504].includes(response.status);
      if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Catalogue response is not an array');
      return rows;
    } catch (error) {
      const transient = retry || error.name === 'TimeoutError' ||
        error.name === 'AbortError' || error instanceof TypeError;
      if (!transient || attempt === 2) throw error;
      console.warn(`Catalogue read failed (${error.message}); retry ${attempt + 1}/2`);
      await wait(1000 * 2 ** attempt);
    }
  }
}
module.exports = { fetchRows };
