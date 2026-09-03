import { SegmentedControl } from '@/components/ui/segmented-control';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider,
} from '@mui/material';
import {
  Eye as VisibilityIcon,
  EyeOff as VisibilityOffIcon,
  Server as ServerIcon,
  Cloud as CloudIcon,
  CheckCircle2 as CheckCircleIcon,
  AlertCircle as AlertCircleIcon,
  ShieldCheck as ShieldCheckIcon,
  ArrowLeft as ArrowLeftIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Link } from '@/lib/router-compat';
import { useAuth } from '@/context/AuthContext';
import { setHostBaseUrl, getHostBaseUrl, isDevEnvironment, getApiUrl, API_ENDPOINTS } from '@/Shuffle-MCPs/api';
import { setHostBaseUrl as setCoreHostBaseUrl } from '@/Shuffle-Core/api';
import { ShuffleCompanyLogo } from '@/components/common/ShuffleLogo';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { isCapacitorNative } from '@/lib/platform';
import { sanitizeInternalDestination } from '@/lib/safeRedirect';

const CUSTOM_HOST_STORAGE_KEY = 'shuffle_custom_host_url';
const SERVER_MODE_STORAGE_KEY = 'shuffle_selected_server_mode';

export const MobileAuthGateway = ({ mode = 'login' }: { mode?: 'login' | 'register' } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
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
  const defaultDestination = isMobile
    ? '/incidents'
    : hasLoggedInBefore
    ? '/dashboard'
    : '/onboarding';

  // Return URL resolution: robust across query parameters, router location state, and session storage
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

  // Redirect if already authenticated
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (hasRedirectedRef.current) return;
    const target = (from || '/dashboard').split('?')[0];
    if (target === location.pathname) return;
    hasRedirectedRef.current = true;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('shuffle_redirect_after_login');
      } catch {}
    }
    navigate(from, { replace: true });
  }, [isAuthenticated, authLoading, navigate, from, location.pathname]);

  // Server instance selection: 'cloud' | 'self-hosted'
  // SSR-safe defaults; real values hydrate in an effect below.
  const [serverMode, setServerMode] = useState<'cloud' | 'self-hosted'>('cloud');
  const [customHostUrl, setCustomHostUrl] = useState('');

  useEffect(() => {
    try {
      const storedMode = localStorage.getItem(SERVER_MODE_STORAGE_KEY) as 'cloud' | 'self-hosted' | null;
      if (storedMode === 'self-hosted' || storedMode === 'cloud') setServerMode(storedMode);
      const storedHost = localStorage.getItem(CUSTOM_HOST_STORAGE_KEY);
      if (storedHost) setCustomHostUrl(storedHost);
    } catch {
      // ignore
    }
  }, []);


  const [isPingingHost, setIsPingingHost] = useState(false);
  const [hostPingStatus, setHostPingStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hostPingMessage, setHostPingMessage] = useState('');

  // Login vs registration. Initialized from the route, toggleable in-page so
  // the selected server (cloud / self-hosted) carries over between the two.
  const [authMode, setAuthMode] = useState<'login' | 'register'>(mode);
  const isRegister = authMode === 'register';

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isResetPasswordMode, setIsResetPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmailSuccessMsg, setResetEmailSuccessMsg] = useState('');

  // Ensure host URL is synchronized in API config whenever serverMode or customHostUrl changes
  useEffect(() => {
    if (!hydrated) return;
    if (serverMode === 'self-hosted' && customHostUrl.trim()) {
      let normalized = customHostUrl.trim().replace(/\/+$/, '');
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = 'https://' + normalized;
      }
      setHostBaseUrl(normalized);
      setCoreHostBaseUrl(normalized);
    } else if (serverMode === 'cloud') {
      setHostBaseUrl(null);
      setCoreHostBaseUrl(null);
    }
  }, [hydrated, serverMode, customHostUrl]);

  // Handle server mode change
  const handleServerModeChange = (mode: 'cloud' | 'self-hosted') => {
    setServerMode(mode);
    setError('');
    setMfaRequired(false);
    setMfaCode('');
    setHostPingStatus('idle');
    if (mode === 'self-hosted') {
      setIsResetPasswordMode(false);
      setResetEmailSent(false);
    }
    try {
      localStorage.setItem(SERVER_MODE_STORAGE_KEY, mode);
      if (mode === 'cloud') {
        setHostBaseUrl(null);
        setCoreHostBaseUrl(null);
        localStorage.removeItem(CUSTOM_HOST_STORAGE_KEY);
      } else if (customHostUrl.trim()) {
        let normalized = customHostUrl.trim().replace(/\/+$/, '');
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
          normalized = 'https://' + normalized;
        }
        setHostBaseUrl(normalized);
        setCoreHostBaseUrl(normalized);
        localStorage.setItem(CUSTOM_HOST_STORAGE_KEY, normalized);
      }
    } catch {
      // localStorage error fallback
    }
  };

  // Test custom host connectivity
  const handlePingHost = async () => {
    if (!customHostUrl.trim()) {
      setHostPingStatus('error');
      setHostPingMessage('Please enter a server URL (e.g. https://shuffle.example.com:3443)');
      return;
    }

    let urlToTest = customHostUrl.trim().replace(/\/+$/, '');
    if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
      urlToTest = 'https://' + urlToTest;
      setCustomHostUrl(urlToTest);
    }

    // shuffler.io hosts are Shuffle Cloud - switch back to cloud rules
    let testHostname = '';
    try {
      testHostname = new URL(urlToTest).hostname.toLowerCase();
    } catch {
      testHostname = '';
    }
    if (testHostname === 'shuffler.io' || testHostname.endsWith('.shuffler.io')) {
      setCustomHostUrl('');
      setHostPingStatus('idle');
      setHostPingMessage('');
      handleServerModeChange('cloud');
      return;
    }

    setIsPingingHost(true);
    setHostPingStatus('idle');
    setHostPingMessage('');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    try {
      setHostBaseUrl(urlToTest);
      setCoreHostBaseUrl(urlToTest);
      localStorage.setItem(CUSTOM_HOST_STORAGE_KEY, urlToTest);

      const res = await fetch(`${urlToTest}/api/v1/getinfo`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (res.ok || res.status === 401 || res.status === 403) {
        setHostPingStatus('success');
        setHostPingMessage('Connected to Shuffle server successfully!');
      } else {
        setHostPingStatus('error');
        setHostPingMessage(`Server responded with status ${res.status}`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setHostPingStatus('error');
        setHostPingMessage('Connection test timed out after 5 seconds. Check the URL or network path.');
      } else {
        setHostPingStatus('error');
        setHostPingMessage('Unable to reach server. Check URL, HTTPS certificates, or firewall.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsPingingHost(false);
    }
  };

  // Cloud requires a valid email address; self-hosted allows username or email
  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  const identifierLabel =
    serverMode === 'cloud' ? 'Email' : 'Username or Email';
  const cloudEmailInvalid =
    serverMode === 'cloud' && username.trim().length > 0 && !isValidEmail(username);

  // Reason the Sign In button is blocked (empty string = not blocked)
  const signInBlockedReason = (() => {
    if (isResetPasswordMode) return '';
    if (serverMode === 'self-hosted' && hostPingStatus !== 'success') {
      if (!customHostUrl.trim())
        return 'Enter your self-hosted Shuffle server URL and test the connection before signing in.';
      if (hostPingStatus === 'error')
        return 'The connection test failed. Fix the URL and test again before signing in.';
      return 'Test the server connection before signing in.';
    }
    if (!username.trim())
      return serverMode === 'cloud'
        ? 'Enter your email address.'
        : 'Enter your username or email address.';
    if (serverMode === 'cloud' && !isValidEmail(username))
      return 'Enter a valid email address. Shuffle Cloud requires an email, not a username.';
    if (!password) return 'Enter your password.';
    if (isRegister && password.length < 10)
      return 'Choose a password with at least 10 characters.';
    return '';
  })();



  // Auto-focus MFA input whenever MFA becomes required
  useEffect(() => {
    if (!mfaRequired) return undefined;
    const timer = setTimeout(() => {
      mfaInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [mfaRequired]);

  // Handle credential login and MFA verification
  const performLogin = async (codeToUse?: string) => {
    setError('');
    const code = codeToUse !== undefined ? codeToUse : mfaCode;

    if (!mfaRequired) {
      if (!username.trim()) {
        setError(
          serverMode === 'cloud'
            ? 'Please enter your email address.'
            : 'Please enter your username or email address.'
        );
        return;
      }
      if (serverMode === 'cloud' && !isValidEmail(username)) {
        setError('Please enter a valid email address. Shuffle Cloud requires an email address.');
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

      setHostBaseUrl(normalized);
      setCoreHostBaseUrl(normalized);
      localStorage.setItem(SERVER_MODE_STORAGE_KEY, 'self-hosted');
      localStorage.setItem(CUSTOM_HOST_STORAGE_KEY, normalized);
    } else {
      setHostBaseUrl(null);
      setCoreHostBaseUrl(null);
      localStorage.setItem(SERVER_MODE_STORAGE_KEY, 'cloud');
      localStorage.removeItem(CUSTOM_HOST_STORAGE_KEY);
    }

    setLoading(true);

    try {
      const body: Record<string, string> = { username, password };
      if ((mfaRequired || code) && code) {
        body.mfa_code = code;
      }

      const loginUrl = getApiUrl(API_ENDPOINTS.login);
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

      // 1. Check for SSO redirect requirement from Shuffle backend (follow URL to external website)
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
        setError('Single Sign-On (SSO) is required, but no redirect URL was provided by the server.');
        return;
      }

      // 2. Check for MFA setup requirement from Shuffle backend (/login/{url}/mfa-setup)
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

      // 3. Check for standard MFA code prompt (MFA_REDIRECT / already set up)
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

      if (!response.ok) {
        setError(data.reason || data.message || (mfaRequired ? 'Invalid MFA code' : 'Invalid username or password'));
        return;
      }

      // Extract session token from direct field or cookies array
      const sessionToken =
        data.session_token ||
        data.cookies?.find((c: { key: string; value: string }) => c.key === 'session_token')?.value;

      if (data.success !== false) {
        // Validate the session with getinfo BEFORE treating the user as logged in,
        // otherwise we land in a "fake" authenticated UI when the cookie/token
        // was not actually accepted by the backend.
        let verified = false;
        let verifiedWithToken = false;
        let verifyData: any = null;
        try {
          // A custom/self-hosted backend (or a native app) cannot rely on the
          // session cookie — the returned session token is the bearer there.
          const preferBearer = isCapacitorNative() || isDevEnvironment() || !!getHostBaseUrl();

          const verifyWithToken = async () => {
            const res = await fetch(getApiUrl('/api/v1/getinfo'), {
              method: 'GET',
              credentials: 'omit',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionToken}`,
              },
            });
            verifyData = await res.json().catch(() => ({} as any));
            return res.ok && verifyData?.success === true;
          };

          const verifyWithCookie = async () => {
            const res = await fetch(getApiUrl('/api/v1/getinfo'), {
              method: 'GET',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            });
            verifyData = await res.json().catch(() => ({} as any));
            return res.ok && verifyData?.success === true;
          };

          if (preferBearer && sessionToken) {
            verified = await verifyWithToken();
            verifiedWithToken = verified;
            if (!verified) verified = await verifyWithCookie();
          } else {
            verified = await verifyWithCookie();
            if (!verified && sessionToken) {
              verified = await verifyWithToken();
              verifiedWithToken = verified;
            }
          }


          if (verified) {
            const accepted = await login(verifiedWithToken ? sessionToken || '' : '', verifyData);
            verified = accepted;
          }
        } catch {
          verified = false;
        }

        if (!verified) {
          setError('Login succeeded but the session could not be verified. Please try again.');
          return;
        }

        localStorage.setItem('shuffle_has_logged_in', 'true');
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('shuffle_redirect_after_login');
          } catch {}
        }
        navigate(from, { replace: true });
      } else {
        setError(data.reason || data.message || 'Login failed. Please verify credentials.');
      }
    } catch (err: any) {
      if (err?.name === 'TypeError' || err?.message?.includes('fetch')) {
        const targetHost = serverMode === 'self-hosted' ? customHostUrl : 'Shuffle Cloud';
        setError(`Unable to reach server (${targetHost}). Please verify the URL, network connection, or SSL certificate.`);
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

  const handleResetPasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username or email address.');
      return;
    }

    setLoading(true);
    setError('');
    setResetEmailSent(false);

    try {
      const res = await fetch(getApiUrl('/api/v1/users/passwordresetmail'), {
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
        throw new Error(data.reason || data.message || `Password reset request failed (status: ${res.status})`);
      }

      setResetEmailSent(true);
      setResetEmailSuccessMsg(
        data.reason ||
          `If an account exists for "${username.trim()}", a password reset link has been sent to your email.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error requesting password reset.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isResetPasswordMode) {
      handleResetPasswordSubmit(e);
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

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'hsl(var(--background))', position: 'relative' }}>
      {!isCapacitorNative() && (
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LandingNavbar />
        </Box>
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
            xs: 'max(5.5rem, calc(2.75rem + env(safe-area-inset-top, 52px)))',
            sm: 5,
            md: 'max(7rem, 96px)',
          },
          pb: {
            xs: 'max(2.5rem, calc(2rem + env(safe-area-inset-bottom, 24px)))',
            sm: 4,
            md: 6,
          },
          pl: 'max(1.25rem, calc(1rem + env(safe-area-inset-left, 0px)))',
          pr: 'max(1.25rem, calc(1rem + env(safe-area-inset-right, 0px)))',
        }}
      >
        <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: 'min(440px, 100%)', boxSizing: 'border-box' }}
      >
        {/* Brand Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 3.5 }, mt: { xs: 1, sm: 0 } }}>
          <Box
            sx={{
              display: 'inline-flex',
              p: 0.5,
              borderRadius: 3,
              mb: 1.5,
              boxShadow: '0 8px 24px rgba(255, 102, 0, 0.2)',
            }}
          >
            <ShuffleCompanyLogo size={56} />
          </Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: 'hsl(var(--foreground))',
              fontSize: { xs: '1.4rem', sm: '1.5rem' },
            }}
          >
            Shuffle Security
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.825rem',
              mt: 0.5,
            }}
          >
            <a
              href="https://github.com/shuffle/security"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Open Source
            </a>{' '}
            Incident Response & Automation
          </Typography>
        </Box>

        {/* Server Instance Switcher - above the auth card */}
        {!mfaRequired && !isResetPasswordMode && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
            <SegmentedControl
              value={serverMode}
              onChange={handleServerModeChange}
              size="md"
              variant="outline"
              ariaLabel="Server instance"
              options={[
                {
                  value: 'cloud',
                  label: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CloudIcon size={14} />
                      Shuffle Cloud
                    </span>
                  ),
                },
                {
                  value: 'self-hosted',
                  label: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <ServerIcon size={14} />
                      Self-Hosted
                    </span>
                  ),
                },
              ]}
            />
          </Box>
        )}

        {/* Main Authentication Card */}
        <Card
          sx={{
            bgcolor: 'transparent',
            backgroundImage: 'none',
            borderRadius: 3,
            border: '1px solid hsl(var(--border))',
            boxShadow: 'none',
            overflow: 'hidden',
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>


            {/* Self-Hosted Server URL Configuration */}
            <AnimatePresence>
              {!mfaRequired && serverMode === 'self-hosted' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Box sx={{ mb: 2.5 }}>
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'hsl(var(--muted-foreground))',
                        mb: 0.75,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Instance URL
                    </Typography>
                    <TextField
                      placeholder="https://shuffle.myorg.internal:3443"
                      value={customHostUrl}
                      onChange={(e) => {
                        setCustomHostUrl(e.target.value);
                        setHostPingStatus('idle');
                      }}
                      size="small"
                      fullWidth
                      autoCapitalize="none"
                      autoCorrect="off"
                      InputProps={{
                        sx: {
                          bgcolor: 'hsl(var(--card))',
                          color: 'hsl(var(--foreground))',
                          borderRadius: 2,
                          fontSize: '0.85rem',
                          pr: 0.75,
                          '& input': {
                            color: 'hsl(var(--foreground))',
                            py: 1,
                          },
                          '& fieldset': { borderColor: 'hsl(var(--border))' },
                          '&:hover fieldset': { borderColor: '#FF6600' },
                          '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                        },
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button
                              onClick={handlePingHost}
                              variant="contained"
                              disabled={isPingingHost}
                              size="small"
                              sx={{
                                minWidth: 64,
                                height: 28,
                                px: 1.5,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                borderRadius: 1.5,
                                bgcolor: hostPingStatus === 'success' ? '#22c55e' : '#FF6600',
                                color: '#FFFFFF',
                                border: '1px solid hsl(var(--border))',
                                boxShadow: 'none',
                                '&:hover': {
                                  bgcolor: hostPingStatus === 'success' ? '#16a34a' : '#e65c00',
                                  boxShadow: 'none',
                                },
                                '&.Mui-disabled': {
                                  bgcolor: 'hsl(var(--muted) / 0.4)',
                                  color: 'hsl(var(--muted-foreground) / 0.5)',
                                  borderColor: 'transparent',
                                },
                              }}
                            >
                              {isPingingHost ? (
                                <CircularProgress size={14} sx={{ color: 'inherit' }} />
                              ) : hostPingStatus === 'success' ? (
                                'Connected'
                              ) : (
                                'Test'
                              )}
                            </Button>
                          </InputAdornment>
                        ),
                      }}
                    />
                    {hostPingMessage && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
                        {hostPingStatus === 'success' ? (
                          <CheckCircleIcon size={14} color="#22c55e" />
                        ) : (
                          <AlertCircleIcon size={14} color="#ef4444" />
                        )}
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: hostPingStatus === 'success' ? '#22c55e' : '#ef4444',
                          }}
                        >
                          {hostPingMessage}
                        </Typography>
                      </Box>
                    )}
                    {!hostPingMessage && serverMode === 'self-hosted' && hostPingStatus !== 'success' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
                        <AlertCircleIcon size={14} color="#FF6600" />
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: 'hsl(var(--muted-foreground))',
                          }}
                        >
                          {customHostUrl.trim()
                            ? 'Click Test to verify the server and enable Sign In.'
                            : 'Enter your server URL, then click Test to enable Sign In.'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <Alert
                severity="error"
                onClose={() => setError('')}
                sx={{
                  mb: 2.5,
                  borderRadius: 2,
                  fontSize: '0.8rem',
                  py: 0.5,
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  '& .MuiAlert-icon': { color: '#ef4444' },
                }}
              >
                {error}
              </Alert>
            )}

            {/* Form */}
            <Box component="form" onSubmit={handleLoginSubmit}>
              <AnimatePresence mode="wait">
                {!mfaRequired ? (
                  <motion.div
                    key={isResetPasswordMode ? 'reset-step' : 'credentials-step'}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isResetPasswordMode && (
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 700,
                            color: 'hsl(var(--foreground))',
                            mb: 0.5,
                          }}
                        >
                          Reset Your Password
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.8rem',
                            color: 'hsl(var(--muted-foreground))',
                            lineHeight: 1.4,
                          }}
                        >
                          Enter your email address or username and we will send you a link to reset your password.
                        </Typography>
                      </Box>
                    )}

                    {resetEmailSent && (
                      <Alert
                        severity="success"
                        sx={{
                          mb: 2.5,
                          borderRadius: 2,
                          fontSize: '0.8rem',
                          py: 0.5,
                          bgcolor: 'rgba(34, 197, 94, 0.1)',
                          color: '#22c55e',
                          border: '1px solid rgba(34, 197, 94, 0.2)',
                          '& .MuiAlert-icon': { color: '#22c55e' },
                        }}
                      >
                        {resetEmailSuccessMsg}
                      </Alert>
                    )}

                    <Box sx={{ mb: 2 }}>
                      <Typography
                        sx={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'hsl(var(--foreground))',
                          mb: 0.75,
                        }}
                      >
                        {isResetPasswordMode ? 'Email or Username' : identifierLabel}
                      </Typography>
                      <TextField
                        placeholder="analyst@organization.com"
                        type={serverMode === 'cloud' && !isResetPasswordMode ? 'email' : 'text'}
                        error={!isResetPasswordMode && cloudEmailInvalid}
                        helperText={
                          !isResetPasswordMode && cloudEmailInvalid
                            ? 'Enter a valid email address for Shuffle Cloud.'
                            : undefined
                        }
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}

                        fullWidth
                        required
                        size="small"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="username"
                        InputProps={{
                          sx: {
                            bgcolor: 'hsl(var(--background))',
                            color: 'hsl(var(--foreground))',
                            borderRadius: 2,
                            fontSize: '0.875rem',
                            '& input': {
                              color: 'hsl(var(--foreground))',
                            },
                            '& input::placeholder': {
                              color: 'hsl(var(--muted-foreground))',
                              opacity: 0.8,
                            },
                            '& fieldset': { borderColor: 'hsl(var(--border))' },
                            '&:hover fieldset': { borderColor: '#FF6600' },
                            '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                          },
                        }}
                      />
                    </Box>

                    {!isResetPasswordMode && (
                      <Box sx={{ mb: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                          <Typography
                            sx={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: 'hsl(var(--foreground))',
                            }}
                          >
                            Password
                          </Typography>
                          {serverMode === 'cloud' && (
                            <Button
                              onClick={() => {
                                setIsResetPasswordMode(true);
                                setError('');
                                setResetEmailSent(false);
                              }}
                              size="small"
                              sx={{
                                p: 0,
                                minWidth: 0,
                                fontSize: '0.75rem',
                                textTransform: 'none',
                                color: '#FF6600',
                                fontWeight: 500,
                                '&:hover': {
                                  bgcolor: 'transparent',
                                  textDecoration: 'underline',
                                },
                              }}
                            >
                              Forgot password?
                            </Button>
                          )}
                        </Box>
                        <TextField
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          fullWidth
                          required
                          size="small"
                          autoComplete="current-password"
                          InputProps={{
                            sx: {
                              bgcolor: 'hsl(var(--background))',
                              color: 'hsl(var(--foreground))',
                              borderRadius: 2,
                              fontSize: '0.875rem',
                              '& input': {
                                color: 'hsl(var(--foreground))',
                              },
                              '& input::placeholder': {
                                color: 'hsl(var(--muted-foreground))',
                                opacity: 0.8,
                              },
                              '& fieldset': { borderColor: 'hsl(var(--border))' },
                              '&:hover fieldset': { borderColor: '#FF6600' },
                              '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                            },
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowPassword(!showPassword)}
                                  edge="end"
                                  size="small"
                                  sx={{ color: 'hsl(var(--muted-foreground))' }}
                                >
                                  {showPassword ? <VisibilityOffIcon size={18} /> : <VisibilityIcon size={18} />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Box>
                    )}

                    <Box
                      title={!loading && signInBlockedReason ? signInBlockedReason : undefined}
                      sx={{ width: '100%' }}
                    >
                      <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={loading || !!signInBlockedReason}
                        title={!loading && signInBlockedReason ? signInBlockedReason : undefined}
                        sx={{
                          py: 1.25,
                          borderRadius: 2,
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          textTransform: 'none',
                          bgcolor: '#FF6600',
                          color: '#FFFFFF',
                          boxShadow: '0 4px 14px rgba(255, 102, 0, 0.35)',
                          '&:hover': {
                            bgcolor: '#e65c00',
                          },
                        }}
                      >
                        {loading ? (
                          <CircularProgress size={22} sx={{ color: '#ffffff' }} />
                        ) : isResetPasswordMode ? (
                          resetEmailSent ? 'Resend Reset Link' : 'Send Reset Link'
                        ) : (
                          'Sign In'
                        )}
                      </Button>
                    </Box>


                    {isResetPasswordMode && (
                      <Box sx={{ textAlign: 'center', mt: 2 }}>
                        <Button
                          onClick={() => {
                            setIsResetPasswordMode(false);
                            setResetEmailSent(false);
                            setError('');
                          }}
                          size="small"
                          startIcon={<ArrowLeftIcon size={14} />}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            color: 'hsl(var(--muted-foreground))',
                            '&:hover': { color: 'hsl(var(--foreground))' },
                          }}
                        >
                          Back to Sign In
                        </Button>
                      </Box>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="mfa-step"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Box sx={{ textAlign: 'center', mb: 2.5 }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          p: 1,
                          borderRadius: 2.5,
                          bgcolor: 'rgba(255, 102, 0, 0.1)',
                          border: '1px solid rgba(255, 102, 0, 0.2)',
                          color: '#FF6600',
                          mb: 1.25,
                        }}
                      >
                        <ShieldCheckIcon size={24} />
                      </Box>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: '1.15rem',
                          color: 'hsl(var(--foreground))',
                          mb: 0.5,
                        }}
                      >
                        Two-Factor Authentication
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.8rem',
                          color: 'hsl(var(--muted-foreground))',
                          lineHeight: 1.4,
                        }}
                      >
                        Enter the 6-digit code for <strong>{username}</strong> from your authenticator app.
                      </Typography>
                    </Box>

                    {/* 6 Segmented PIN Boxes */}
                    <Box
                      sx={{
                        position: 'relative',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: { xs: 0.85, sm: 1.25 },
                        my: 2.5,
                        cursor: 'text',
                      }}
                      onClick={() => mfaInputRef.current?.focus()}
                    >
                      <input
                        ref={mfaInputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => handleMfaChange(e.target.value)}
                        disabled={loading}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          zIndex: 10,
                          cursor: 'text',
                        }}
                      />
                      {[0, 1, 2, 3, 4, 5].map((index) => {
                        const digit = mfaCode[index] || '';
                        const isCurrent = mfaCode.length === index;

                        return (
                          <Box
                            key={index}
                            sx={{
                              width: { xs: 40, sm: 46 },
                              height: { xs: 48, sm: 54 },
                              borderRadius: 2,
                              border: '2px solid',
                              borderColor: isCurrent
                                ? '#FF6600'
                                : digit
                                ? 'hsl(var(--foreground))'
                                : 'hsl(var(--border))',
                              bgcolor: isCurrent
                                ? 'rgba(255, 102, 0, 0.08)'
                                : 'hsl(var(--background))',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.35rem',
                              fontWeight: 700,
                              color: 'hsl(var(--foreground))',
                              boxShadow: isCurrent ? '0 0 0 2px rgba(255, 102, 0, 0.25)' : 'none',
                              transition: 'all 0.15s ease-in-out',
                            }}
                          >
                            {digit}
                          </Box>
                        );
                      })}
                    </Box>

                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      disabled={loading || mfaCode.length < 6}
                      sx={{
                        py: 1.25,
                        borderRadius: 2,
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        textTransform: 'none',
                        bgcolor: '#FF6600',
                        color: '#FFFFFF',
                        boxShadow: '0 4px 14px rgba(255, 102, 0, 0.35)',
                        '&:hover': {
                          bgcolor: '#e65c00',
                        },
                      }}
                    >
                      {loading ? <CircularProgress size={22} sx={{ color: '#ffffff' }} /> : 'Verify Code'}
                    </Button>

                    <Button
                      variant="text"
                      fullWidth
                      onClick={() => {
                        setMfaRequired(false);
                        setMfaCode('');
                        setError('');
                      }}
                      disabled={loading}
                      sx={{
                        mt: 1.5,
                        textTransform: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'hsl(var(--muted-foreground))',
                        '&:hover': { color: 'hsl(var(--foreground))' },
                      }}
                    >
                      Back to Sign In
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </CardContent>
        </Card>

        {/* Footer / Registration link */}
        {!mfaRequired && (
          <Box sx={{ textAlign: 'center', mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              Don't have an account?{' '}
              <Link
                to="/register"
                style={{
                  color: '#FF6600',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Sign up
              </Link>
            </Typography>
          </Box>
        )}
      </motion.div>
    </Box>
  </Box>
  );
};

export default MobileAuthGateway;
