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
 * Scheduled on idle (with a short timeout fallback) so downloading and
 * parsing those large chunks never competes with the page the user is
 * actually looking at — eager prefetching made heavy pages such as /agents
 * feel blocked while they mounted.
 */
export const prefetchCommonRoutes = () => {
  const warm = () => {
    run('/incidents');
    run('/incidents/:id');
  };
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (typeof ric === 'function') ric(warm, { timeout: 3000 });
  else window.setTimeout(warm, 1500);
};

