import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Eye,
  EyeOff,
  Server,
  Cloud,
  ArrowRight,
  Lock,
  Mail,
  User,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Link } from '@/lib/router-compat';
import {
  getApiUrl,
  setHostBaseUrl,
  getHostBaseUrl,
  isShuffleCloudDomain,
  setRegionUrl,
  API_ENDPOINTS,
} from '../api';
import { setHostBaseUrl as setMcpHostBaseUrl } from '@/Shuffle-MCPs/api';
import { ShuffleCompanyLogo, ShuffleSecurityLogo } from '@/components/common/ShuffleLogo';
import { sanitizeInternalDestination } from '@/lib/safeRedirect';
import { isCapacitorNative } from '@/lib/capacitor';
import { useAuth } from '@/context/AuthContext';

const SERVER_MODE_STORAGE_KEY = 'shuffle_selected_server_mode';
const CUSTOM_HOST_STORAGE_KEY = 'shuffle_custom_host_url';

export interface LoginPageProps {
  product?: 'security' | 'automation' | 'core';
  productName?: string;
  productSubtitle?: string;
  logo?: React.ReactNode;
  header?: React.ReactNode;
  mode?: 'login' | 'register';
  defaultDestination?: string;
  adminSetupPath?: string;
  allowSelfHosted?: boolean;
  onLoginSuccess?: (token: string, userInfo?: any) => void | Promise<void>;
  onAdminSetupRedirect?: (path: string) => void;
  theme?: 'light' | 'dark' | 'system';
}

export const LoginPage: React.FC<LoginPageProps> = ({
  product = 'security',
  productName,
  productSubtitle,
  logo,
  header,
  mode = 'login',
  defaultDestination: customDefaultDestination,
  adminSetupPath = '/adminsetup',
  allowSelfHosted = true,
  onLoginSuccess,
  onAdminSetupRedirect,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Host app auth context if available
  let authContext: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    authContext = useAuth();
  } catch {
    // AuthProvider not present in outer tree (e.g. standalone usage)
  }
  const { login, isAuthenticated = false, isLoading: authLoading = false } = authContext || {};

  const mfaInputRef = useRef<HTMLInputElement>(null);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const isMobile =
    isCapacitorNative() ||
    (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);

  const hasLoggedInBefore =
    typeof window !== 'undefined' && localStorage.getItem('shuffle_has_logged_in') === 'true';

  const defaultDestination =
    customDefaultDestination ||
    (product === 'security'
      ? isMobile
        ? '/incidents'
        : hasLoggedInBefore
        ? '/dashboard'
        : '/onboarding'
      : '/workflows');

  // Return URL resolution: query params > router state > session storage > default destination
  const from = useMemo(() => {
    const rawSearch =
      (location.search && location.search !== '?' ? location.search : '') ||
      (typeof window !== 'undefined' ? window.location.search : '');

    const cleanSearch = rawSearch.startsWith('??')
      ? rawSearch.slice(1)
      : rawSearch.startsWith('?')
      ? rawSearch
      : rawSearch ? `?${rawSearch}` : '';

    const searchParams = new URLSearchParams(cleanSearch);
    const returnUrl =
      searchParams.get('redirect') ||
      searchParams.get('redirect_to') ||
      searchParams.get('return_to') ||
      searchParams.get('view') ||
      searchParams.get('returnUrl') ||
      searchParams.get('next');

    let stateFrom: string | null = null;
    if (location.state?.from) {
      if (typeof location.state.from === 'string') {
        stateFrom = location.state.from;
      } else if (typeof location.state.from === 'object') {
        const p = location.state.from.pathname || '';
        const s = location.state.from.search || '';
        const h = location.state.from.hash || '';
        stateFrom = `${p}${s}${h}` || null;
      }
    }

    let sessionRedirect: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        sessionRedirect = sessionStorage.getItem('shuffle_redirect_after_login');
      } catch {}
    }

    const candidate = returnUrl || stateFrom || sessionRedirect || defaultDestination;
    return sanitizeInternalDestination(candidate, defaultDestination);
  }, [location.search, location.state, defaultDestination]);

  // Persist redirect target in session storage across pre-login flows
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawSearch =
      (location.search && location.search !== '?' ? location.search : '') ||
      window.location.search;
    if (!rawSearch) return;
    const params = new URLSearchParams(rawSearch.startsWith('??') ? rawSearch.slice(1) : rawSearch);
    const explicit =
      params.get('redirect') ||
      params.get('redirect_to') ||
      params.get('return_to') ||
      params.get('view') ||
      params.get('returnUrl') ||
      params.get('next');
    if (!explicit) return;
    const safe = sanitizeInternalDestination(explicit, '');
    if (!safe) return;
    try {
      sessionStorage.setItem('shuffle_redirect_after_login', safe);
    } catch {}
  }, [location.search]);

  // Notice banner extracted from ?message= query param
  const urlMessageNotice = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get('message') || '';
    } catch {
      return '';
    }
  }, []);

  const goToRedirectTarget = (target: string) => {
    if (typeof window !== 'undefined' && target.includes('?')) {
      window.location.assign(target);
      return;
    }
    navigate(target, { replace: true });
  };

  // Redirect if already authenticated
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (hasRedirectedRef.current) return;
    const target = (from || defaultDestination).split('?')[0];
    if (target === location.pathname) return;
    hasRedirectedRef.current = true;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('shuffle_redirect_after_login');
      } catch {}
    }
    goToRedirectTarget(from);
  }, [isAuthenticated, authLoading, navigate, from, location.pathname, defaultDestination]);

  // ---------------------------------------------------------------------------
  // Server Selection Persistence: Remember Cloud vs Self-Hosted choice
  // ---------------------------------------------------------------------------
  const [serverMode, setServerMode] = useState<'cloud' | 'self-hosted'>(() => {
    if (typeof window === 'undefined' || !allowSelfHosted) return 'cloud';
    try {
      const stored = localStorage.getItem(SERVER_MODE_STORAGE_KEY);
      if (stored === 'self-hosted' || stored === 'cloud') return stored;
    } catch {}
    return 'cloud';
  });

  const [customHostUrl, setCustomHostUrl] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(CUSTOM_HOST_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  // Host ping & setup status (Self-Hosted mode only)
  const [isPingingHost, setIsPingingHost] = useState(false);
  const [hostPingStatus, setHostPingStatus] = useState<'idle' | 'success' | 'needs-admin' | 'error'>('idle');
  const [hostPingMessage, setHostPingMessage] = useState('');
  const [instanceSsoUrl, setInstanceSsoUrl] = useState<string | null>(null);

  // Auth form states
  const [authMode, setAuthMode] = useState<'login' | 'register'>(mode);
  const isRegister = authMode === 'register';
  useEffect(() => {
    setAuthMode(mode);
  }, [mode]);

  // SSO Discovery Mode (Cloud mode: work email lookup)
  const [isSsoDiscovery, setIsSsoDiscovery] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState('');

  // Password reset mode (Cloud only)
  const [isResetPasswordMode, setIsResetPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmailSuccessMsg, setResetEmailSuccessMsg] = useState('');

  // Credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // MFA
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  // General feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(urlMessageNotice);

  // Sync host base URL when serverMode or customHostUrl changes
  useEffect(() => {
    if (!hydrated) return;
    if (serverMode === 'self-hosted' && customHostUrl.trim()) {
      let normalized = customHostUrl.trim().replace(/\/+$/, '');
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = 'https://' + normalized;
      }
      setHostBaseUrl(normalized);
      setMcpHostBaseUrl(normalized);
    } else if (serverMode === 'cloud') {
      setHostBaseUrl(null);
      setMcpHostBaseUrl(null);
    }
  }, [hydrated, serverMode, customHostUrl]);

  // Handle server mode switch with persistence
  const handleServerModeChange = (newMode: 'cloud' | 'self-hosted') => {
    setServerMode(newMode);
    setError('');
    setSsoError('');
    setMfaRequired(false);
    setMfaCode('');
    setIsSsoDiscovery(false);
    setHostPingStatus('idle');
    setHostPingMessage('');
    setInstanceSsoUrl(null);

    if (newMode === 'self-hosted') {
      setIsResetPasswordMode(false);
      setResetEmailSent(false);
    }

    try {
      localStorage.setItem(SERVER_MODE_STORAGE_KEY, newMode);
      if (newMode === 'cloud') {
        setHostBaseUrl(null);
        setMcpHostBaseUrl(null);
      } else if (customHostUrl.trim()) {
        let normalized = customHostUrl.trim().replace(/\/+$/, '');
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
          normalized = 'https://' + normalized;
        }
        setHostBaseUrl(normalized);
        setMcpHostBaseUrl(normalized);
        localStorage.setItem(CUSTOM_HOST_STORAGE_KEY, normalized);
      }
    } catch {}
  };

  // ---------------------------------------------------------------------------
  // Self-Hosted Ping & Admin Setup Check (SCOPED TO SELF-HOSTED ONLY)
  // ---------------------------------------------------------------------------
  const handlePingHost = async (hostToTest?: string) => {
    const rawUrl = (hostToTest !== undefined ? hostToTest : customHostUrl).trim();
    if (!rawUrl) {
      setHostPingStatus('error');
      setHostPingMessage('Please enter a server URL (e.g. https://shuffle.example.com:3443)');
      return;
    }

    let urlToTest = rawUrl.replace(/\/+$/, '');
    if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
      urlToTest = 'https://' + urlToTest;
      setCustomHostUrl(urlToTest);
    }

    // Shuffle Cloud URLs switch cleanly back to Cloud mode
    if (isShuffleCloudDomain(urlToTest)) {
      setCustomHostUrl('');
      setHostPingStatus('idle');
      setHostPingMessage('');
      handleServerModeChange('cloud');
      setNotice('Switched to Shuffle Cloud login');
      return;
    }

    setIsPingingHost(true);
    setHostPingStatus('idle');
    setHostPingMessage('');
    setInstanceSsoUrl(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6000);

    try {
      setHostBaseUrl(urlToTest);
      setMcpHostBaseUrl(urlToTest);
      localStorage.setItem(CUSTOM_HOST_STORAGE_KEY, urlToTest);

      // Probe 1: Ping /api/v1/getinfo for server reachability
      const getInfoRes = await fetch(`${urlToTest}/api/v1/getinfo`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      const isReachable = getInfoRes.ok || getInfoRes.status === 401 || getInfoRes.status === 403;
      if (!isReachable) {
        setHostPingStatus('error');
        setHostPingMessage(`Server responded with status ${getInfoRes.status}`);
        return;
      }

      // Probe 2: Query /api/v1/checkusers (Self-Hosted ONLY) to detect uninitialized server
      try {
        const checkRes = await fetch(`${urlToTest}/api/v1/checkusers`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        const checkData = await checkRes.json().catch(() => ({}));

        // Instance SSO discovery
        if (checkData.sso_url && typeof checkData.sso_url === 'string') {
          setInstanceSsoUrl(checkData.sso_url);
        }

        // reason: "stay" => 0 users exist! Uninitialized instance needs /adminsetup!
        if (checkData.reason === 'stay') {
          setHostPingStatus('needs-admin');
          setHostPingMessage('Connected to server. No users configured — administrator setup required.');
          return;
        }
      } catch {
        // Non-fatal if checkusers errors, fallback to basic success
      }

      setHostPingStatus('success');
      setHostPingMessage('Connected to Shuffle server successfully!');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setHostPingStatus('error');
        setHostPingMessage('Connection test timed out after 6 seconds. Check the URL or network.');
      } else {
        setHostPingStatus('error');
        setHostPingMessage('Unable to reach server. Check URL, HTTPS certificates, or network access.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsPingingHost(false);
    }
  };

  // If returning to a previously saved self-hosted URL on mount, auto-verify it once
  const initialSelfHostedCheckRanRef = useRef(false);
  useEffect(() => {
    if (initialSelfHostedCheckRanRef.current) return;
    if (serverMode === 'self-hosted' && customHostUrl.trim()) {
      initialSelfHostedCheckRanRef.current = true;
      handlePingHost(customHostUrl);
    }
  }, [serverMode, customHostUrl]);

  // ---------------------------------------------------------------------------
  // SSO Discovery Flow (CLOUD MODE)
  // ---------------------------------------------------------------------------
  const handleSsoDiscoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSsoError('');

    if (!username.trim() || !isValidEmail(username)) {
      setSsoError('Please enter a valid work email address.');
      return;
    }

    setSsoLoading(true);

    try {
      const ssoEndpoint = getApiUrl(API_ENDPOINTS.loginSso);
      const res = await fetch(ssoEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      const isSsoRedirect =
        data.reason === 'SSO_REDIRECT' ||
        data.message === 'SSO_REDIRECT' ||
        data.sso_redirect === true;

      const targetUrl = data.url || data.redirect_url || data.sso_url;

      if (isSsoRedirect && targetUrl && typeof targetUrl === 'string') {
        if (typeof window !== 'undefined' && from) {
          try {
            sessionStorage.setItem('shuffle_redirect_after_login', from);
          } catch {}
        }
        window.location.assign(targetUrl);
        return;
      }

      if (data.success === false || !res.ok) {
        setSsoError(
          data.reason ||
            data.message ||
            'No Single Sign-On provider found for this email domain. Please sign in with your password.'
        );
        return;
      }

      setSsoError('Unable to resolve Single Sign-On provider. Please sign in with your password.');
    } catch (err: any) {
      setSsoError(err?.message || 'Network error while looking up Single Sign-On provider.');
    } finally {
      setSsoLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Validation & Formatting
  // ---------------------------------------------------------------------------
  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

  const identifierLabel =
    serverMode === 'cloud' ? 'Work Email' : 'Username or Email';

  const cloudEmailInvalid =
    serverMode === 'cloud' && username.trim().length > 0 && !isValidEmail(username);

  // Auto-focus MFA input on prompt
  useEffect(() => {
    if (!mfaRequired) return undefined;
    const timer = setTimeout(() => {
      mfaInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [mfaRequired]);

  // ---------------------------------------------------------------------------
  // Primary Login / Registration Submit Handler
  // ---------------------------------------------------------------------------
  const performLogin = async (codeToUse?: string) => {
    setError('');
    const code = codeToUse !== undefined ? codeToUse : mfaCode;

    if (!mfaRequired) {
      if (!username.trim()) {
        setError(
          serverMode === 'cloud'
            ? 'Please enter your work email address.'
            : 'Please enter your username or email address.'
        );
        return;
      }
      if (serverMode === 'cloud' && !isValidEmail(username)) {
        setError('Please enter a valid work email address.');
        return;
      }
      if (!password) {
        setError('Please enter your password.');
        return;
      }
      if (isRegister && password.length < 10) {
        setError('Password must be at least 10 characters.');
        return;
      }
      if (isRegister && !termsAccepted) {
        setError("Please agree to Shuffle's Terms of Service to continue.");
        return;
      }
    }

    if (serverMode === 'self-hosted') {
      if (!customHostUrl.trim()) {
        setError('Please provide your self-hosted Shuffle server URL');
        return;
      }

      let normalized = customHostUrl.trim().replace(/\/+$/, '');
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = 'https://' + normalized;
        setCustomHostUrl(normalized);
      }

      if (isShuffleCloudDomain(normalized)) {
        setCustomHostUrl('');
        setHostPingStatus('idle');
        setHostPingMessage('');
        handleServerModeChange('cloud');
        setNotice('Switched to Shuffle Cloud login');
        return;
      }

      setHostBaseUrl(normalized);
      setMcpHostBaseUrl(normalized);
      localStorage.setItem(SERVER_MODE_STORAGE_KEY, 'self-hosted');
      localStorage.setItem(CUSTOM_HOST_STORAGE_KEY, normalized);
    } else {
      setHostBaseUrl(null);
      setMcpHostBaseUrl(null);
      localStorage.setItem(SERVER_MODE_STORAGE_KEY, 'cloud');
      localStorage.removeItem(CUSTOM_HOST_STORAGE_KEY);
    }

    setLoading(true);

    try {
      const body: Record<string, string> = { username: username.trim(), password };
      if ((mfaRequired || code) && code) {
        body.mfa_code = code;
      }

      const loginUrl = getApiUrl(isRegister ? API_ENDPOINTS.register : API_ENDPOINTS.login);
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      // Edgecase 1: SSO Redirect required by backend
      const isSsoRedirect =
        data.reason === 'SSO_REDIRECT' ||
        data.message === 'SSO_REDIRECT' ||
        data.sso_redirect === true;

      if (isSsoRedirect) {
        const ssoUrl = data.url || data.redirect_url || data.sso_url;
        if (ssoUrl && typeof ssoUrl === 'string') {
          if (typeof window !== 'undefined' && from) {
            try {
              sessionStorage.setItem('shuffle_redirect_after_login', from);
            } catch {}
          }
          window.location.assign(ssoUrl);
          return;
        }
        setError('Single Sign-On is required, but no redirect URL was provided by the server.');
        return;
      }

      // Edgecase 2: MFA Setup required by backend (/login/{token}/mfa-setup)
      const isMfaSetup =
        data.reason === 'MFA_SETUP' ||
        data.message === 'MFA_SETUP' ||
        data.mfa_setup === true;

      if (isMfaSetup) {
        const setupToken = data.url || data.token || data.extra;
        if (setupToken && typeof setupToken === 'string') {
          if (typeof window !== 'undefined' && from) {
            try {
              sessionStorage.setItem('shuffle_redirect_after_login', from);
            } catch {}
          }
          const rawSearch =
            (location.search && location.search !== '?' ? location.search : '') ||
            (typeof window !== 'undefined' ? window.location.search : '');
          const cleanSearch = rawSearch.startsWith('?') ? rawSearch : rawSearch ? `?${rawSearch}` : '';
          navigate(`/login/${encodeURIComponent(setupToken)}/mfa-setup${cleanSearch}`);
          return;
        }
        setError('Multi-factor authentication setup is required, but no setup token was provided.');
        return;
      }

      // Edgecase 3: MFA Code prompt (MFA_REDIRECT / 402)
      const isMfaRedirect =
        data.reason === 'MFA_REDIRECT' ||
        data.message === 'MFA_REDIRECT' ||
        data.mfa_required === true ||
        response.status === 402 ||
        data.reason === 'MFA_REQUIRED';

      if (isMfaRedirect) {
        setMfaRequired(true);
        setError('');
        setMfaCode('');
        return;
      }

      // Edgecase 4: Multi-region URL returned in login payload (Cloud only)
      if (serverMode === 'cloud' && data.region_url && typeof data.region_url === 'string') {
        try {
          setRegionUrl(data.region_url, data.org_id || null);
          localStorage.setItem('globalUrl', data.region_url);
        } catch {}
      }

      // Edgecase 5: Shuffle account notice on register
      if (data.reason === 'shuffle_account') {
        setAuthMode('login');
        setNotice('Please sign in with your existing Shuffle account.');
        return;
      }

      if (!response.ok) {
        setError(
          data.reason ||
            data.message ||
            (isRegister
              ? 'Registration failed. Please try again.'
              : mfaRequired
              ? 'Invalid MFA code'
              : 'Invalid username or password')
        );
        return;
      }

      // Extract session token
      const sessionToken =
        data.session_token ||
        data.token ||
        data.cookies?.find((c: { key: string; value: string }) => c.key === 'session_token')?.value;

      if (isRegister && data.success !== false && !sessionToken) {
        setAuthMode('login');
        setPassword('');
        setNotice('Registration successful. Please sign in.');
        return;
      }

      if (data.success !== false) {
        // Validate session with getinfo before considering logged in
        let verified = false;
        let verifyData: any = null;
        let detectedAuthMode: 'cookie' | 'bearer' = 'cookie';

        try {
          // 1. Try standard cookie verification
          const cookieRes = await fetch(getApiUrl('/api/v1/getinfo'), {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          const cookieData = await cookieRes.json().catch(() => ({} as any));
          if (cookieRes.ok && cookieData?.success === true) {
            verified = true;
            verifyData = cookieData;
            detectedAuthMode = 'cookie';
          }
        } catch {}

        if (!verified && sessionToken) {
          try {
            // 2. Fallback to Bearer token
            const bearerRes = await fetch(getApiUrl('/api/v1/getinfo'), {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionToken}`,
              },
            });
            const bearerData = await bearerRes.json().catch(() => ({} as any));
            if (bearerRes.ok && bearerData?.success === true) {
              verified = true;
              verifyData = bearerData;
              detectedAuthMode = 'bearer';
            }
          } catch {}
        }

        if (verified) {
          localStorage.setItem('shuffle_auth_mode', detectedAuthMode);
          if (login) {
            const accepted = await login(sessionToken || '', verifyData);
            verified = accepted;
          }
        }

        if (!verified) {
          setError('Login succeeded but the session could not be verified. Please try again.');
          return;
        }

        if (onLoginSuccess) {
          await onLoginSuccess(sessionToken || '', verifyData);
        }

        localStorage.setItem('shuffle_has_logged_in', 'true');
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('shuffle_redirect_after_login');
          } catch {}
        }
        goToRedirectTarget(from);
      } else {
        setError(data.reason || data.message || 'Login failed. Please verify credentials.');
      }
    } catch (err: any) {
      if (err?.name === 'TypeError' || err?.message?.includes('fetch')) {
        const targetHost = serverMode === 'self-hosted' ? customHostUrl : 'Shuffle Cloud';
        setError(
          `Unable to reach server (${targetHost}). Please verify the URL, network connection, or SSL certificate.`
        );
      } else {
        setError(err?.message || 'Network error. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setMfaCode(cleaned);
    if (cleaned.length === 6 && !loading) {
      performLogin(cleaned);
    }
  };

  // Password reset submit (Cloud only)
  const handleResetPasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !isValidEmail(username)) {
      setError('Please enter your work email address.');
      return;
    }

    setLoading(true);
    setError('');
    setResetEmailSent(false);

    try {
      const res = await fetch(getApiUrl(API_ENDPOINTS.passwordResetMail), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.reason || data.message || `Password reset failed (status: ${res.status})`);
      }

      setResetEmailSent(true);
      setResetEmailSuccessMsg(
        data.reason ||
          `If an account exists for "${username.trim()}", a password reset link has been sent to your email.`
      );
    } catch (err: any) {
      setError(err?.message || 'Error requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isResetPasswordMode) {
      handleResetPasswordSubmit(e);
      return;
    }
    if (isSsoDiscovery) {
      handleSsoDiscoverySubmit(e);
      return;
    }
    if (mfaRequired) {
      if (mfaCode.length < 6) {
        setError('Please enter all 6 digits of your MFA code');
        return;
      }
      performLogin(mfaCode);
    } else {
      performLogin();
    }
  };

  // Trigger admin setup navigation
  const handleAdminSetupNavigation = () => {
    if (onAdminSetupRedirect) {
      onAdminSetupRedirect(adminSetupPath);
      return;
    }
    navigate(adminSetupPath);
  };

  // Branding text defaults
  const effectiveTitle =
    productName || (product === 'security' ? 'Shuffle Security' : 'Shuffle');
  const effectiveSubtitle =
    productSubtitle ||
    (product === 'security'
      ? 'Open Source Incident Response & Automation'
      : 'Open Source Security Automation & Orchestration');
  const effectiveLogo =
    logo ||
    (product === 'security' ? (
      <ShuffleSecurityLogo size={52} />
    ) : (
      <ShuffleCompanyLogo size={52} />
    ));

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'hsl(var(--background))', position: 'relative' }}>
      {header && !isCapacitorNative() && (
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>{header}</Box>
      )}

      <Box
        sx={{
          minHeight: '100dvh',
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box',
          bgcolor: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'flex-start', md: 'center' },
          alignItems: 'center',
          px: { xs: 2, sm: 2.5 },
          py: { xs: 2, sm: 4 },
          pt: {
            xs: 'max(4.5rem, calc(2.5rem + env(safe-area-inset-top, 40px)))',
            sm: 5,
            md: 'max(6rem, 80px)',
          },
          pb: {
            xs: 'max(2.5rem, calc(2rem + env(safe-area-inset-bottom, 24px)))',
            sm: 4,
            md: 6,
          },
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: 'min(440px, 100%)', boxSizing: 'border-box' }}
        >
          {/* Brand Header */}
          <Box sx={{ textAlign: 'center', mb: { xs: 2.5, sm: 3 } }}>
            <Box
              sx={{
                display: 'inline-flex',
                p: 0.5,
                borderRadius: 3,
                mb: 1.5,
                boxShadow: '0 8px 24px rgba(255, 102, 0, 0.2)',
              }}
            >
              {effectiveLogo}
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.5px',
                color: 'hsl(var(--foreground))',
                fontSize: { xs: '1.35rem', sm: '1.5rem' },
              }}
            >
              {effectiveTitle}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'hsl(var(--muted-foreground))',
                fontSize: '0.825rem',
                mt: 0.5,
              }}
            >
              {effectiveSubtitle}
            </Typography>
          </Box>

          {/* Main Card */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3.5 },
              borderRadius: 3,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
          >
            {/* Server Mode Segmented Switcher (Persisted between visits) */}
            {allowSelfHosted && !mfaRequired && !isResetPasswordMode && (
              <Box
                sx={{
                  display: 'flex',
                  p: 0.5,
                  mb: 2.5,
                  borderRadius: 2,
                  bgcolor: 'hsl(var(--muted) / 0.5)',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <Button
                  fullWidth
                  size="small"
                  onClick={() => handleServerModeChange('cloud')}
                  startIcon={<Cloud size={15} />}
                  sx={{
                    borderRadius: 1.5,
                    py: 0.75,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.825rem',
                    color:
                      serverMode === 'cloud'
                        ? '#fff'
                        : 'hsl(var(--muted-foreground))',
                    bgcolor:
                      serverMode === 'cloud'
                        ? '#ff6600'
                        : 'transparent',
                    boxShadow:
                      serverMode === 'cloud'
                        ? '0 2px 8px rgba(255, 102, 0, 0.3)'
                        : 'none',
                    '&:hover': {
                      bgcolor:
                        serverMode === 'cloud'
                          ? '#e65c00'
                          : 'hsl(var(--muted) / 0.8)',
                    },
                  }}
                >
                  Shuffle Cloud
                </Button>
                <Button
                  fullWidth
                  size="small"
                  onClick={() => handleServerModeChange('self-hosted')}
                  startIcon={<Server size={15} />}
                  sx={{
                    borderRadius: 1.5,
                    py: 0.75,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.825rem',
                    color:
                      serverMode === 'self-hosted'
                        ? '#fff'
                        : 'hsl(var(--muted-foreground))',
                    bgcolor:
                      serverMode === 'self-hosted'
                        ? '#ff6600'
                        : 'transparent',
                    boxShadow:
                      serverMode === 'self-hosted'
                        ? '0 2px 8px rgba(255, 102, 0, 0.3)'
                        : 'none',
                    '&:hover': {
                      bgcolor:
                        serverMode === 'self-hosted'
                          ? '#e65c00'
                          : 'hsl(var(--muted) / 0.8)',
                    },
                  }}
                >
                  Self-Hosted
                </Button>
              </Box>
            )}

            {/* Notice / Alert banners */}
            {notice && (
              <Alert
                severity="info"
                onClose={() => setNotice('')}
                sx={{ mb: 2, borderRadius: 2, fontSize: '0.825rem' }}
              >
                {notice}
              </Alert>
            )}

            {error && (
              <Alert
                severity="error"
                onClose={() => setError('')}
                sx={{ mb: 2, borderRadius: 2, fontSize: '0.825rem' }}
              >
                {error}
              </Alert>
            )}

            {ssoError && (
              <Alert
                severity="warning"
                onClose={() => setSsoError('')}
                sx={{ mb: 2, borderRadius: 2, fontSize: '0.825rem' }}
              >
                {ssoError}
              </Alert>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* SELF-HOSTED SETUP SECTION (SCOPED ONLY TO SELF-HOSTED) */}
            {/* ---------------------------------------------------------------- */}
            {serverMode === 'self-hosted' && !mfaRequired && (
              <Box
                sx={{
                  mb: 2.5,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'hsl(var(--muted) / 0.3)',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontWeight: 700,
                    mb: 1,
                    color: 'hsl(var(--foreground))',
                  }}
                >
                  Shuffle Server URL
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="https://shuffle.example.com:3443"
                    value={customHostUrl}
                    onChange={(e) => {
                      setCustomHostUrl(e.target.value);
                      setHostPingStatus('idle');
                      setHostPingMessage('');
                      setInstanceSsoUrl(null);
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'hsl(var(--background))',
                        fontSize: '0.825rem',
                      },
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handlePingHost()}
                    disabled={isPingingHost || !customHostUrl.trim()}
                    sx={{
                      minWidth: 80,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    {isPingingHost ? <CircularProgress size={16} /> : 'Test'}
                  </Button>
                </Box>

                {/* Server Status Feedback */}
                {hostPingMessage && (
                  <Box sx={{ mt: 1.5 }}>
                    {hostPingStatus === 'needs-admin' ? (
                      <Alert
                        severity="warning"
                        sx={{ borderRadius: 1.5, fontSize: '0.8rem' }}
                        action={
                          <Button
                            color="inherit"
                            size="small"
                            onClick={handleAdminSetupNavigation}
                            sx={{ fontWeight: 700, textTransform: 'none' }}
                          >
                            Set Up Admin
                          </Button>
                        }
                      >
                        {hostPingMessage}
                      </Alert>
                    ) : hostPingStatus === 'success' ? (
                      <Alert severity="success" sx={{ borderRadius: 1.5, fontSize: '0.8rem' }}>
                        {hostPingMessage}
                      </Alert>
                    ) : (
                      <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: '0.8rem' }}>
                        {hostPingMessage}
                      </Alert>
                    )}
                  </Box>
                )}

                {/* Instance SSO detected via /api/v1/checkusers */}
                {instanceSsoUrl && (
                  <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed hsl(var(--border))' }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'hsl(var(--muted-foreground))' }}>
                      Single Sign-On is configured on this instance:
                    </Typography>
                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          if (from) sessionStorage.setItem('shuffle_redirect_after_login', from);
                          window.location.assign(instanceSsoUrl);
                        }
                      }}
                      startIcon={<ShieldCheck size={16} />}
                      sx={{
                        bgcolor: '#2563eb',
                        '&:hover': { bgcolor: '#1d4ed8' },
                        color: '#fff',
                        textTransform: 'none',
                        fontWeight: 600,
                        py: 0.8,
                      }}
                    >
                      Sign in with Instance SSO
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* MFA PROMPT SECTION */}
            {/* ---------------------------------------------------------------- */}
            {mfaRequired ? (
              <form onSubmit={handlePrimaryFormSubmit}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 1.25,
                      borderRadius: '50%',
                      bgcolor: 'hsl(var(--muted))',
                      mb: 1.5,
                      color: '#ff6600',
                    }}
                  >
                    <KeyRound size={28} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Two-Factor Authentication
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.825rem' }}>
                    Enter the 6-digit code from your authenticator app
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    inputRef={mfaInputRef}
                    size="small"
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => handleMfaChange(e.target.value)}
                    inputProps={{
                      maxLength: 6,
                      inputMode: 'numeric',
                      pattern: '[0-9]*',
                      style: { textAlign: 'center', letterSpacing: '0.35em', fontSize: '1.25rem', fontWeight: 700 },
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'hsl(var(--background))',
                      },
                    }}
                  />
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading || mfaCode.length < 6}
                  sx={{
                    bgcolor: '#ff6600',
                    '&:hover': { bgcolor: '#e65c00' },
                    color: '#fff',
                    py: 1,
                    fontWeight: 600,
                    textTransform: 'none',
                  }}
                >
                  {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Verify & Sign In'}
                </Button>

                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Button
                    size="small"
                    onClick={() => {
                      setMfaRequired(false);
                      setMfaCode('');
                      setError('');
                    }}
                    startIcon={<ArrowLeft size={14} />}
                    sx={{ textTransform: 'none', color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}
                  >
                    Back to credentials
                  </Button>
                </Box>
              </form>
            ) : isResetPasswordMode ? (
              /* -------------------------------------------------------------- */
              /* CLOUD PASSWORD RESET SECTION */
              /* -------------------------------------------------------------- */
              <form onSubmit={handlePrimaryFormSubmit}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Reset your password
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.825rem' }}>
                    Enter your work email address and we'll send a password reset link.
                  </Typography>
                </Box>

                {resetEmailSent ? (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <CheckCircle2 size={40} style={{ color: '#22c55e', margin: '0 auto 8px auto' }} />
                    <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', mb: 2 }}>
                      {resetEmailSuccessMsg}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setIsResetPasswordMode(false);
                        setResetEmailSent(false);
                      }}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      Return to sign in
                    </Button>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ mb: 2.5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        autoFocus
                        type="email"
                        placeholder="user@company.com"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        sx={{
                          '& .MuiOutlinedInput-root': { bgcolor: 'hsl(var(--background))' },
                        }}
                      />
                    </Box>

                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      disabled={loading || !username.trim()}
                      sx={{
                        bgcolor: '#ff6600',
                        '&:hover': { bgcolor: '#e65c00' },
                        color: '#fff',
                        py: 1,
                        fontWeight: 600,
                        textTransform: 'none',
                        mb: 2,
                      }}
                    >
                      {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Send Reset Link'}
                    </Button>

                    <Box sx={{ textAlign: 'center' }}>
                      <Button
                        size="small"
                        onClick={() => setIsResetPasswordMode(false)}
                        startIcon={<ArrowLeft size={14} />}
                        sx={{ textTransform: 'none', color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </>
                )}
              </form>
            ) : isSsoDiscovery ? (
              /* -------------------------------------------------------------- */
              /* CLOUD SSO DISCOVERY SECTION */
              /* -------------------------------------------------------------- */
              <form onSubmit={handlePrimaryFormSubmit}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Sign in with Single Sign-On (SSO)
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.825rem' }}>
                    Enter your work email address. We'll automatically identify your organization's identity provider.
                  </Typography>
                </Box>

                <Box sx={{ mb: 2.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mb: 0.75,
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    Work Email
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    autoFocus
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={ssoLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Mail size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: 'hsl(var(--background))' },
                    }}
                  />
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={ssoLoading || !username.trim() || !isValidEmail(username)}
                  sx={{
                    bgcolor: '#2563eb',
                    '&:hover': { bgcolor: '#1d4ed8' },
                    color: '#fff',
                    py: 1,
                    fontWeight: 600,
                    textTransform: 'none',
                    mb: 2,
                  }}
                >
                  {ssoLoading ? (
                    <CircularProgress size={20} sx={{ color: '#fff' }} />
                  ) : (
                    'Continue with SSO'
                  )}
                </Button>

                <Box sx={{ textAlign: 'center' }}>
                  <Button
                    size="small"
                    onClick={() => {
                      setIsSsoDiscovery(false);
                      setSsoError('');
                    }}
                    sx={{
                      textTransform: 'none',
                      color: 'hsl(var(--muted-foreground))',
                      fontSize: '0.825rem',
                    }}
                  >
                    Sign in with password instead
                  </Button>
                </Box>
              </form>
            ) : (
              /* -------------------------------------------------------------- */
              /* STANDARD LOGIN / REGISTER FORM */
              /* -------------------------------------------------------------- */
              <form onSubmit={handlePrimaryFormSubmit}>
                {/* Username / Email field */}
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mb: 0.75,
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    {identifierLabel}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    autoFocus
                    autoComplete={serverMode === 'cloud' ? 'email' : 'username'}
                    type={serverMode === 'cloud' ? 'email' : 'text'}
                    placeholder={serverMode === 'cloud' ? 'name@company.com' : 'username or email'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    error={Boolean(cloudEmailInvalid)}
                    helperText={cloudEmailInvalid ? 'Please enter a valid work email address' : ''}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {serverMode === 'cloud' ? (
                            <Mail size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
                          ) : (
                            <User size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
                          )}
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: 'hsl(var(--background))' },
                    }}
                  />
                </Box>

                {/* Password field */}
                <Box sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
                    >
                      Password
                    </Typography>
                    {serverMode === 'cloud' && !isRegister && (
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => {
                          setIsResetPasswordMode(true);
                          setError('');
                        }}
                        sx={{
                          p: 0,
                          minWidth: 'auto',
                          textTransform: 'none',
                          fontSize: '0.75rem',
                          color: '#ff6600',
                          '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                        }}
                      >
                        Forgot password?
                      </Button>
                    )}
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{ color: 'hsl(var(--muted-foreground))' }}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: 'hsl(var(--background))' },
                    }}
                  />
                </Box>

                {/* Terms Acceptance (Register Mode Only) */}
                {isRegister && (
                  <Box sx={{ mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          sx={{ color: '#ff6600', '&.Mui-checked': { color: '#ff6600' } }}
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                          I agree to Shuffle's{' '}
                          <a
                            href="https://shuffler.io/docs/terms_of_service"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#ff6600', textDecoration: 'underline' }}
                          >
                            Terms of Service
                          </a>
                        </Typography>
                      }
                    />
                  </Box>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading || Boolean(cloudEmailInvalid)}
                  sx={{
                    bgcolor: '#ff6600',
                    '&:hover': { bgcolor: '#e65c00' },
                    color: '#fff',
                    py: 1.1,
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    mb: 2,
                    boxShadow: '0 4px 14px rgba(255, 102, 0, 0.3)',
                  }}
                >
                  {loading ? (
                    <CircularProgress size={20} sx={{ color: '#fff' }} />
                  ) : isRegister ? (
                    'Create Account'
                  ) : (
                    'Sign In'
                  )}
                </Button>

                {/* SSO Discovery Button for Cloud */}
                {serverMode === 'cloud' && !isRegister && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
                      <Box sx={{ flex: 1, height: '1px', bgcolor: 'hsl(var(--border))' }} />
                      <Typography variant="caption" sx={{ px: 1.5, color: 'hsl(var(--muted-foreground))' }}>
                        OR
                      </Typography>
                      <Box sx={{ flex: 1, height: '1px', bgcolor: 'hsl(var(--border))' }} />
                    </Box>

                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={() => setIsSsoDiscovery(true)}
                      startIcon={<ShieldCheck size={16} />}
                      sx={{
                        borderColor: 'hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        textTransform: 'none',
                        fontWeight: 600,
                        py: 0.9,
                        '&:hover': {
                          borderColor: 'hsl(var(--foreground))',
                          bgcolor: 'hsl(var(--muted) / 0.5)',
                        },
                      }}
                    >
                      Sign in with SSO
                    </Button>
                  </>
                )}

                {/* Mode Toggle (Sign In <-> Register) */}
                <Box sx={{ textAlign: 'center', mt: 2.5 }}>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => {
                        const nextMode = isRegister ? 'login' : 'register';
                        setAuthMode(nextMode);
                        setError('');
                      }}
                      sx={{
                        p: 0,
                        minWidth: 'auto',
                        textTransform: 'none',
                        fontWeight: 600,
                        color: '#ff6600',
                        fontSize: '0.8rem',
                        '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                      }}
                    >
                      {isRegister ? 'Sign in' : 'Create an account'}
                    </Button>
                  </Typography>
                </Box>
              </form>
            )}
          </Paper>
        </motion.div>
      </Box>
    </Box>
  );
};

export default LoginPage;
