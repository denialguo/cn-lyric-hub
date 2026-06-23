import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Cached across the session so navigating between Add/Edit doesn't refetch
let cache = null;

async function loadTagSuggestions() {
  if (cache) return cache;

  cache = (async () => {
    const PAGE = 1000;
    const counts = new Map();        // lowercase -> count
    const display = new Map();       // lowercase -> first-seen original casing

    // Page past Supabase's 1000-row cap to see every song's tags
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('songs')
        .select('tags')
        .range(from, from + PAGE - 1);
      if (error) break;
      for (const row of data || []) {
        if (!Array.isArray(row.tags)) continue;
        for (const raw of row.tags) {
          const tag = (raw || '').trim();
          if (!tag) continue;
          const key = tag.toLowerCase();
          counts.set(key, (counts.get(key) || 0) + 1);
          if (!display.has(key)) display.set(key, tag);
        }
      }
      if (!data || data.length < PAGE) break;
    }

    // Most-used tags first
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => display.get(key));
  })();

  return cache;
}

export function useTagSuggestions() {
  const [suggestions, setSuggestions] = useState(cache && typeof cache.then !== 'function' ? cache : []);

  useEffect(() => {
    let active = true;
    loadTagSuggestions().then((list) => {
      if (active) setSuggestions(list);
    });
    return () => { active = false; };
  }, []);

  return suggestions;
}
