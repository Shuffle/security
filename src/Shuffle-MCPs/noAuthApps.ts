/**
 * Single source of truth for "which apps never require authentication".
 *
 * Shuffle's own internal apps (Shuffle Workflows, Shuffle Workflows Builder,
 * Shuffle Incidents, Shuffle Datastore, ...) ride on the user's existing
 * Shuffle session, so they must never ask for credentials — neither in the
 * Agent area (/agents) nor in the "App configuration" sidebar.
 *
 * Use `appRequiresAuthentication(name)` everywhere instead of ad-hoc lists.
 */

/** Normalise "Shuffle Host Monitors" / "shuffle-host-monitors" -> shuffle_host_monitors. */
export const normalizeAppName = (name: string) =>
  (name || '').toLowerCase().trim().replace(/[\s\-]+/g, '_');

/** Explicit no-auth apps that do not carry the "shuffle" prefix. */
export const NO_AUTH_APPS = new Set<string>([
  'shuffle_incidents',
  'shuffle_host_monitors',
  'shuffle_monitors',
  'shuffle_sensors',
  'shuffle_workflows',
  'shuffle_workflows_builder',
  'shuffle_datastore',
  'shuffle_apps',
  'shuffle_detection',
  'shuffle_files',
  'shuffles_app_management',
  'shuffle_tools',
  'tools',
  'http',
  'singul',
  'core',
  'webhook',
  'email',
]);

/**
 * True when the app is a built-in Shuffle app that authenticates through the
 * user's session (any "Shuffle ..." app) or is in the explicit list above.
 */
export const isNoAuthApp = (name?: string | null): boolean => {
  if (!name) return false;
  const target = normalizeAppName(String(name));
  if (!target) return false;
  if (NO_AUTH_APPS.has(target)) return true;
  // Every internal Shuffle app ("shuffle_*" / "shuffles_*") is session-based.
  return /^shuffles?_/.test(target);
};

/** Inverse of `isNoAuthApp` — the predicate most call sites want. */
export const appRequiresAuthentication = (name?: string | null): boolean => !isNoAuthApp(name);
