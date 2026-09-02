import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiUrl, getAuthHeader, setRegionUrl, resetRegionUrl, getTrackedOrgId, applyRegionFromPayload, setHostBaseUrl, getHostBaseUrl, setSessionToken as persistSessionToken, clearAuthTokens, getSessionToken, isDevEnvironment } from '@/Shuffle-MCPs/api';
import { setRuntimeOrgId } from '@/Shuffle-MCPs/datastore';
import { isCapacitorNative } from '@/Shuffle-MCPs/api';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orgMismatchWarning, setOrgMismatchWarning] = useState(false);

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

    const info = {
      username: data.username,
      id: data.id,
      active_org: data.active_org,
      orgs: data.orgs || [],
      support: data.support === true || data.support === 'true',
      app_execution_limit: data.app_execution_limit,
      app_execution_usage: data.app_execution_usage,
      sync_features: data.sync_features,
    };
    setUserInfo(info);
    setRuntimeOrgId(newOrgId);
    localStorage.setItem('shuffle_user_info', JSON.stringify(info));
    try {
      window.dispatchEvent(new CustomEvent('shuffle:getinfo', { detail: data }));
    } catch { /* ignore */ }
  }, []);

  const fetchUserInfo = useCallback(async (_token?: string | null): Promise<'ok' | 'unauthenticated' | 'error'> => {
    // Hard timeout: if the backend is unavailable the request can otherwise
    // hang forever and the "Checking login details…" overlay never resolves.
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const token = _token?.trim() || '';
      const response = await fetch(getApiUrl('/api/v1/getinfo'), {
        method: 'GET',
        credentials: token ? 'omit' : 'include',
        signal: controller.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json().catch(() => ({} as any));

      if (response.ok && data.success === true) {
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

      // Without a session token we can only be logged in through the session
      // cookie, which is same-origin only. On native apps, and whenever the
      // frontend points at a custom/self-hosted backend, no cookie can exist —
      // so skip the boot getinfo entirely and wait for a successful login.
      if (!token && (isCapacitorNative() || getHostBaseUrl())) {
        setIsAuthenticated(false);
        setUserInfo(null);
        setIsLoading(false);
        return;
      }


      // First attempt resolves the overlay quickly; only a repeated, explicit
      // auth failure is allowed to clear the stored session.
      let result = await fetchUserInfo(token);
      if (result === 'ok') {
        setIsAuthenticated(true);
      } else {
        setIsLoading(false);
        result = await verifyUserInfo(token, 2);
      }

      if (result === 'ok') {
        setIsAuthenticated(true);
      } else if (result === 'unauthenticated') {
        if (token) {
          localStorage.removeItem('session_token');
          setSessionToken(null);
        }
        localStorage.removeItem('shuffle_user_info');
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

  // Re-check org on tab focus to detect out-of-band org switches
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const token = getSessionToken();
        const response = await fetch(getApiUrl('/api/v1/getinfo'), {
          method: 'GET',
          credentials: token ? 'omit' : 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (response.ok && data.success === true) {
          const remoteOrgId = data.active_org?.id;
          const localOrgId = userInfo?.active_org?.id;
          if (remoteOrgId && localOrgId && remoteOrgId !== localOrgId) {
            console.warn(`[Auth] Org mismatch detected: local=${localOrgId}, remote=${remoteOrgId}`);
            setOrgMismatchWarning(true);
          }
        }
      } catch (err) {
        console.error('[Auth] Visibility getinfo check failed:', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, userInfo?.active_org?.id]);

  const login = useCallback(async (token: string, verifiedUserInfo?: any): Promise<boolean> => {
    localStorage.removeItem('shuffle_user_info');
    setRuntimeOrgId(null);
    resetRegionUrl();

    // Same-origin production web authentication is cookie-only. Native apps,
    // Lovable testing, and any custom/self-hosted backend (where the cookie is
    // cross-origin and therefore unusable) must carry the session token as the
    // bearer instead.
    const tokenToStore = (isCapacitorNative() || isDevEnvironment() || !!getHostBaseUrl()) ? token : '';

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
  }, [applyAuthenticatedUserInfo, fetchUserInfo]);

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

      // Reset region URL and theme immediately — the new org may have different settings
      resetRegionUrl();
      localStorage.removeItem('shuffle-theme');

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

      // Always call getinfo after org change to resolve the new region_url
      // and update userInfo before reloading
      await fetchUserInfo();

      // Reload so all components refetch for the new org
      window.location.reload();
    } catch (err) {
      console.error('Failed to change org:', err);
      // Still reload on error to ensure a clean state
      window.location.reload();
    }
  }, [fetchUserInfo]);

  const logout = useCallback(async () => {
    // Capture token before clearing storage so we can tell the backend to revoke it
    const tokenToInvalidate = sessionToken || getSessionToken();

    // Thoroughly clean up local auth & cached state
    try {
      clearAuthTokens();
      localStorage.removeItem('shuffle_user_info');
      localStorage.removeItem('shuffle_region_url');
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
