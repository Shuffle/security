/**
 * Single source of truth for resolving frontend URLs between
 * Shuffle Security and Shuffle Core.
 *
 * Supports:
 * - Shuffle Cloud (EU / US)
 * - Self-hosted On-Premises Docker / Kubernetes containers
 * - Local development
 *
 * Environment Variable Overwrites:
 * - `VITE_SHUFFLE_CORE_URL`: Explicitly sets the Shuffle Core frontend base URL.
 * - `VITE_SHUFFLE_SECURITY_URL`: Explicitly sets the Shuffle Security frontend base URL.
 *
 * Baseline Resolution (when no env override is present):
 * - Managed hosts (shuffler.io, shuffle.security, shutdown.no, lovable):
 *     Shuffle Core -> https://shuffler.io
 *     Shuffle Security -> https://shuffle.security (or current origin)
 * - Self-hosted / On-Prem (Docker / Kubernetes):
 *     Shuffle Core -> ${window.location.protocol}//${window.location.hostname}:3001
 *     Shuffle Security -> window.location.origin
 */

// Helper to safely read env vars from build-time Vite or runtime Docker environment
const readEnv = (key: string): string | undefined => {
  // 1. Build-time Vite env (import.meta.env)
  try {
    const meta = (new Function('try { return import.meta } catch { return undefined }')()) as
      | { env?: Record<string, string | undefined> }
      | undefined;
    const val = meta?.env?.[key];
    if (val && typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  } catch { /* ignore */ }

  // 2. Runtime Docker injection (window.__SHUFFLE_CONFIG__ or window._env_)
  if (typeof window !== 'undefined') {
    const win = window as any;
    const runtimeConfig = win.__SHUFFLE_CONFIG__ || win._env_ || win.__ENV__;
    if (runtimeConfig && typeof runtimeConfig === 'object') {
      const val = runtimeConfig[key] || runtimeConfig[key.replace(/^VITE_/, '')];
      if (val && typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
    }
  }

  // 3. Node / SSR process.env
  try {
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[key] || process.env[key.replace(/^VITE_/, '')];
      if (val && typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
    }
  } catch { /* ignore */ }

  return undefined;
};

/**
 * Check if the current hostname is a known managed cloud or preview domain.
 * Kept consistent with the left sidebar's resolution logic.
 */
export const isManagedDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname.includes('lovable') ||
    hostname.includes('shuffler.io') ||
    hostname.includes('shutdown.no') ||
    hostname.includes('shuffle.security')
  );
};

/**
 * Resolves the base frontend URL for Shuffle Core (Automation).
 *
 * Precedence:
 * 1. Environment variable overwrite: `VITE_SHUFFLE_CORE_URL` (or `VITE_SHUFFLE_AUTOMATION_URL` / `VITE_SHUFFLE_URL`)
 * 2. User / Admin localStorage override: `shuffle_core_url`
 * 3. Saved custom host: `shuffle_custom_host_url` (adjusts backend :5001 to frontend :3001)
 * 4. Baseline Left Sidebar Resolution:
 *    - Managed Cloud: `https://shuffler.io`
 *    - On-Premises: `${window.location.protocol}//${window.location.hostname}:3001`
 *      (or current origin if already on port 3001)
 */
export const getShuffleCoreBaseUrl = (): string => {
  // 1. Environment variable overwrite
  const envUrl =
    readEnv('VITE_SHUFFLE_CORE_URL') ||
    readEnv('SHUFFLE_CORE_URL') ||
    readEnv('VITE_SHUFFLE_AUTOMATION_URL') ||
    readEnv('VITE_SHUFFLE_URL');

  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Local storage override (user-configured)
  if (typeof window !== 'undefined') {
    try {
      const savedCore = localStorage.getItem('shuffle_core_url');
      if (savedCore && savedCore.trim().length > 0) {
        return savedCore.trim().replace(/\/+$/, '');
      }

      // Check if custom server host was configured for on-prem
      const customHost = localStorage.getItem('shuffle_custom_host_url');
      if (customHost && customHost.trim().length > 0) {
        const cleaned = customHost.trim().replace(/\/+$/, '');
        // If backend port 5001 was given, map to frontend port 3001
        if (cleaned.includes(':5001')) {
          return cleaned.replace(':5001', ':3001');
        }
        return cleaned;
      }
    } catch { /* ignore */ }
  }

  // 3. Baseline Left Sidebar Resolution
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isManaged = isManagedDomain();

    if (isManaged) {
      return 'https://shuffler.io';
    }

    // On-Premises / self-hosted Docker
    // If the browser is already accessing port 3001, use origin directly
    if (window.location.port === '3001') {
      return window.location.origin;
    }

    return `${window.location.protocol}//${hostname}:3001`;
  }

  // Fallback for SSR / non-browser
  return 'https://shuffler.io';
};

/**
 * Return a complete Shuffle Core URL with an optional subpath.
 *
 * @example
 * getShuffleCoreUrl('/new-dashboard') // "https://shuffler.io/new-dashboard" or "http://localhost:3001/new-dashboard"
 * getShuffleCoreUrl('/workflows')     // "https://shuffler.io/workflows" or "http://localhost:3001/workflows"
 */
export const getShuffleCoreUrl = (path?: string): string => {
  const base = getShuffleCoreBaseUrl();
  if (!path) return base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

/**
 * Return the URL to a workflow or the workflows list in Shuffle Core.
 *
 * @param workflowId Optional workflow ID. If omitted, links to `/workflows`.
 * @param queryParams Optional query parameters (e.g. `{ execution_id: '...', view: 'executions' }`).
 *
 * @example
 * getShuffleCoreWorkflowUrl('wf-123')
 * // => "https://shuffler.io/workflows/wf-123" (Cloud)
 * // => "http://localhost:3001/workflows/wf-123" (On-Prem)
 *
 * getShuffleCoreWorkflowUrl('wf-123', { execution_id: 'exec-456' })
 * // => "https://shuffler.io/workflows/wf-123?execution_id=exec-456"
 */
export const getShuffleCoreWorkflowUrl = (
  workflowId?: string | null,
  queryParams?: Record<string, string | number | boolean | null | undefined>
): string => {
  const base = getShuffleCoreBaseUrl();
  let url = workflowId ? `${base}/workflows/${encodeURIComponent(workflowId)}` : `${base}/workflows`;

  if (queryParams) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  return url;
};

/**
 * Resolves the base frontend URL for Shuffle Security.
 *
 * Precedence:
 * 1. Environment variable overwrite: `VITE_SHUFFLE_SECURITY_URL` (or `SHUFFLE_SECURITY_URL`)
 * 2. Current origin (if running on Shuffle Security in the browser)
 * 3. On-Prem Core origin (if running inside Shuffle Core port 3001, points to port 3002)
 * 4. Fallback: `https://shuffle.security`
 */
export const getShuffleSecurityBaseUrl = (): string => {
  // 1. Environment variable overwrite
  const envUrl = readEnv('VITE_SHUFFLE_SECURITY_URL') || readEnv('SHUFFLE_SECURITY_URL');
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Current browser origin
  if (typeof window !== 'undefined') {
    // If not running on port 3001 and not on shuffler.io, we are directly on Shuffle Security
    if (window.location.port !== '3001' && !window.location.hostname.includes('shuffler.io')) {
      return window.location.origin;
    }

    // If running inside Shuffle Core on onprem (port 3001), map to Shuffle Security default port (3002)
    if (window.location.port === '3001') {
      return `${window.location.protocol}//${window.location.hostname}:3002`;
    }
  }

  return 'https://shuffle.security';
};

/**
 * Return a complete Shuffle Security URL with an optional subpath.
 */
export const getShuffleSecurityUrl = (path?: string): string => {
  const base = getShuffleSecurityBaseUrl();
  if (!path) return base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

export type ShuffleProduct = 'security' | 'core' | 'automation';

/**
 * Determines whether the current application environment is Shuffle Security
 * or Shuffle Core (Automation).
 */
export const getCurrentShuffleProduct = (override?: string | null): 'security' | 'core' => {
  if (override) {
    const o = override.trim().toLowerCase();
    if (o === 'core' || o === 'automation') return 'core';
    if (o === 'security') return 'security';
  }

  // 1. URL search parameter override (e.g. ?product=core or ?product=security)
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const param = urlParams.get('product') || urlParams.get('shuffle_product');
      if (param) {
        const p = param.trim().toLowerCase();
        if (p === 'core' || p === 'automation') return 'core';
        if (p === 'security') return 'security';
      }
    } catch { /* ignore */ }
  }

  // 2. Global runtime config / env
  const envProduct = readEnv('VITE_SHUFFLE_PRODUCT') || readEnv('SHUFFLE_PRODUCT');
  if (envProduct) {
    const p = envProduct.trim().toLowerCase();
    if (p === 'core' || p === 'automation') return 'core';
    if (p === 'security') return 'security';
  }

  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.__SHUFFLE_PRODUCT__) {
      const p = String(win.__SHUFFLE_PRODUCT__).trim().toLowerCase();
      if (p === 'core' || p === 'automation') return 'core';
      if (p === 'security') return 'security';
    }

    // 3. Hostname / Port detection
    const hostname = window.location.hostname.toLowerCase();
    const port = window.location.port;

    if (port === '3001') return 'core';
    if (port === '3002') return 'security';

    // Managed cloud hosts
    if (hostname.includes('shuffler.io')) {
      if (hostname.startsWith('security.') || hostname.includes('.security.')) {
        return 'security';
      }
      return 'core';
    }

    if (hostname.includes('shuffle.security')) {
      return 'security';
    }
  }

  // Default in this repository is security
  return 'security';
};

/** Paths that exclusively exist in Shuffle Core / Automation */
const CORE_EXCLUSIVE_PATH_PREFIXES = [
  '/workflows',
  '/new-dashboard',
  '/apps/new',
];

/** Admin tabs that exclusively exist in Shuffle Core */
const CORE_ADMIN_TABS = ['datastore', 'files', 'locations', 'runtime_locations'];

/** Paths that exclusively exist in Shuffle Security */
const SECURITY_EXCLUSIVE_PATH_PREFIXES = [
  '/incidents',
  '/incidents-simple',
  '/alerts',
  '/cases',
  '/monitors',
  '/vulnerabilities',
  '/detection',
  '/assets',
  '/tickets',
];

/**
 * Checks if a relative path belongs exclusively to Shuffle Core (Automation).
 */
export const isCoreExclusivePath = (path: string): boolean => {
  if (!path) return false;
  const clean = path.startsWith('/') ? path : `/${path}`;
  const [pathname, search] = clean.split('?');

  if (CORE_EXCLUSIVE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (pathname === '/admin' && search) {
    const params = new URLSearchParams(search);
    const tab = params.get('tab');
    if (tab && CORE_ADMIN_TABS.includes(tab.toLowerCase())) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if a relative path belongs exclusively to Shuffle Security.
 */
export const isSecurityExclusivePath = (path: string): boolean => {
  if (!path) return false;
  const clean = path.startsWith('/') ? path : `/${path}`;
  const [pathname] = clean.split('?');

  return SECURITY_EXCLUSIVE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

export interface ResolvedProductLink {
  /** The final URL to navigate or link to */
  url: string;
  /** Whether the link is internal to the current app's router */
  isInternal: boolean;
  /** Which product the link targets */
  targetProduct: 'core' | 'security' | 'external' | 'doc';
  /** Whether this cross-domain link points to Shuffle Core (candidate for auth handoff) */
  isCrossDomainToCore: boolean;
}

/**
 * Resolves a markdown link based on the current product environment (Shuffle Security vs Shuffle Core / Automation).
 *
 * Rules:
 * - If in Shuffle Security:
 *   - Links to `/workflows`, `/workflows/debug`, etc. resolve to Shuffle Core base URL (external).
 *   - Links to `/incidents`, `/alerts`, etc. resolve as internal router paths.
 * - If in Shuffle Core / Automation:
 *   - Links to `/workflows`, `/workflows/debug` resolve as internal router paths.
 *   - Links to `/incidents`, `/alerts`, etc. resolve to Shuffle Security base URL (external).
 * - Relative doc links (`/docs/*`, `*.md`) remain internal documentation links.
 * - Shared links (`/agents`, `/apps`, `/usecases`, `/dashboard`) remain internal to the current product.
 */
export const resolveProductLink = (
  href: string,
  currentProductOverride?: string | null
): ResolvedProductLink => {
  const currentProduct = getCurrentShuffleProduct(currentProductOverride);
  const trimmed = (href || '').trim();

  if (!trimmed) {
    return { url: '', isInternal: false, targetProduct: 'external', isCrossDomainToCore: false };
  }

  if (trimmed.startsWith('#')) {
    return { url: trimmed, isInternal: true, targetProduct: 'doc', isCrossDomainToCore: false };
  }

  // Parse path and origin
  let pathname = '';
  let searchAndHash = '';
  let isAbsolute = false;
  let isShufflerIoDomain = false;
  let isShuffleSecurityDomain = false;

  try {
    if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
      isAbsolute = true;
      const parsed = new URL(trimmed);
      pathname = parsed.pathname;
      searchAndHash = `${parsed.search}${parsed.hash}`;
      const host = parsed.hostname.toLowerCase();
      if (host === 'shuffler.io' || (host.endsWith('.shuffler.io') && !host.includes('security.'))) {
        isShufflerIoDomain = true;
      } else if (host.includes('shuffle.security') || host.includes('security.shuffler.io')) {
        isShuffleSecurityDomain = true;
      }
    } else {
      const splitIdx = trimmed.search(/[?#]/);
      if (splitIdx !== -1) {
        pathname = trimmed.slice(0, splitIdx);
        searchAndHash = trimmed.slice(splitIdx);
      } else {
        pathname = trimmed;
      }
    }
  } catch {
    pathname = trimmed;
  }

  const fullRelativePath = `${pathname}${searchAndHash}`;

  // 1. Is this a doc path or markdown file link?
  const isDocPath = /^\/docs(?:\/|$)/i.test(pathname) || /(?:^|\/)\.?\.?\/?[^/#?]+\.md(?:$|[?#])/i.test(trimmed);
  if (isDocPath) {
    return {
      url: fullRelativePath,
      isInternal: true,
      targetProduct: 'doc',
      isCrossDomainToCore: false,
    };
  }

  // 2. Check if the path is exclusive to Core / Automation
  const targetsCore = isCoreExclusivePath(fullRelativePath) || isShufflerIoDomain;
  // 3. Check if the path is exclusive to Security
  const targetsSecurity = isSecurityExclusivePath(fullRelativePath) || isShuffleSecurityDomain;

  if (targetsCore) {
    if (currentProduct === 'core') {
      return {
        url: fullRelativePath,
        isInternal: true,
        targetProduct: 'core',
        isCrossDomainToCore: false,
      };
    }
    // We are in Security -> Route out to Shuffle Core
    const targetUrl = getShuffleCoreUrl(fullRelativePath);
    return {
      url: targetUrl,
      isInternal: false,
      targetProduct: 'core',
      isCrossDomainToCore: true,
    };
  }

  if (targetsSecurity) {
    if (currentProduct === 'security') {
      return {
        url: fullRelativePath,
        isInternal: true,
        targetProduct: 'security',
        isCrossDomainToCore: false,
      };
    }
    // We are in Core -> Route out to Shuffle Security
    const targetUrl = getShuffleSecurityUrl(fullRelativePath);
    return {
      url: targetUrl,
      isInternal: false,
      targetProduct: 'security',
      isCrossDomainToCore: false,
    };
  }

  // 4. Shared platform paths or root-relative paths
  if (trimmed.startsWith('/')) {
    return {
      url: trimmed,
      isInternal: true,
      targetProduct: currentProduct,
      isCrossDomainToCore: false,
    };
  }

  // 5. Genuine external URL
  return {
    url: trimmed,
    isInternal: false,
    targetProduct: 'external',
    isCrossDomainToCore: false,
  };
};
