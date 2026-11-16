import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// How many submissions are waiting for an admin. UX only: RLS decides who can read the table.
// Re-checks every minute and when the tab regains focus, so a new submission shows up without a reload.
export function usePendingSubmissions(enabled) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) { setCount(0); return; }
    let cancelled = false;
    const refresh = async () => {
      const { count: waiting, error } = await supabase.from('song_submissions')
        .select('*', { count: 'exact', head: true }).in('status', ['pending', 'pending_edit']);
      if (!cancelled && !error) setCount(waiting || 0);
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [enabled]);
  return count;
}
