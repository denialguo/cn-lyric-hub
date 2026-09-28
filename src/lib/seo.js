/**
 * Whether a data-backed page should carry `noindex`: only once the query has
 * succeeded and confirmed there is nothing there.
 *
 * A failed fetch does not establish that public content is missing.
 */
export const isConfirmedMissing = ({ loading, error, found }) => !loading && !error && !found;

// The snapshot lives outside #root so React cannot erase it on mount. Match the
// route explicitly: client-side navigation must never reuse another page's data.
export function readPrerenderedPage(type, key) {
  try {
    const page = JSON.parse(document.getElementById('prerender-data')?.textContent || 'null');
    return page?.type === type && page.key === key ? page.data : null;
  } catch {
    return null;
  }
}
