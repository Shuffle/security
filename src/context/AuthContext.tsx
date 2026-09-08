import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getApiUrl, getAuthHeader, setRegionUrl, resetRegionUrl, getTrackedOrgId, applyRegionFromPayload, setHostBaseUrl, getHostBaseUrl, setSessionToken as persistSessionToken, clearAuthTokens, getSessionToken, isDevEnvironment, isCloud, mapCloudRegionUrl } from '@/Shuffle-MCPs/api';
import { setRuntimeOrgId } from '@/Shuffle-MCPs/datastore';
import { isCapacitorNative } from '@/Shuffle-MCPs/api';

const TAB_FOCUS_GETINFO_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown between tab-in getinfo audits

interface Organization {
  name: string;
  id: string;
  image?: string;
  region_url?: string;
  creator_org?: string;
  /** Role of the current user within this org (e.g. "admin", "user"). From /api/v1/getinfo => active_org.role */
  role?: string;
  branding?: {
    theme?: 'light' | 'dark' | 'system';
    brand_color?: string; 
    brand_name?: string;
    [key: string]: unknown;
  };
}

interface SyncFeatureUsage {
  usage?: number;
  limit?: number;
  [key: string]: unknown;
}

interface UserInfo {
  username?: string;
  id?: string;
  active_org?: Organization;
  orgs?: Organization[];
  support?: boolean;
  app_execution_limit?: number;
  app_execution_usage?: number;
  app_executions_suborgs?: number;
  sync_features?: Record<string, SyncFeatureUsage> & {
    agent_tokens?: SyncFeatureUsage;
  };
}

interface AuthContextType {
  isAuthenticated: boolean;
  sessionToken: string | null;
  userInfo: UserInfo | null;
  login: (token: string, verifiedUserInfo?: any) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  refreshUserInfo: () => Promise<void>;
  setActiveOrg: (orgId: string) => Promise<void>;
  orgMismatchWarning: boolean;
  dismissOrgMismatch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Optimistic hydration: if a previous session's userInfo is cached in
  // localStorage, assume the user is still logged in and render immediately.
  // /api/v1/getinfo is by far the slowest boot request; blocking every page
  // (tickets, dashboard, ...) on it means seconds of blank UI even though
  // every other API works. We revalidate in the background and only tear
  // down auth if getinfo actually says the session is gone.
  const cachedUserInfo: UserInfo | null = (() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem('shuffle_user_info');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed as UserInfo : null;
    } catch { return null; }
  })();
  const cachedToken = (() => {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem('session_token'); } catch { return null; }
  })();
  const [sessionToken, setSessionToken] = useState<string | null>(cachedToken);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(cachedToken || cachedUserInfo));
  const [userInfo, setUserInfo] = useState<UserInfo | null>(cachedUserInfo);
  const [isLoading, setIsLoading] = useState(!cachedUserInfo && !cachedToken);
  const [orgMismatchWarning, setOrgMismatchWarning] = useState(false);
  const lastGetInfoTimeRef = useRef<number>(Date.now());

  // Seed the runtime org id from cache synchronously so datastore calls
  // fired on the very first render don't get "no org" and 401.
  if (cachedUserInfo?.active_org?.id) {
    try { setRuntimeOrgId(cachedUserInfo.active_org.id); } catch { /* ignore */ }
  }

  const dismissOrgMismatch = useCallback(() => {
    setOrgMismatchWarning(false);
  }, []);

  const applyAuthenticatedUserInfo = useCallback((data: any) => {
    const newOrgId = data.active_org?.id || null;
    const previousOrgId = getTrackedOrgId();

    if (previousOrgId && newOrgId && previousOrgId !== newOrgId) {
      resetRegionUrl();
    }

    applyRegionFromPayload(data, newOrgId);

    const mappedActiveOrg = data.active_org ? {
      ...data.active_org,
      region_url: data.active_org.region_url ? (mapCloudRegionUrl(data.active_org.region_url) || data.active_org.region_url) : undefined,
    } : undefined;
    const mappedOrgs = Array.isArray(data.orgs)
      ? data.orgs.map((o: any) => ({
          ...o,
          region_url: o.region_url ? (mapCloudRegionUrl(o.region_url) || o.region_url) : undefined,
        }))
      : (data.orgs || []);

    const info = {
      username: data.username,
      id: data.id,
      active_org: mappedActiveOrg,
      orgs: mappedOrgs,
      support: data.support === true || data.support === 'true',
      app_execution_limit: data.app_execution_limit,
      app_execution_usage: data.app_execution_usage,
      sync_features: data.sync_features,
    };
    setUserInfo(info);
    setRuntimeOrgId(newOrgId);
    localStorage.setItem('shuffle_user_info', JSON.stringify(info));

    // Ensure session token is persisted if returned in the getinfo payload
    const returnedToken = data.session_token ||
      data.token ||
      data.cookies?.find((c: { key: string; value: string }) => c.key === 'session_token')?.value;
    if (returnedToken && !getSessionToken()) {
      persistSessionToken(returnedToken);
      setSessionToken(returnedToken);
    }

    try {
      window.dispatchEvent(new CustomEvent('shuffle:getinfo', { detail: data }));
    } catch { /* ignore */ }
  }, []);

  const fetchUserInfo = useCallback(async (_token?: string | null): Promise<'ok' | 'unauthenticated' | 'error'> => {
    lastGetInfoTimeRef.current = Date.now();
    // Hard timeout: if the backend is unavailable the request can otherwise
    // hang forever and the "Checking login details…" overlay never resolves.
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      // Normal cookie login is the primary authentication method.
      // If an explicit token argument is passed (e.g. Bearer fallback verification), use it.
      // Otherwise only send Bearer if auth mode is explicitly 'bearer' or Capacitor native.
      const authMode = typeof localStorage !== 'undefined' ? localStorage.getItem('shuffle_auth_mode') : null;
      let tokenToSend = '';
      if (_token !== undefined) {
        tokenToSend = _token?.trim() || '';
      } else if (authMode === 'bearer' || isCapacitorNative()) {
        tokenToSend = getSessionToken() || '';
      }

      const response = await fetch(getApiUrl('/api/v1/getinfo'), {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          ...(tokenToSend ? { Authorization: `Bearer ${tokenToSend}` } : {}),
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json().catch(() => ({} as any));

      if (response.ok && data.success === true) {
        if (!tokenToSend && typeof localStorage !== 'undefined' && !authMode) {
          localStorage.setItem('shuffle_auth_mode', 'cookie');
        }
        applyAuthenticatedUserInfo(data);
        return 'ok';
      }
      // Only treat explicit auth failures (401/403) as logged-out. Other
      // non-ok statuses (500, 502, gateway timeouts, ...) are transient and
      // must NOT wipe a working cached session.
      if (response.status === 401 || response.status === 403) {
        return 'unauthenticated';
      }
      console.warn('getinfo transient failure:', response.status, data.reason);
      return 'error';
    } catch (err) {
      console.error('Failed to fetch user info:', err);
      return 'error';
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [applyAuthenticatedUserInfo]);

  // A session must never be dropped because of a single unlucky request.
  // Only tear down auth when repeated attempts, spaced out in time, keep
  // coming back with an explicit auth failure. Anything else (network blips,
  // 5xx, aborted/timed-out requests, a stale org hint on one attempt) is
  // treated as transient and leaves the existing session untouched.
  const verifyUserInfo = useCallback(async (
    token?: string | null,
    attempts = 3,
  ): Promise<'ok' | 'unauthenticated' | 'error'> => {
    let last: 'unauthenticated' | 'error' = 'error';
    for (let i = 0; i < attempts; i++) {
      const result = await fetchUserInfo(token);
      if (result === 'ok') return 'ok';
      last = result;
      if (i < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    return last;
  }, [fetchUserInfo]);


  // Verify authentication on mount (runs once when app loads).
  // If we already hydrated from cache, this runs in the background and only
  // tears down auth on an explicit unauthenticated response — transient
  // errors (slow getinfo, 5xx) leave the cached session in place.
  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('session_token');
      if (token !== sessionToken) setSessionToken(token);

      // On native apps with no token and no cached user info, skip boot getinfo
      if (!token && !cachedUserInfo && isCapacitorNative() && !getHostBaseUrl()) {
        setIsAuthenticated(false);
        setUserInfo(null);
        setIsLoading(false);
        return;
      }

      // Step 1: Attempt standard cookie login first (or use token if on native/bearer mode)
      const authMode = typeof localStorage !== 'undefined' ? localStorage.getItem('shuffle_auth_mode') : null;
      const preferBearer = (authMode === 'bearer' || isCapacitorNative()) && Boolean(token);
      let result = await fetchUserInfo(preferBearer ? token : null);

      // Step 2: If cookie login failed with unauthenticated and we have a session token,
      // fallback to Bearer token verification!
      if (result === 'unauthenticated' && token && !preferBearer) {
        result = await fetchUserInfo(token);
        if (result === 'ok' && typeof localStorage !== 'undefined') {
          localStorage.setItem('shuffle_auth_mode', 'bearer');
        }
      }

      if (result === 'ok') {
        setIsAuthenticated(true);
      } else if (result !== 'unauthenticated') {
        // Retry verification if transient error
        setIsLoading(false);
        result = await verifyUserInfo(preferBearer ? token : null, 2);
        if (result === 'ok') {
          setIsAuthenticated(true);
        }
      }

      if (result === 'unauthenticated') {
        if (token) {
          localStorage.removeItem('session_token');
          setSessionToken(null);
        }
        localStorage.removeItem('shuffle_user_info');
        localStorage.removeItem('shuffle_auth_mode');
        setIsAuthenticated(false);
        setUserInfo(null);
      }
      // 'error' → keep whatever we optimistically hydrated (or nothing).
      setIsLoading(false);
    };

    // Watchdog: never leave the app stuck on "Checking login details…" if the
    // backend is unreachable or the request never settles.
    const watchdog = window.setTimeout(() => setIsLoading(false), 16000);
    verifyAuth().finally(() => window.clearTimeout(watchdog));
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check org on tab focus to detect out-of-band org switches (throttled to 60s)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleTabFocus = async () => {
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastGetInfoTimeRef.current < TAB_FOCUS_GETINFO_COOLDOWN_MS) {
        return;
      }
      lastGetInfoTimeRef.current = now;

      try {
        const token = getSessionToken();
        const response = await fetch(getApiUrl('/api/v1/getinfo'), {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (response.ok && data.success === true) {
          const remoteOrgId = data.active_org?.id;
          const localOrgId = userInfo?.active_org?.id || getTrackedOrgId();
          if (remoteOrgId && localOrgId && remoteOrgId !== localOrgId) {
            console.warn(`[Auth] Org mismatch detected on tab focus: local=${localOrgId}, remote=${remoteOrgId}`);
            setOrgMismatchWarning(true);
          } else if (remoteOrgId && localOrgId && remoteOrgId === localOrgId) {
            setOrgMismatchWarning(false);
          }
        }
      } catch (err) {
        console.error('[Auth] Tab focus getinfo check failed:', err);
      }
    };

    document.addEventListener('visibilitychange', handleTabFocus);
    window.addEventListener('focus', handleTabFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleTabFocus);
      window.removeEventListener('focus', handleTabFocus);
    };
  }, [isAuthenticated, userInfo?.active_org?.id]);

  const login = useCallback(async (token: string, verifiedUserInfo?: any): Promise<boolean> => {
    localStorage.removeItem('shuffle_user_info');
    setRuntimeOrgId(null);
    resetRegionUrl();

    // Always store the session token so every subsequent request carries
    // `Authorization: Bearer <session>` regardless of platform, domain, or SameSite cookie rules.
    const tokenToStore = token?.trim() || '';

    persistSessionToken(tokenToStore);
    setSessionToken(tokenToStore || null);
    setIsAuthenticated(false);
    setUserInfo(null);

    if (verifiedUserInfo?.success === true) {
      applyAuthenticatedUserInfo(verifiedUserInfo);
      setIsAuthenticated(true);
      return true;
    }

    const result = await verifyUserInfo(tokenToStore, 2);
    if (result === 'ok') {
      setIsAuthenticated(true);
      return true;
    }

    clearAuthTokens();
    localStorage.removeItem('shuffle_user_info');
    setRuntimeOrgId(null);
    setSessionToken(null);
    setIsAuthenticated(false);
    setUserInfo(null);
    return false;
  }, [applyAuthenticatedUserInfo, fetchUserInfo, verifyUserInfo]);

  const refreshUserInfo = useCallback(async () => {
    const token = localStorage.getItem('session_token');
    await fetchUserInfo(token);
  }, [fetchUserInfo]);

  const setActiveOrg = useCallback(async (orgId: string) => {
    try {
      // Trace every org-change call so we can attribute unexpected ones
      // (e.g. fired from /incidents without the user clicking the switcher).
      console.warn('[Auth] setActiveOrg → /api/v1/orgs/' + orgId + '/change', {
        orgId,
        currentPath: typeof window !== 'undefined' ? window.location.pathname + window.location.search : 'n/a',
      });
      console.trace('[Auth] setActiveOrg call site');

      // Optimistically resolve target org from existing org list
      const targetOrg = userInfo?.orgs?.find(o => o.id === orgId);
      if (targetOrg) {
        // 1. Immediately broadcast org-change event so ThemeContext primes theme and brand color in 0ms
        try {
          window.dispatchEvent(new CustomEvent('shuffle:org-change', { detail: { org: targetOrg } }));
        } catch { /* ignore */ }

        // 2. Set runtime org id immediately
        setRuntimeOrgId(orgId);

        // 3. If target org has region_url, apply immediately
        if (targetOrg.region_url) {
          const mapped = mapCloudRegionUrl(targetOrg.region_url);
          applyRegionFromPayload({ region_url: mapped || targetOrg.region_url }, orgId);
        } else {
          resetRegionUrl();
        }

        // 4. Update userInfo state and prime localStorage
        setUserInfo(prev => {
          if (!prev) return null;
          const next = { ...prev, active_org: targetOrg };
          try {
            localStorage.setItem('shuffle_user_info', JSON.stringify(next));
          } catch {}
          return next;
        });
      } else {
        resetRegionUrl();
      }

      const response = await fetch(getApiUrl('/api/v1/orgs/' + orgId + '/change'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ org_id: orgId }),
      });

      if (!response.ok) {
        console.warn('Org change API returned non-OK:', response.status);
      } else {
        // /change responds with the new tenant's region_url — apply it through
        // the same setter/broadcast path as getinfo so later calls (including
        // the getinfo below) already hit the right region.
        const changeData = await response.json().catch(() => null);
        applyRegionFromPayload(changeData, orgId);
      }

      // Always call getinfo after org change to resolve latest details and update userInfo
      await fetchUserInfo();

      // Reload so all backend-query caches cleanly re-init for the new org
      window.location.reload();
    } catch (err) {
      console.error('Failed to change org:', err);
      // Still reload on error to ensure a clean state
      window.location.reload();
    }
  }, [fetchUserInfo, userInfo]);

  const logout = useCallback(async () => {
    // Capture token before clearing storage so we can tell the backend to revoke it
    const tokenToInvalidate = sessionToken || getSessionToken();

    // Thoroughly clean up local auth & cached state
    try {
      clearAuthTokens();
      localStorage.removeItem('shuffle_user_info');
      localStorage.removeItem('shuffle_region_url');
      localStorage.removeItem('shuffle_auth_mode');
      // On web, drop any custom/self-hosted server override so the next login
      // always starts from the default backend for this domain. Native mobile
      // keeps it, since the user typed their own server URL there.
      if (!isCapacitorNative()) {
        localStorage.removeItem('shuffle_custom_host_url');
        localStorage.removeItem('shuffle_selected_server_mode');
      }
    } catch { /* ignore */ }

    if (!isCapacitorNative()) {
      setHostBaseUrl(null);
    }

    setRuntimeOrgId(null);
    clearAuthTokens();
    resetRegionUrl();
    setSessionToken(null);
    setIsAuthenticated(false);
    setUserInfo(null);

    // Call the Shuffle logout API with the token so the backend revokes the session
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (tokenToInvalidate) {
        headers['Authorization'] = `Bearer ${tokenToInvalidate}`;
      }

      await fetch(getApiUrl('/api/v1/logout'), {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch (err) {
      console.error('Logout API call failed:', err);
    }
  }, [sessionToken]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        sessionToken,
        userInfo,
        login,
        logout,
        isLoading,
        refreshUserInfo,
        setActiveOrg,
        orgMismatchWarning,
        dismissOrgMismatch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/** Non-throwing variant for components that may render outside the provider (e.g. during HMR). */
export const useOptionalAuth = () => useContext(AuthContext);
