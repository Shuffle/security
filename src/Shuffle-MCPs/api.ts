/**
 * API Configuration
 * 
 * Configure the base URL based on your deployment:
 * - Shuffle Cloud (EU): https://shuffler.io
 * - Shuffle Cloud (US): https://us.shuffler.io  
 * - Self-hosted: Your own backend URL (e.g., https://shuffle.yourdomain.com)
 *
 * The region URL is dynamically resolved from /api/v1/getinfo's `region_url` field.
 * If the user switches orgs, it resets to the default until getinfo is called again.
 */

import { installFetchBreaker, registerProtectedOrigin } from '@/Shuffle-MCPs/fetchBreaker';

// Install the global fetch breaker as soon as api.ts is imported. Idempotent —
// safe to call multiple times.
installFetchBreaker();

const DEV_BACKEND = 'https://tunnel.schemaless.org';
const PROD_BACKEND = 'https://shuffler.io';

// Base URL for Shuffle Automation dashboard (used in tool switcher)
export const SHUFFLE_AUTOMATION_URL = 'https://shuffler.io/new-dashboard';

// Known cloud domains that should always use shuffler.io as the default backend
const CLOUD_DOMAINS = ['shuffle.security', 'www.shuffle.security', 'security.shuffler.io', 'shutdown.no', 'www.shutdown.no'];

// Safely read Vite-style env vars without depending on `vite/client` types
// (the published library should not require Vite to be installed).
const getEnvVar = (key: string): string | undefined => {
  // Indirect access via `new Function` keeps `import.meta` out of the emitted
  // CJS bundle. tsup otherwise inlines it verbatim into `dist/index.js`, which
  // breaks consumers whose webpack rolls the CJS build into a non-ESM bundle
  // ("Cannot use 'import.meta' outside a module").
  try {
    const meta = (new Function('try { return import.meta } catch { return undefined }')()) as
      | { env?: Record<string, string | undefined> }
      | undefined;
    return meta?.env?.[key];
  } catch {
    return undefined;
  }
};

// Determine if we're in Lovable preview (dev) or published (prod)
export const isDevEnvironment = (): boolean => {
  if (getEnvVar('VITE_SHUFFLE_API_URL')) return false;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  // Every Lovable-hosted host (sandbox, id-preview--, preview--, and the
  // published *.lovable.app site) is a testing environment and must talk to
  // the dev backend, never to its own origin.
  return hostname.includes('lovableproject.com')
    || hostname.includes('id-preview--')
    || hostname.endsWith('.lovable.app')
    || hostname.endsWith('.lovable.dev');
};

/** Check if running on a known Shuffle Cloud domain */
export const isCloudDomain = (): boolean => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  return CLOUD_DOMAINS.includes(hostname);
};

/**
 * True when running on Shuffle Cloud (a known *.shuffler.io / shutdown.no domain).
 * Use this to gate cloud-only features like Google Analytics (ReactGA).
 *
 * isCloud()  → cloud deployment, GA allowed, telemetry OK
 * !isCloud() → either Lovable preview (dev) OR self-hosted onprem; do NOT call GA
 */
export const isCloud = (): boolean => isCloudDomain();

/**
 * True when running self-hosted (onprem) — i.e. NOT in Lovable preview AND NOT on a known cloud domain.
 */
export const isOnprem = (): boolean => !isDevEnvironment() && !isCloudDomain();

const getDefaultBaseUrl = (): string => {
  const envUrl = getEnvVar('VITE_SHUFFLE_API_URL');
  if (envUrl) {
    return envUrl;
  }
  if (isDevEnvironment()) return DEV_BACKEND;
  // Cloud domains always default to shuffler.io; region_url from getinfo may override later
  if (isCloudDomain()) return PROD_BACKEND;
  // Self-hosted / on-prem: use current domain (nginx proxies /api/* to backend)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return PROD_BACKEND;
};

// Dynamic region URL state (only applies in production, not dev)
const REGION_STORAGE_KEY = 'shuffle_region_url';

/** Read the cached region URL (persisted per org) so the very first request
 *  after a reload already targets the right region — no waiting for getinfo. */
const readCachedRegion = (): { url: string | null; orgId: string | null } => {
  if (typeof window === 'undefined') return { url: null, orgId: null };
  try {
    const raw = localStorage.getItem(REGION_STORAGE_KEY);
    if (!raw) return { url: null, orgId: null };
    const parsed = JSON.parse(raw);
    return { url: parsed?.url || null, orgId: parsed?.orgId || null };
  } catch {
    return { url: null, orgId: null };
  }
};

const cached = readCachedRegion();
let _regionUrl: string | null = cached.url;
let _trackedOrgId: string | null = cached.orgId;
// Host-injected base URL (set via setHostBaseUrl from a host that passes
// `globalUrl` through ShuffleHostProps). Highest priority — overrides region
// URL and the auto-detected default. Use this for self-hosted backends.
let _hostBaseUrl: string | null = null;

const REGION_EVENT = 'shuffle:region-url';
let _lastBroadcastUrl: string | null = cached.url;

const persistRegion = (url: string | null, orgId: string | null) => {
  if (typeof window === 'undefined') return;
  const changed = url !== _lastBroadcastUrl;
  _lastBroadcastUrl = url;
  try {
    if (url) localStorage.setItem(REGION_STORAGE_KEY, JSON.stringify({ url, orgId }));
    else localStorage.removeItem(REGION_STORAGE_KEY);
  } catch { /* ignore */ }
  // Broadcast only when the URL itself changed, so the other api module
  // (Shuffle-Core) and other tabs stay in sync without redundant events.
  if (!changed) return;
  try { window.dispatchEvent(new CustomEvent(REGION_EVENT, { detail: { url, orgId } })); } catch { /* ignore */ }
};

// Keep this module in sync when the region is set from the other api module
// (or another tab). Without this, half the app keeps hitting shuffler.io.
if (typeof window !== 'undefined') {
  const sync = () => {
    const next = readCachedRegion();
    if (next.url !== _regionUrl) {
      _regionUrl = next.url;
      _lastBroadcastUrl = next.url;
      console.log(`[API] Region URL synced to: ${_regionUrl || 'default'}`);
    }
    _trackedOrgId = next.orgId;
  };
  window.addEventListener(REGION_EVENT, sync);
  window.addEventListener('storage', (e) => {
    if (e.key === REGION_STORAGE_KEY) sync();
  });
}


/** Check if a URL is a valid shuffler.io subdomain */
const isShufflerSubdomain = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.shuffler.io') || parsed.hostname === 'shuffler.io';
  } catch {
    return false;
  }
};

/**
 * Set the dynamic region URL from getinfo response.
 * ALWAYS honored for the current org/tenant (including dev/preview) as long as
 * the URL is a valid shuffler.io subdomain different from the default backend.
 * Persisted in localStorage so later page loads do not have to wait on getinfo.
 */
export const setRegionUrl = (regionUrl: string | undefined | null, orgId: string | undefined | null) => {
  _trackedOrgId = orgId || null;

  if (regionUrl && isShufflerSubdomain(regionUrl)) {
    // Normalize: strip trailing slash
    const normalized = regionUrl.replace(/\/+$/, '');
    if (normalized !== PROD_BACKEND) {
      _regionUrl = normalized;
      persistRegion(_regionUrl, _trackedOrgId);
      console.log(`[API] Region URL set to: ${_regionUrl}`);
      return;
    }
  }

  // No valid region override — use default
  _regionUrl = null;
  persistRegion(null, _trackedOrgId);
};

/**
 * Single entry point for applying a region from ANY backend response that
 * carries one (`/api/v1/getinfo`, `/api/v1/orgs/{id}/change`, ...). Extracts
 * `region_url` (top-level first, then `active_org`) and routes it through
 * `setRegionUrl`, so setting + broadcasting always happens in one place.
 */
export const applyRegionFromPayload = (
  payload: any,
  orgIdOverride?: string | null,
): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const orgId = orgIdOverride ?? payload?.active_org?.id ?? payload?.org_id ?? null;
  const regionUrl = payload?.region_url || payload?.active_org?.region_url || null;
  setRegionUrl(regionUrl, orgId);
  return regionUrl;
};

/**
 * Called when org changes. Resets region URL to default until next getinfo.
 */
export const resetRegionUrl = () => {
  if (_regionUrl) {
    console.log(`[API] Region URL reset to default (org changed)`);
  }
  _regionUrl = null;
  persistRegion(null, null);
};


/**
 * Host override — call from a top-level component (or `useSyncHostBaseUrl`)
 * with the `globalUrl` injected via `ShuffleHostProps`. When set, this beats
 * region URL and the env-based default for ALL fetches that go through
 * `getApiUrl()` / `API_CONFIG.baseUrl` / `shuffleFetch`.
 *
 * Pass `null` / `undefined` / empty string to clear the override.
 */
const SHUFFLE_HOST_BASE_URL_EVENT = 'shuffle:set-host-base-url';

export const setHostBaseUrl = (url: string | undefined | null) => {
  const next = url ? url.replace(/\/+$/, '') : null;
  if (next === _hostBaseUrl) return;
  _hostBaseUrl = next;
  if (next) {
    try { registerProtectedOrigin(next); } catch { /* noop */ }
  }
  // Cross-broadcast so sibling Shuffle packages (e.g. Shuffle-Core) that hold
  // their own copy of api.ts pick up the same host override. The early-return
  // above guarantees the listener loop terminates.
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(SHUFFLE_HOST_BASE_URL_EVENT, { detail: next }));
    } catch { /* noop */ }
  }
};

if (typeof window !== 'undefined') {
  try {
    window.addEventListener(SHUFFLE_HOST_BASE_URL_EVENT, (e: Event) => {
      const detail = (e as CustomEvent).detail as string | null | undefined;
      setHostBaseUrl(detail ?? null);
    });
  } catch { /* noop */ }
}

/** Get the currently active host override, if any. */
export const getHostBaseUrl = (): string | null => _hostBaseUrl;


/** Get the currently tracked org ID */
export const getTrackedOrgId = (): string | null => _trackedOrgId;

export const API_CONFIG = {
  // Shuffle backend URL — host override beats region URL beats default.
  get baseUrl(): string {
    // In test/dev environments (Lovable preview, VITE_SHUFFLE_API_URL) the
    // test backend always wins — region_url must not redirect us to prod.
    const url = _hostBaseUrl || (isDevEnvironment() || getEnvVar('VITE_SHUFFLE_API_URL') ? getDefaultBaseUrl() : (_regionUrl || getDefaultBaseUrl()));
    // Register origin once so the breaker watches it. registerProtectedOrigin
    // is idempotent.
    try { registerProtectedOrigin(url); } catch { /* noop */ }
    return url;
  },
  
  // API version
  version: 'v1',
  
  // Get API key from localStorage (for local development)
  get apiKey(): string | null {
    return localStorage.getItem('shuffle_api_key');
  },
  
  // Set API key in localStorage
  setApiKey(key: string | null) {
    if (key) {
      localStorage.setItem('shuffle_api_key', key);
    } else {
      localStorage.removeItem('shuffle_api_key');
    }
  },
};

// Computed API endpoint - pass full path including /api/v1 or /api/v2
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.baseUrl}${endpoint}`;
};

/**
 * Resolve an agent approval / form URL (typically `/forms/{id}`) to the
 * original Shuffle Core where the form actually lives. On Cloud this is
 * always https://shuffler.io (regardless of the active region URL — forms
 * are served from core), and onprem / dev fall back to the configured
 * backend baseUrl. Absolute URLs are returned unchanged.
 */
export const getShuffleCoreFormUrl = (refUrl: string): string => {
  if (!refUrl) return refUrl;
  // Already absolute — trust it.
  if (/^https?:\/\//i.test(refUrl)) return refUrl;
  const path = refUrl.startsWith('/') ? refUrl : `/${refUrl}`;
  // Cloud always points at shuffler.io for forms.
  if (isCloud()) return `https://shuffler.io${path}`;
  // Self-hosted / dev — use the active backend.
  return `${API_CONFIG.baseUrl}${path}`;
};

/** True when a notification.reference_url points at an agent approval form. */
export const isAgentApprovalFormUrl = (refUrl: string | undefined | null): boolean => {
  if (!refUrl) return false;
  try {
    // Strip an optional origin so we can match the path consistently.
    const path = /^https?:\/\//i.test(refUrl) ? new URL(refUrl).pathname : refUrl;
    return /^\/forms\/[^/?#]+/.test(path);
  } catch {
    return false;
  }
};

/**
 * Central fetch wrapper that ALWAYS includes credentials and auth headers.
 * Use this instead of raw fetch() for all Shuffle API calls.
 */
export const shuffleFetch = (url: string, init?: RequestInit): Promise<Response> => {
  const { headers: extraHeaders, ...rest } = init || {};
  return fetch(url, {
    credentials: 'include',
    ...rest,
    headers: {
      ...getAuthHeader(),
      ...extraHeaders,
    },
  });
};

// Common endpoints
export const API_ENDPOINTS = {
  login: '/login',
  logout: '/logout',
  me: '/me',
  getinfo: '/getinfo',
  alerts: '/alerts',
  cases: '/cases',
  workflows: '/workflows',
  apps: '/apps',
};

// Get authorization header - uses API key if available, otherwise session token.
// Always scopes the request to the currently-active org via Org-Id when known,
// so a user in a sub-org reads/writes against that sub-org rather than their
// default home org. Pass `overrideOrgId` to force a different org (e.g. when
// reading data from another tenant in a multi-tenant view).
export const getAuthHeader = (overrideOrgId?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {};

  // Only send Authorization header for API key auth.
  // Session-based (cookie) auth is handled by credentials: 'include' — never both.
  const apiKey = API_CONFIG.apiKey;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Scope to the active org. Explicit override beats the tracked org.
  const orgId = overrideOrgId ?? _trackedOrgId;
  if (orgId) {
    headers['Org-Id'] = orgId;
  }

  return headers;
};


/**
 * True when the browser has some form of Shuffle auth available: either the
 * API key entered on the login page (`shuffle_api_key`) or a session from a
 * previous login. Pollers (workflows, notifications, ...) must check this
 * before firing, otherwise they hammer the backend with unauthenticated
 * requests that all come back 401 — most visibly on the login page.
 */
export const hasShuffleAuth = (): boolean => {
  try {
    if (API_CONFIG.apiKey) return true;
    return !!(localStorage.getItem('session_token') || localStorage.getItem('shuffle_user_info'));
  } catch {
    return false;
  }
};
