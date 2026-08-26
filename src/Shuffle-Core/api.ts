/**
 * Shuffle-Core API helpers — STANDALONE copy.
 *
 * ⚠️ KEEP IN SYNC with `src/Shuffle-MCPs/api.ts`.
 *
 * Shuffle-Core ships as `@shuffleio/shuffle-core` and cannot depend on
 * `@shuffleio/shuffle-mcps`. The two libraries intentionally duplicate this
 * file so each one can be consumed in isolation. When you change one, mirror
 * the change in the other. A future refactor may extract a shared
 * `@shuffleio/shuffle-api` package — until then, this duplication is the
 * source of truth for "Shuffle Core does not depend on Shuffle-MCPs".
 */

import { installFetchBreaker, registerProtectedOrigin } from './fetchBreaker';

// Install the global fetch breaker as soon as api.ts is imported. Idempotent.
installFetchBreaker();

const DEV_BACKEND = 'https://tunnel.schemaless.org';
const PROD_BACKEND = 'https://shuffler.io';

const CLOUD_DOMAINS = ['shuffle.security', 'www.shuffle.security', 'security.shuffler.io', 'shutdown.no', 'www.shutdown.no'];

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

export const isCapacitorNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform && cap.isNativePlatform());
};

export const isCloudDomain = (): boolean => {
  if (isCapacitorNative()) return true;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  return CLOUD_DOMAINS.includes(hostname);
};

const getDefaultBaseUrl = (): string => {
  const envUrl = getEnvVar('VITE_SHUFFLE_API_URL');
  if (envUrl) return envUrl;
  if (isDevEnvironment()) return DEV_BACKEND;
  if (isCapacitorNative()) return PROD_BACKEND;
  if (isCloudDomain()) return PROD_BACKEND;
  if (typeof window !== 'undefined') return window.location.origin;
  return PROD_BACKEND;
};

const REGION_STORAGE_KEY = 'shuffle_region_url';

// Hydrate from localStorage so the first request after a reload already hits
// the correct region without waiting for /api/v1/getinfo.
const _cachedRegion = (() => {
  if (typeof window === 'undefined') return { url: null as string | null, orgId: null as string | null };
  try {
    const raw = localStorage.getItem(REGION_STORAGE_KEY);
    if (!raw) return { url: null, orgId: null };
    const parsed = JSON.parse(raw);
    return { url: parsed?.url || null, orgId: parsed?.orgId || null };
  } catch { return { url: null, orgId: null }; }
})();

const _readCachedCustomHost = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('shuffle_custom_host_url');
    return raw ? raw.trim().replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
};

let _regionUrl: string | null = _cachedRegion.url;
let _trackedOrgId: string | null = _cachedRegion.orgId;
// Host-injected base URL (highest priority — set via setHostBaseUrl or from saved custom host).
let _hostBaseUrl: string | null = _readCachedCustomHost();

const REGION_EVENT = 'shuffle:region-url';
let _lastBroadcastUrl: string | null = _cachedRegion.url;

const persistRegion = (url: string | null, orgId: string | null) => {
  if (typeof window === 'undefined') return;
  const changed = url !== _lastBroadcastUrl;
  _lastBroadcastUrl = url;
  try {
    if (url) localStorage.setItem(REGION_STORAGE_KEY, JSON.stringify({ url, orgId }));
    else localStorage.removeItem(REGION_STORAGE_KEY);
  } catch { /* ignore */ }
  if (!changed) return;
  try { window.dispatchEvent(new CustomEvent(REGION_EVENT, { detail: { url, orgId } })); } catch { /* ignore */ }
};

// Stay in sync with the Shuffle-MCPs api module (AuthContext only calls
// setRegionUrl there) and with other tabs.
if (typeof window !== 'undefined') {
  const sync = () => {
    try {
      const raw = localStorage.getItem(REGION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      _regionUrl = parsed?.url || null;
      _lastBroadcastUrl = _regionUrl;
      _trackedOrgId = parsed?.orgId || null;
    } catch { /* ignore */ }
  };
  window.addEventListener(REGION_EVENT, sync);
  window.addEventListener('storage', (e) => { if (e.key === REGION_STORAGE_KEY) sync(); });
}


const isShufflerSubdomain = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.shuffler.io') || parsed.hostname === 'shuffler.io';
  } catch {
    return false;
  }
};

export const setRegionUrl = (regionUrl: string | undefined | null, orgId: string | undefined | null) => {
  // region_url from getinfo is ALWAYS honored for the current org/tenant,
  // including dev/preview environments.
  _trackedOrgId = orgId || null;
  if (regionUrl && isShufflerSubdomain(regionUrl)) {
    const normalized = regionUrl.replace(/\/+$/, '');
    if (normalized !== PROD_BACKEND) {
      _regionUrl = normalized;
      persistRegion(_regionUrl, _trackedOrgId);
      return;
    }
  }
  _regionUrl = null;
  persistRegion(null, _trackedOrgId);
};

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

export const resetRegionUrl = () => { _regionUrl = null; persistRegion(null, null); };

export const getTrackedOrgId = (): string | null => _trackedOrgId;

/**
 * Host override — call from a top-level Shuffle-Core component (or via
 * `useSyncHostBaseUrl`) with `globalUrl` from `ShuffleHostProps`. Beats region
 * URL and default for ALL fetches that go through `getApiUrl()`.
 */
const SHUFFLE_HOST_BASE_URL_EVENT = 'shuffle:set-host-base-url';

export const setHostBaseUrl = (url: string | undefined | null) => {
  const next = url ? url.replace(/\/+$/, '') : null;
  if (next === _hostBaseUrl) return;
  _hostBaseUrl = next;
  if (next) {
    try { registerProtectedOrigin(next); } catch { /* noop */ }
  }
  // Cross-broadcast so sibling Shuffle packages (e.g. Shuffle-MCPs) that hold
  // their own copy of api.ts pick up the same host override. Guarded by the
  // `next === _hostBaseUrl` early-return above so the loop terminates.
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

export const getHostBaseUrl = (): string | null => _hostBaseUrl;


export const API_CONFIG = {
  get baseUrl(): string {
    // In test/dev environments (Lovable preview, VITE_SHUFFLE_API_URL) the
    // test backend always wins — region_url must not redirect us to prod.
    const url = _hostBaseUrl || (isDevEnvironment() || getEnvVar('VITE_SHUFFLE_API_URL') ? getDefaultBaseUrl() : (_regionUrl || getDefaultBaseUrl()));
    try { registerProtectedOrigin(url); } catch { /* noop */ }
    return url;
  },
  version: 'v1',
  get apiKey(): string | null {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem('shuffle_api_key') : null; } catch { return null; }
  },
  setApiKey(key: string | null) {
    try {
      if (key) localStorage.setItem('shuffle_api_key', key);
      else localStorage.removeItem('shuffle_api_key');
    } catch { /* ignore */ }
  },
};

export const getApiUrl = (endpoint: string): string => `${API_CONFIG.baseUrl}${endpoint}`;

export const getAuthHeader = (overrideOrgId?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {};
  const apiKey = API_CONFIG.apiKey;
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const orgId = overrideOrgId ?? _trackedOrgId;
  if (orgId) headers['Org-Id'] = orgId;
  return headers;
};

/**
 * Central fetch wrapper that ALWAYS includes credentials + auth headers.
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
