/**
 * localStorage that cannot take the app down.
 *
 * Every reader used to be a bare `JSON.parse(localStorage.getItem(k))`. One
 * malformed value — a half-written draft, a user poking devtools, a quota error
 * mid-write — threw during render. In ThemeContext that meant a permanent white
 * screen for that browser, with no error boundary to catch it and no way out
 * except clearing site data by hand.
 *
 * Reads never throw. Writes never throw (Safari private mode denies them).
 */

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    // A stored `null` should still yield the caller's fallback, not null.
    return parsed === null ? fallback : parsed;
  } catch {
    // Corrupt or unreadable — drop it so we don't fail the same way next load.
    try { localStorage.removeItem(key); } catch { /* private mode */ }
    return fallback;
  }
}

export function readString(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch {
    return fallback;
  }
}

export function writeString(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage denied. Preferences are not worth an exception.
  }
}

export function removeKeys(...keys) {
  for (const k of keys) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}
