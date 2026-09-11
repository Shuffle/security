/**
 * Domain health & existence check service.
 *
 * Verifies whether configured region domains, custom hosts, or handoff targets
 * actually exist in DNS and are reachable. Specifically handles domains that are
 * "currently being set up" (such as https://frankfurt.shuffle.security or new region subdomains)
 * so the frontend can display clear status indicators and gracefully fall back
 * rather than hanging or failing silently.
 */

import { useState, useEffect, useCallback } from 'react';

export interface DomainHealthResult {
  domain: string;
  exists: boolean;
  reachable: boolean;
  checking?: boolean;
  statusCode?: number;
  error?: string;
  lastChecked: number;
}

const CACHE_TTL_MS = 60_000; // Cache check results for 1 minute
const PROBE_TIMEOUT_MS = 3_500; // 3.5s timeout for domain existence probes
const healthCache = new Map<string, DomainHealthResult>();

/**
 * Extract clean lowercase hostname from a URL, domain, or host string.
 */
export const extractHostname = (input?: string | null): string => {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';

  try {
    const toParse = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(toParse);
    return parsed.hostname;
  } catch {
    return trimmed.split('/')[0].split(':')[0];
  }
};

/**
 * Extract normalized target info preserving protocol, hostname, and port.
 */
export const extractTargetInfo = (input?: string | null): { hostname: string; probeUrl: string; cacheKey: string } => {
  if (!input || typeof input !== 'string') return { hostname: '', probeUrl: '', cacheKey: '' };
  const trimmed = input.trim();
  if (!trimmed) return { hostname: '', probeUrl: '', cacheKey: '' };

  try {
    const toParse = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(toParse);
    const hostname = parsed.hostname.toLowerCase();
    const probeUrl = `${parsed.protocol}//${parsed.host}/api/v1/health`;
    const cacheKey = parsed.host.toLowerCase();
    return { hostname, probeUrl, cacheKey };
  } catch {
    const hostname = trimmed.split('/')[0].split(':')[0].toLowerCase();
    return {
      hostname,
      probeUrl: `https://${hostname}/api/v1/health`,
      cacheKey: hostname,
    };
  }
};

/**
 * Check if a domain or URL exists and is reachable via HTTP probe.
 */
export const checkDomainHealth = async (
  domainOrUrl?: string | null,
  forceCheck = false,
): Promise<DomainHealthResult> => {
  const { hostname, probeUrl, cacheKey } = extractTargetInfo(domainOrUrl);
  if (!hostname || !cacheKey) {
    return {
      domain: '',
      exists: true,
      reachable: true,
      lastChecked: Date.now(),
    };
  }

  // Local development hostnames always exist
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return {
      domain: hostname,
      exists: true,
      reachable: true,
      lastChecked: Date.now(),
    };
  }

  // Return cached result if valid and not forcing a recheck
  const cached = healthCache.get(cacheKey);
  if (!forceCheck && cached && Date.now() - cached.lastChecked < CACHE_TTL_MS) {
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    // Mode 'no-cors' allows detecting if the host at least resolves in DNS and responds
    // even if CORS headers are not fully returned.
    const res = await fetch(probeUrl, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
      credentials: 'omit',
    });

    clearTimeout(timeoutId);

    // If fetch succeeds (even with opaque response in no-cors mode, type: 'opaque'),
    // the DNS resolved and a connection was established. The domain EXISTS.
    const result: DomainHealthResult = {
      domain: hostname,
      exists: true,
      reachable: true,
      statusCode: res.status || 200,
      lastChecked: Date.now(),
    };
    healthCache.set(cacheKey, result);
    return result;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    const isAbort = (err as Error)?.name === 'AbortError';
    const result: DomainHealthResult = {
      domain: hostname,
      exists: false,
      reachable: false,
      error: isAbort
        ? `Domain '${hostname}' timed out. It may not exist or is currently being set up.`
        : `Domain '${hostname}' does not exist or is unreachable. It may still be setting up.`,
      lastChecked: Date.now(),
    };

    healthCache.set(cacheKey, result);
    return result;
  }
};

/** Synchronously check if a domain was previously probed and found unavailable. */
export const isDomainCachedUnavailable = (domainOrUrl?: string | null): boolean => {
  const { cacheKey } = extractTargetInfo(domainOrUrl);
  if (!cacheKey) return false;
  const cached = healthCache.get(cacheKey);
  if (!cached) return false;
  if (Date.now() - cached.lastChecked >= CACHE_TTL_MS) {
    healthCache.delete(cacheKey);
    return false;
  }
  return !cached.exists;
};

/** Mark a domain as unavailable in cache after a confirmed network/DNS failure. */
export const markDomainUnavailable = (domainOrUrl?: string | null, error?: string) => {
  const { hostname, cacheKey } = extractTargetInfo(domainOrUrl);
  if (!cacheKey) return;
  healthCache.set(cacheKey, {
    domain: hostname,
    exists: false,
    reachable: false,
    error: error || `Domain '${hostname}' does not exist or is currently being set up.`,
    lastChecked: Date.now(),
  });
};

/** Mark a domain as available in cache. */
export const markDomainAvailable = (domainOrUrl?: string | null) => {
  const { hostname, cacheKey } = extractTargetInfo(domainOrUrl);
  if (!cacheKey) return;
  healthCache.set(cacheKey, {
    domain: hostname,
    exists: true,
    reachable: true,
    lastChecked: Date.now(),
  });
};

/** React hook for checking and tracking the health/existence of a domain. */
export const useDomainHealth = (domainOrUrl?: string | null) => {
  const hostname = extractHostname(domainOrUrl);
  const [state, setState] = useState<DomainHealthResult>(() => {
    if (!hostname) {
      return { domain: '', exists: true, reachable: true, checking: false, lastChecked: 0 };
    }
    const cached = healthCache.get(hostname);
    if (cached && Date.now() - cached.lastChecked < CACHE_TTL_MS) {
      return { ...cached, checking: false };
    }
    return { domain: hostname, exists: true, reachable: true, checking: Boolean(hostname), lastChecked: 0 };
  });

  const runCheck = useCallback(async (force = false) => {
    if (!hostname) {
      setState({ domain: '', exists: true, reachable: true, checking: false, lastChecked: Date.now() });
      return;
    }

    setState((prev) => ({ ...prev, checking: true }));
    const result = await checkDomainHealth(hostname, force);
    setState({ ...result, checking: false });
  }, [hostname]);

  useEffect(() => {
    runCheck(false);
  }, [runCheck]);

  return {
    ...state,
    hostname,
    retry: () => runCheck(true),
  };
};

/** Global broadcast event name when active region domain is unavailable. */
export const REGION_HEALTH_EVENT = 'shuffle:region-health';

export interface RegionHealthEventDetail {
  domain: string;
  regionUrl: string;
  exists: boolean;
  error?: string;
  fallbackUrl: string;
}

export const broadcastRegionHealth = (detail: RegionHealthEventDetail) => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(REGION_HEALTH_EVENT, { detail }));
  } catch { /* ignore */ }
};
