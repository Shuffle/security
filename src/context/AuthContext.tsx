import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiUrl, getAuthHeader, setRegionUrl, resetRegionUrl, getTrackedOrgId, applyRegionFromPayload, setHostBaseUrl, setSessionToken as persistSessionToken, clearAuthTokens, getSessionToken } from '@/Shuffle-MCPs/api';
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
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  refreshUserInfo: () => Promise<void>;
  authenticateWithApiKey: (data: any) => void;
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
  const hasCachedSession = !!(cachedUserInfo && (cachedToken || cachedUserInfo.active_org?.id));

  const [sessionToken, setSessionToken] = useState<string | null>(cachedToken);
  const [isAuthenticated, setIsAuthenticated] = useState(hasCachedSession);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(hasCachedSession ? cachedUserInfo : null);
  // Only block UI on the initial getinfo when we have nothing cached. If we
  // already have a cached session, render optimistically and revalidate in
  // the background.
  const [isLoading, setIsLoading] = useState(!hasCachedSession);
  const [orgMismatchWarning, setOrgMismatchWarning] = useState(false);

  // Seed the runtime org id from cache synchronously so datastore calls
  // fired on the very first render don't get "no org" and 401.
  if (hasCachedSession && cachedUserInfo?.active_org?.id) {
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
      const response = await fetch(getApiUrl('/api/v1/getinfo'), {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          ...getAuthHeader(),
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

  // Verify authentication on mount (runs once when app loads).
  // If we already hydrated from cache, this runs in the background and only
  // tears down auth on an explicit unauthenticated response — transient
  // errors (slow getinfo, 5xx) leave the cached session in place.
  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('session_token');
      if (token !== sessionToken) setSessionToken(token);

      // On mobile (or web with no cached session), unauthenticated is the starting point.
      // Skip the initial network request to avoid unnecessary 401s on initial boot.
      if (!token && (!hasCachedSession || isCapacitorNative())) {
        setIsAuthenticated(false);
        setUserInfo(null);
        setIsLoading(false);
        return;
      }

      const result = await fetchUserInfo(token);
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
        const response = await fetch(getApiUrl('/api/v1/getinfo'), {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...getAuthHeader(),
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

  const login = useCallback(async (token: string) => {
    // Exactly one auth credential may exist at a time. Wipe any previous
    // session token and every legacy API key before storing the new one, so
    // two different users' tokens can never coexist.
    persistSessionToken(token);
    setSessionToken(token);
    setIsAuthenticated(true);
    await fetchUserInfo(token);
  }, [fetchUserInfo]);

  const refreshUserInfo = useCallback(async () => {
    const token = localStorage.getItem('session_token');
    await fetchUserInfo(token);
  }, [fetchUserInfo]);

  const authenticateWithApiKey = useCallback((data: any) => {
    applyAuthenticatedUserInfo(data);
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [applyAuthenticatedUserInfo]);

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
        authenticateWithApiKey,
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
