import { useEffect, useState } from 'react';
import { readPrerenderedPage } from '../lib/seo';
import { cataloguePage } from '../lib/catalogue';

export function useCataloguePage(kind, page = 1) {
  const key = `${kind}/${page}`;
  const snapshot = readPrerenderedPage('catalogue', key);
  const [state, setState] = useState({ key, data: snapshot, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const snapshot = readPrerenderedPage('catalogue', key);
    if (snapshot) {
      setState({ key, data: snapshot, error: false });
      return;
    }
    const controller = new AbortController();
    setState({ key, data: null, error: false });
    // This small build snapshot also supports SPA navigation without fetching lyrics.
    fetch('/catalogue.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Catalogue unavailable');
      return response.json();
    }).then(catalogue => setState({ key, data: cataloguePage(catalogue, kind, page), error: false, loaded: true }))
      .catch(error => {
        if (error.name !== 'AbortError') setState({ key, data: null, error: true });
      });
    return () => controller.abort();
  }, [key, kind, page, retry]);
  const current = state.key === key ? state : { data: snapshot, error: false };
  return { ...current, loading: !current.data && !current.error && !current.loaded, retry: () => setRetry(value => value + 1) };
}
