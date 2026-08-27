import { useState, useEffect } from 'react';
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
  useTheme,
  Divider,
  Chip,
} from '@mui/material';
import {
  Eye as VisibilityIcon,
  EyeOff as VisibilityOffIcon,
  Server as ServerIcon,
  Cloud as CloudIcon,
  ArrowRight as ArrowRightIcon,
  CheckCircle2 as CheckCircleIcon,
  AlertCircle as AlertCircleIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from '@/lib/router-compat';
import { useAuth } from '@/context/AuthContext';
import { setHostBaseUrl, getApiUrl, API_ENDPOINTS } from '@/Shuffle-MCPs/api';
import { setHostBaseUrl as setCoreHostBaseUrl } from '@/Shuffle-Core/api';

const CUSTOM_HOST_STORAGE_KEY = 'shuffle_custom_host_url';
const SERVER_MODE_STORAGE_KEY = 'shuffle_selected_server_mode';

export const MobileAuthGateway = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { login } = useAuth();

  // Server instance selection: 'cloud' | 'self-hosted'
  const [serverMode, setServerMode] = useState<'cloud' | 'self-hosted'>(() => {
    if (typeof window === 'undefined') return 'cloud';
    return (localStorage.getItem(SERVER_MODE_STORAGE_KEY) as 'cloud' | 'self-hosted') || 'cloud';
  });

  const [customHostUrl, setCustomHostUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(CUSTOM_HOST_STORAGE_KEY) || '';
  });

  const [isPingingHost, setIsPingingHost] = useState(false);
  const [hostPingStatus, setHostPingStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hostPingMessage, setHostPingMessage] = useState('');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle server mode change
  const handleServerModeChange = (mode: 'cloud' | 'self-hosted') => {
    setServerMode(mode);
    setError('');
    setHostPingStatus('idle');
    try {
      localStorage.setItem(SERVER_MODE_STORAGE_KEY, mode);
      if (mode === 'cloud') {
        setHostBaseUrl(null);
        setCoreHostBaseUrl(null);
        localStorage.removeItem(CUSTOM_HOST_STORAGE_KEY);
      } else if (customHostUrl.trim()) {
        const normalized = customHostUrl.trim().replace(/\/+$/, '');
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

    setIsPingingHost(true);
    setHostPingStatus('idle');
    setHostPingMessage('');

    try {
      setHostBaseUrl(urlToTest);
      setCoreHostBaseUrl(urlToTest);
      localStorage.setItem(CUSTOM_HOST_STORAGE_KEY, urlToTest);

      const res = await fetch(`${urlToTest}/api/v1/getinfo`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (res.ok || res.status === 401 || res.status === 403) {
        setHostPingStatus('success');
        setHostPingMessage('Connected to Shuffle server successfully!');
      } else {
        setHostPingStatus('error');
        setHostPingMessage(`Server responded with status ${res.status}`);
      }
    } catch (err: any) {
      setHostPingStatus('error');
      setHostPingMessage('Unable to reach server. Check URL, HTTPS certificates, or firewall.');
    } finally {
      setIsPingingHost(false);
    }
  };

  // Handle credential login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (serverMode === 'self-hosted' && !customHostUrl.trim()) {
      setError('Please provide your self-hosted Shuffle server URL');
      return;
    }

    setLoading(true);

    try {
      if (serverMode === 'self-hosted' && customHostUrl.trim()) {
        const normalized = customHostUrl.trim().replace(/\/+$/, '');
        setHostBaseUrl(normalized);
        setCoreHostBaseUrl(normalized);
        localStorage.setItem(CUSTOM_HOST_STORAGE_KEY, normalized);
      }

      const body: Record<string, string> = { username, password };
      if (mfaRequired && mfaCode) {
        body.mfa_code = mfaCode;
      }

      const response = await fetch(getApiUrl(API_ENDPOINTS.login), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.mfa_required || response.status === 402) {
          setMfaRequired(true);
          setError('Please enter your multi-factor authentication code.');
          return;
        }
        setError(data.reason || data.message || 'Invalid username or password');
        return;
      }

      if (data.success && data.session_token) {
        await login(data.session_token);
        navigate('/incidents', { replace: true });
      } else {
        setError(data.reason || 'Login failed. Please verify credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
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
        justifyContent: { xs: 'flex-start', sm: 'center' },
        alignItems: 'center',
        px: { xs: 2, sm: 2.5 },
        py: { xs: 2, sm: 4 },
        pt: {
          xs: 'max(4.5rem, calc(2.5rem + env(safe-area-inset-top, 44px)))',
          sm: 5,
        },
        pb: {
          xs: 'max(2.5rem, calc(2rem + env(safe-area-inset-bottom, 24px)))',
          sm: 4,
        },
        pl: 'max(1.25rem, calc(1rem + env(safe-area-inset-left, 0px)))',
        pr: 'max(1.25rem, calc(1rem + env(safe-area-inset-right, 0px)))',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: 'min(420px, 100%)', boxSizing: 'border-box' }}
      >
        {/* Brand Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 3.5 }, mt: { xs: 1, sm: 0 } }}>
          <Box
            sx={{
              display: 'inline-flex',
              p: 1.25,
              borderRadius: 3,
              bgcolor: 'rgba(255, 102, 0, 0.12)',
              border: '1px solid rgba(255, 102, 0, 0.25)',
              mb: 1.5,
              boxShadow: '0 8px 24px rgba(255, 102, 0, 0.15)',
            }}
          >
            <img
              src="/pwa-192x192.png"
              alt="Shuffle"
              style={{ width: 48, height: 48, borderRadius: 10, display: 'block' }}
            />
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
            Open Source Incident Response & SecOps
          </Typography>
        </Box>

        {/* Server Instance Switcher */}
        <Box
          sx={{
            display: 'flex',
            bgcolor: 'hsl(var(--muted))',
            borderRadius: 2.5,
            p: 0.5,
            mb: 2.5,
            border: '1px solid hsl(var(--border))',
          }}
        >
          <Button
            onClick={() => handleServerModeChange('cloud')}
            size="small"
            fullWidth
            startIcon={<CloudIcon size={16} />}
            sx={{
              py: 0.9,
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '0.8rem',
              textTransform: 'none',
              bgcolor: serverMode === 'cloud' ? 'hsl(var(--card))' : 'transparent',
              color: serverMode === 'cloud' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              boxShadow: serverMode === 'cloud' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              '&:hover': {
                bgcolor: serverMode === 'cloud' ? 'hsl(var(--card))' : 'rgba(255,255,255,0.05)',
              },
            }}
          >
            Shuffle Cloud
          </Button>
          <Button
            onClick={() => handleServerModeChange('self-hosted')}
            size="small"
            fullWidth
            startIcon={<ServerIcon size={16} />}
            sx={{
              py: 0.9,
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '0.8rem',
              textTransform: 'none',
              bgcolor: serverMode === 'self-hosted' ? 'hsl(var(--card))' : 'transparent',
              color: serverMode === 'self-hosted' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              boxShadow: serverMode === 'self-hosted' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              '&:hover': {
                bgcolor: serverMode === 'self-hosted' ? 'hsl(var(--card))' : 'rgba(255,255,255,0.05)',
              },
            }}
          >
            Self-Hosted
          </Button>
        </Box>

        {/* Self-Hosted Server URL Configuration */}
        <AnimatePresence>
          {serverMode === 'self-hosted' && (
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
                <Box sx={{ display: 'flex', gap: 1 }}>
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
                        borderRadius: 2,
                        fontSize: '0.85rem',
                        '& fieldset': { borderColor: 'hsl(var(--border))' },
                      },
                    }}
                  />
                  <Button
                    onClick={handlePingHost}
                    variant="outlined"
                    disabled={isPingingHost}
                    sx={{
                      minWidth: 72,
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    {isPingingHost ? <CircularProgress size={16} /> : 'Test'}
                  </Button>
                </Box>
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
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Authentication Card */}
        <Card
          sx={{
            bgcolor: 'hsl(var(--card))',
            borderRadius: 3,
            border: '1px solid hsl(var(--border))',
            boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}
        >
          <CardContent sx={{ p: 3 }}>
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

            {/* Username & Password Form */}
            <Box component="form" onSubmit={handleLoginSubmit}>
              <Box sx={{ mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'hsl(var(--foreground))',
                    mb: 0.75,
                  }}
                >
                  Username or Email
                </Typography>
                <TextField
                  placeholder="analyst@organization.com"
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
                      borderRadius: 2,
                      fontSize: '0.875rem',
                      '& fieldset': { borderColor: 'hsl(var(--border))' },
                    },
                  }}
                />
              </Box>

              <Box sx={{ mb: mfaRequired ? 2 : 2.5 }}>
                <Typography
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'hsl(var(--foreground))',
                    mb: 0.75,
                  }}
                >
                  Password
                </Typography>
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
                      borderRadius: 2,
                      fontSize: '0.875rem',
                      '& fieldset': { borderColor: 'hsl(var(--border))' },
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

              {mfaRequired && (
                <Box sx={{ mb: 2.5 }}>
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
                      mb: 0.75,
                    }}
                  >
                    MFA / Authenticator Code
                  </Typography>
                  <TextField
                    placeholder="6-digit code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    fullWidth
                    required
                    size="small"
                    autoFocus
                    inputProps={{
                      inputMode: 'numeric',
                      pattern: '[0-9]*',
                      maxLength: 6,
                    }}
                    InputProps={{
                      sx: {
                        bgcolor: 'hsl(var(--background))',
                        borderRadius: 2,
                        fontSize: '0.875rem',
                        '& fieldset': { borderColor: 'hsl(var(--border))' },
                      },
                    }}
                  />
                </Box>
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
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
                {loading ? <CircularProgress size={22} sx={{ color: '#ffffff' }} /> : 'Sign In'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Footer / Registration link */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
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
              Sign up on Cloud
            </Link>
          </Typography>
        </Box>
      </motion.div>
    </Box>
  );
};
