/**
 * Route chunk prefetching.
 *
 * The heavy dashboard pages are code-split, so the first navigation to them
 * pays for a network round-trip before React can even start rendering. That
 * makes clicking "Incidents" feel like it "hangs" on a slow page.
 *
 * We warm those chunks up:
 *  - on idle, shortly after the shell mounts
 *  - on hover / pointer-down over a sidebar link
 *
 * Every loader is idempotent (dynamic import caches the module), so calling
 * prefetchRoute repeatedly is free.
 */

type Loader = () => Promise<unknown>;

const loaders: Record<string, Loader> = {
  '/dashboard': () => import('@/pages/dashboard/DashboardPage'),
  '/incidents': () => import('@/pages/dashboard/IncidentsPage'),
  '/incidents/:id': () => import('@/pages/dashboard/IncidentDetailPage'),
};

const started = new Set<string>();

const run = (key: string) => {
  if (started.has(key)) return;
  const loader = loaders[key];
  if (!loader) return;
  started.add(key);
  loader().catch(() => {
    // Allow a retry later if the chunk failed to load (offline, deploy swap).
    started.delete(key);
  });
};

/** Prefetch the chunk backing a route path (exact or prefix match). */
export const prefetchRoute = (path?: string | null) => {
  if (!path) return;
  if (loaders[path]) {
    run(path);
    return;
  }
  // Detail routes: /incidents/<id>, /alerts/<id>, /cases/<id>, ...
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2) {
    run('/incidents/:id');
  } else if (segments.length === 1) {
    run('/incidents');
  }
};

/**
 * Warm the most-used dashboard chunks.
 *
 * We assume every session ends up on /incidents and then on /incidents/:id,
 * so these two are fetched immediately (not on idle) — waiting for an idle
 * callback is exactly what made the first navigation stall before the
 * skeleton could paint.
 */
export const prefetchCommonRoutes = () => {
  run('/incidents');
  run('/incidents/:id');
};
