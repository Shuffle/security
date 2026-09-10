import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Collapse,
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
  RefreshCw,
  HelpCircle,
  Database,
  ChevronDown,
  ChevronUp,
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
const isCapacitorNative = () => {
  if (typeof window === 'undefined') return false;
  const cap = (window as any)?.Capacitor;
  return Boolean(cap?.isNativePlatform && cap.isNativePlatform());
};
import { useAuth } from '@/context/AuthContext';

const SERVER_MODE_STORAGE_KEY = 'shuffle_selected_server_mode';
const CUSTOM_HOST_STORAGE_KEY = 'shuffle_custom_host_url';

export interface LoginPageProps {
  product?: 'security' | 'automation' | 'core';
  productName?: string;
  productSubtitle?: string;
  logo?: React.ReactNode;
  header?: React.ReactNode;
  mode?: 'login' | 'register' | 'adminsetup';
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

  // Detect explicit adminsetup route or query parameter
  const isExplicitAdminSetup = useMemo(() => {
    if (mode === 'adminsetup') return true;
    if (typeof window === 'undefined') return false;
    try {
      const sp = new URLSearchParams(window.location.search);
      return (
        sp.get('mode') === 'adminsetup' ||
        sp.get('setup') === 'admin' ||
        window.location.pathname === '/adminsetup'
      );
    } catch {
      return false;
    }
  }, [mode]);

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
    if (isExplicitAdminSetup) return 'self-hosted';
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

  // Backend readiness & database waiting state (on-prem / self-hosted)
  const [isWaitingForBackend, setIsWaitingForBackend] = useState(false);
  const [waitingErrorMessage, setWaitingErrorMessage] = useState('');
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Auth form states: 'login' | 'register' | 'adminsetup'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'adminsetup'>(() => {
    if (isExplicitAdminSetup) return 'adminsetup';
    return mode;
  });
  const isRegister = authMode === 'register';
  const isAdminSetup = authMode === 'adminsetup';

  useEffect(() => {
    if (mode === 'adminsetup' || isExplicitAdminSetup) {
      setAuthMode('adminsetup');
      setServerMode('self-hosted');
    } else {
      setAuthMode(mode);
    }
  }, [mode, isExplicitAdminSetup]);

  // SSO Login state (Cloud mode: work email only, hides password field)
  const [loginWithSSO, setLoginWithSSO] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('sso') === 'true';
    } catch {
      return false;
    }
  });
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState('');

  // Password reset mode (Cloud only)
  const [isResetPasswordMode, setIsResetPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmailSuccessMsg, setResetEmailSuccessMsg] = useState('');

  // Credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [adminSetupSuccess, setAdminSetupSuccess] = useState(false);

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
    setLoginWithSSO(false);
    setIsWaitingForBackend(false);
    setWaitingErrorMessage('');
    setHostPingStatus('idle');
    setHostPingMessage('');
    setInstanceSsoUrl(null);

    if (newMode === 'self-hosted') {
      setIsResetPasswordMode(false);
      setResetEmailSent(false);
    } else {
      if (authMode === 'adminsetup') {
        setAuthMode('login');
      }
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
  // Check Backend Status & Database Readiness (On-Prem / Self-Hosted)
  // ---------------------------------------------------------------------------
  const checkBackendStatus = useCallback(
    async (showLoadingIndicator = true, hostOverride?: string) => {
      if (showLoadingIndicator) {
        setIsPingingHost(true);
      }

      const rawTarget =
        hostOverride !== undefined
          ? hostOverride
          : (customHostUrl.trim() || getHostBaseUrl() || '');
      const targetHost = rawTarget.trim().replace(/\/+$/, '');

      // In browser, if on self-hosted and no host entered, probe current origin
      const probeBase =
        targetHost || (typeof window !== 'undefined' ? window.location.origin : '');
      const checkUrl = `${probeBase}/api/v1/checkusers`;

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(checkUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (data.sso_url && typeof data.sso_url === 'string') {
          setInstanceSsoUrl(data.sso_url);
        }

        // Database not ready / connection refused by backend
        if (data.success === false) {
          const reason = (data.reason || '').toLowerCase();
          if (
            reason.includes('connection refused') ||
            reason.includes('database') ||
            reason.includes('waiting') ||
            reason.includes('error in userdata')
          ) {
            setIsWaitingForBackend(true);
            setWaitingErrorMessage(data.reason || 'Backend database initializing');
            setHostPingStatus('error');
            setHostPingMessage(data.reason || 'Waiting for database to become available...');
            return;
          }
        }

        // Backend is reachable and responsive!
        setIsWaitingForBackend(false);
        setWaitingErrorMessage('');

        if (data.reason === 'stay') {
          // 0 users exist! Self-hosted administrator setup required!
          setAuthMode('adminsetup');
          setHostPingStatus('needs-admin');
          setHostPingMessage('Connected to server. No users configured — administrator setup required.');
        } else if (data.reason === 'redirect' || data.success === true) {
          // Administrator/users already configured
          if (authMode === 'adminsetup') {
            setAuthMode('login');
            setNotice('Administrator account is already configured. Please sign in.');
          }
          setHostPingStatus('success');
          setHostPingMessage('Connected to Shuffle server successfully!');
        }
      } catch (err: any) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        const msg = isAbort
          ? 'Connection timed out while contacting server'
          : err?.message || 'Connection refused or server unreachable';

        // When testing an explicitly self-hosted instance or in adminsetup, enter waiting/retry state
        setIsWaitingForBackend(true);
        setWaitingErrorMessage(msg);
        setHostPingStatus('error');
        setHostPingMessage(msg);
      } finally {
        window.clearTimeout(timeoutId);
        if (showLoadingIndicator) {
          setIsPingingHost(false);
        }
      }
    },
    [customHostUrl, authMode]
  );

  // Automatic Polling (every 3000ms) while waiting for on-prem backend/database
  useEffect(() => {
    if (!isWaitingForBackend || serverMode !== 'self-hosted') return undefined;

    const intervalId = window.setInterval(() => {
      checkBackendStatus(false);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isWaitingForBackend, serverMode, checkBackendStatus]);

  // Initial check on mount for self-hosted or adminsetup mode
  const initialCheckRanRef = useRef(false);
  useEffect(() => {
    if (initialCheckRanRef.current) return;
    if (serverMode === 'self-hosted' || isExplicitAdminSetup) {
      initialCheckRanRef.current = true;
      checkBackendStatus(true);
    }
  }, [serverMode, isExplicitAdminSetup, checkBackendStatus]);

  // ---------------------------------------------------------------------------
  // Ping Server URL explicitly from input button
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

    if (isShuffleCloudDomain(urlToTest)) {
      setCustomHostUrl('');
      setHostPingStatus('idle');
      setHostPingMessage('');
      handleServerModeChange('cloud');
      setNotice('Switched to Shuffle Cloud login');
      return;
    }

    setHostBaseUrl(urlToTest);
    setMcpHostBaseUrl(urlToTest);
    try {
      localStorage.setItem(CUSTOM_HOST_STORAGE_KEY, urlToTest);
    } catch {}

    await checkBackendStatus(true, urlToTest);
  };

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
  // Admin Setup Submit Handler (Single-Page Mode)
  // ---------------------------------------------------------------------------
  const handleAdminSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setError('Please enter a username or email for the administrator.');
      return;
    }
    if (trimmedUser.length < 2) {
      setError('Administrator username must be at least 2 characters.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const targetHost = (customHostUrl.trim() || getHostBaseUrl() || '').replace(/\/+$/, '');
      const probeBase =
        targetHost || (typeof window !== 'undefined' ? window.location.origin : '');
      const registerUrl = `${probeBase}/api/v1/register`;

      const res = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: trimmedUser,
          password: password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.success === false || (!res.ok && res.status !== 200 && res.status !== 201)) {
        setError(
          data.reason ||
            data.message ||
            `Failed to create administrator account (status ${res.status}).`
        );
        setLoading(false);
        return;
      }

      setAdminSetupSuccess(true);
      setNotice('Administrator account created successfully! Signing you in...');

      // Auto-login with the newly created credentials
      try {
        const loginUrl = `${probeBase}/api/v1/login`;
        const loginRes = await fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            username: trimmedUser,
            password: password,
          }),
        });

        const loginData = await loginRes.json().catch(() => ({}));

        if (loginData.success !== false) {
          if (login) {
            await login(
              loginData?.jwt || loginData?.token || 'session',
              loginData?.user || { username: trimmedUser }
            );
          }
          if (onLoginSuccess) {
            await onLoginSuccess(loginData?.jwt || loginData?.token || 'session', loginData?.user);
          }
          goToRedirectTarget(from || defaultDestination);
          return;
        }
      } catch {
        // Fallback: transition to login form
      }

      // If auto-login didn't redirect, transition to standard login
      window.setTimeout(() => {
        setAuthMode('login');
        setAdminSetupSuccess(false);
        setNotice('Administrator created! Please sign in with your credentials.');
        setLoading(false);
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Network error while creating administrator account.');
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Validation & Formatting
  // ---------------------------------------------------------------------------
  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

  const identifierLabel =
    serverMode === 'cloud'
      ? loginWithSSO
        ? 'Work Email (SSO)'
        : 'Work Email'
      : 'Username or Email';

  const cloudEmailInvalid =
    serverMode === 'cloud' && username.trim().length > 0 && !isValidEmail(username);

  // Auto-login for onprem instance SSO if ?autologin=true (matches classic Shuffle)
  useEffect(() => {
    if (serverMode !== 'self-hosted' || !instanceSsoUrl) return;
    try {
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      if (sp.get('autologin') === 'true') {
        if (typeof window !== 'undefined') {
          if (from) {
            sessionStorage.setItem('shuffle_redirect_after_login', from);
          }
          window.location.href = instanceSsoUrl;
        }
      }
    } catch {}
  }, [serverMode, instanceSsoUrl, from]);

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
        response.status === 402;

      if (isMfaRedirect) {
        setMfaRequired(true);
        setNotice('Two-factor authentication code required. Please enter the code from your authenticator app.');
        return;
      }

      // Failure handling
      if (!response.ok || data.success === false) {
        setError(
          data.reason ||
            data.message ||
            (isRegister
              ? 'Registration failed. The username or email may already be in use.'
              : 'Invalid credentials. Please check your username and password.')
        );
        return;
      }

      // Edgecase 4: Multi-region routing via region_url
      if (data.region_url && typeof data.region_url === 'string') {
        try {
          setRegionUrl(data.region_url, data.org_id);
          if (typeof window !== 'undefined') {
            localStorage.setItem('globalUrl', data.region_url);
          }
        } catch {}
      }

      // Edgecase 5: Session cookie verification vs Bearer token fallback
      const token =
        data.jwt ||
        data.token ||
        data.session_id ||
        (typeof document !== 'undefined' && document.cookie.includes('session') ? 'cookie-session' : 'authenticated');

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('shuffle_has_logged_in', 'true');
        } catch {}
      }

      if (login) {
        await login(token, data.user || data);
      }
      if (onLoginSuccess) {
        await onLoginSuccess(token, data.user || data);
      }

      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('shuffle_redirect_after_login');
        } catch {}
      }

      goToRedirectTarget(from || defaultDestination);
    } catch (err: any) {
      setError(err?.message || 'A network error occurred during sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Cloud Password Reset Mailer
  // ---------------------------------------------------------------------------
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !isValidEmail(username)) {
      setError('Please enter a valid work email address.');
      return;
    }

    setLoading(true);

    try {
      const resetUrl = getApiUrl(API_ENDPOINTS.passwordResetMail);
      const res = await fetch(resetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: username.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setError(data.reason || data.message || 'Unable to send password reset email. Please try again.');
        return;
      }

      setResetEmailSent(true);
      setResetEmailSuccessMsg(
        `If an account exists for ${username.trim()}, a password reset link has been sent to your email.`
      );
    } catch (err: any) {
      setError(err?.message || 'Network error while requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdminSetup) {
      handleAdminSetupSubmit(e);
    } else if (isResetPasswordMode) {
      handlePasswordResetSubmit(e);
    } else if (serverMode === 'cloud' && loginWithSSO) {
      handleSsoDiscoverySubmit(e);
    } else {
      performLogin();
    }
  };

  const handleMfaChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setMfaCode(cleaned);
    if (cleaned.length === 6) {
      performLogin(cleaned);
    }
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
              {isAdminSetup
                ? 'Initialize Administrator Account'
                : effectiveSubtitle}
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
            {allowSelfHosted && !mfaRequired && !isResetPasswordMode && !isAdminSetup && (
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
            {/* "WAITING FOR BACKEND / DATABASE" STATE (ON-PREM SELF-HOSTED)    */}
            {/* ---------------------------------------------------------------- */}
            {isWaitingForBackend ? (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: '50%',
                    bgcolor: 'hsl(var(--muted))',
                    mb: 2,
                    color: '#ff6600',
                  }}
                >
                  <Database size={32} />
                </Box>

                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: 'hsl(var(--foreground))' }}>
                  Waiting for Shuffle Database
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: '0.825rem',
                    lineHeight: 1.5,
                    mb: 2.5,
                    px: 1,
                  }}
                >
                  Waiting for the Shuffle backend and database to become available. This may take up to two minutes on first startup while migrations run.
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <CircularProgress size={32} sx={{ color: '#ff6600' }} />
                </Box>

                {waitingErrorMessage && (
                  <Box
                    sx={{
                      p: 1.25,
                      mb: 2.5,
                      borderRadius: 1.5,
                      bgcolor: 'hsl(var(--muted) / 0.5)',
                      border: '1px solid hsl(var(--border))',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: 'hsl(var(--muted-foreground))',
                      wordBreak: 'break-all',
                    }}
                  >
                    Backend response: {waitingErrorMessage}
                  </Box>
                )}

                {/* Troubleshooting instructions box (Classic Shuffle on-prem guide) */}
                <Box
                  sx={{
                    textAlign: 'left',
                    p: 2,
                    mb: 2.5,
                    borderRadius: 2,
                    bgcolor: 'hsl(var(--muted) / 0.4)',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                    onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HelpCircle size={16} style={{ color: '#ff6600' }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                        Is Shuffle installed correctly?
                      </Typography>
                    </Box>
                    <IconButton size="small" sx={{ p: 0.5 }}>
                      {showTroubleshooting ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                  </Box>

                  <Collapse in={showTroubleshooting}>
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed hsl(var(--border))' }}>
                      <Typography variant="caption" sx={{ display: 'block', color: 'hsl(var(--muted-foreground))', mb: 1 }}>
                        <b>1.</b> Make sure the database directory has permissions and you have at least <b>4GB RAM</b>:
                      </Typography>
                      <Box
                        sx={{
                          p: 1,
                          mb: 1.5,
                          borderRadius: 1,
                          bgcolor: 'hsl(var(--background))',
                          fontFamily: 'monospace',
                          fontSize: '0.725rem',
                          color: '#ff6600',
                          userSelect: 'all',
                        }}
                      >
                        sudo chown -R 1000:1000 shuffle-database
                      </Box>

                      <Typography variant="caption" sx={{ display: 'block', color: 'hsl(var(--muted-foreground))', mb: 1 }}>
                        <b>2.</b> Check that Docker services are running:
                      </Typography>
                      <Box
                        sx={{
                          p: 1,
                          mb: 1.5,
                          borderRadius: 1,
                          bgcolor: 'hsl(var(--background))',
                          fontFamily: 'monospace',
                          fontSize: '0.725rem',
                          color: '#ff6600',
                          userSelect: 'all',
                        }}
                      >
                        docker compose ps
                      </Box>
                    </Box>
                  </Collapse>
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    onClick={() => checkBackendStatus(true)}
                    disabled={isPingingHost}
                    startIcon={<RefreshCw size={15} />}
                    sx={{
                      bgcolor: '#ff6600',
                      '&:hover': { bgcolor: '#e65c00' },
                      color: '#fff',
                      py: 0.9,
                      fontWeight: 600,
                      textTransform: 'none',
                    }}
                  >
                    {isPingingHost ? 'Checking...' : 'Check Connection Again'}
                  </Button>

                  <Button
                    fullWidth
                    variant="text"
                    size="small"
                    onClick={() => {
                      setIsWaitingForBackend(false);
                      setWaitingErrorMessage('');
                    }}
                    sx={{
                      textTransform: 'none',
                      color: 'hsl(var(--muted-foreground))',
                      fontSize: '0.8rem',
                    }}
                  >
                    Change Server URL or Mode
                  </Button>
                </Box>
              </Box>
            ) : serverMode === 'self-hosted' && !isAdminSetup && !mfaRequired ? (
              /* ---------------------------------------------------------------- */
              /* SELF-HOSTED SERVER CONFIGURATION BAR                             */
              /* ---------------------------------------------------------------- */
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
                            onClick={() => setAuthMode('adminsetup')}
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
                  <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed hsl(var(--border))' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle2 size={14} />
                      Single Sign-On is enabled on this instance
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : null}

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
            ) : isAdminSetup ? (
              /* -------------------------------------------------------------- */
              /* ADMINISTRATOR SETUP FORM (SINGLE-PAGE RELEVANT FIELDS)         */
              /* -------------------------------------------------------------- */
              <form onSubmit={handlePrimaryFormSubmit}>
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: 'hsl(var(--foreground))' }}>
                    Create Administrator Account
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.825rem' }}>
                    Initialize the root administrator credentials for this self-hosted Shuffle server.
                  </Typography>
                </Box>

                {/* Administrator Username / Email */}
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mb: 0.75, fontWeight: 600, color: 'hsl(var(--foreground))' }}
                  >
                    Administrator Username or Email
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    autoFocus
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading || adminSetupSuccess}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <User size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: 'hsl(var(--background))' },
                    }}
                  />
                </Box>

                {/* Administrator Password */}
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mb: 0.75, fontWeight: 600, color: 'hsl(var(--foreground))' }}
                  >
                    Password
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || adminSetupSuccess}
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

                {/* Confirm Password */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mb: 0.75, fontWeight: 600, color: 'hsl(var(--foreground))' }}
                  >
                    Confirm Password
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading || adminSetupSuccess}
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
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                            sx={{ color: 'hsl(var(--muted-foreground))' }}
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: 'hsl(var(--background))' },
                    }}
                  />
                </Box>

                {/* Submit button */}
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading || adminSetupSuccess || !username.trim() || !password}
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
                  ) : (
                    'Create Administrator Account'
                  )}
                </Button>

                {/* Back to sign in link */}
                <Box sx={{ textAlign: 'center' }}>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      setAuthMode('login');
                      setError('');
                    }}
                    startIcon={<ArrowLeft size={14} />}
                    sx={{
                      p: 0,
                      minWidth: 'auto',
                      textTransform: 'none',
                      fontWeight: 600,
                      color: 'hsl(var(--muted-foreground))',
                      fontSize: '0.8rem',
                      '&:hover': { color: 'hsl(var(--foreground))' },
                    }}
                  >
                    Back to regular sign in
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

                {/* Password field: hidden in Cloud SSO mode */}
                {!(serverMode === 'cloud' && loginWithSSO) && (
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
                )}

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
                  disabled={
                    serverMode === 'cloud' && loginWithSSO
                      ? ssoLoading || !username.trim() || !isValidEmail(username)
                      : loading || Boolean(cloudEmailInvalid)
                  }
                  sx={{
                    bgcolor: '#ff6600',
                    '&:hover': { bgcolor: '#e65c00' },
                    color: '#fff',
                    py: 1.1,
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    mb: serverMode === 'cloud' && loginWithSSO ? 1.5 : 2,
                    boxShadow: '0 4px 14px rgba(255, 102, 0, 0.3)',
                  }}
                >
                  {ssoLoading || loading ? (
                    <CircularProgress size={20} sx={{ color: '#fff' }} />
                  ) : serverMode === 'cloud' && loginWithSSO ? (
                    'Continue with SSO'
                  ) : isRegister ? (
                    'Create Account'
                  ) : (
                    'Sign In'
                  )}
                </Button>

                {/* Back to password sign-in for Cloud SSO */}
                {serverMode === 'cloud' && loginWithSSO && (
                  <Box sx={{ textAlign: 'center', mb: 1 }}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => {
                        setLoginWithSSO(false);
                        setSsoError('');
                        setError('');
                      }}
                      sx={{
                        textTransform: 'none',
                        color: 'hsl(var(--muted-foreground))',
                        fontSize: '0.8rem',
                        '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'transparent', textDecoration: 'underline' },
                      }}
                    >
                      Sign in with password instead
                    </Button>
                  </Box>
                )}

                {/* SSO Button for Cloud: switches to passwordless work email SSO flow */}
                {serverMode === 'cloud' && !isRegister && !loginWithSSO && (
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
                      id="sso_button"
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setLoginWithSSO(true);
                        setPassword('');
                        setError('');
                        setSsoError('');
                      }}
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
                      Use SSO
                    </Button>
                  </>
                )}

                {/* SSO Button for On-Prem / Self-Hosted: exact logic from Classic Shuffle */}
                {serverMode === 'self-hosted' && !isRegister && Boolean(instanceSsoUrl) && (
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
                      id="sso_button"
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          if (from) sessionStorage.setItem('shuffle_redirect_after_login', from);
                          window.location.href = instanceSsoUrl!;
                        }
                      }}
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
                      Use SSO
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
