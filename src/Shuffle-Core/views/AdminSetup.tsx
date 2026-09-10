import React, { useState, useEffect, useMemo } from 'react';
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
} from '@mui/material';
import { Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useNavigate } from '@/lib/router-compat';
import { getApiUrl, getHostBaseUrl } from '../api';
import { ShuffleCompanyLogo } from '@/components/common/ShuffleLogo';

export interface AdminSetupProps {
  globalUrl?: string;
  loginPath?: string;
  product?: 'security' | 'automation' | 'core';
  productName?: string;
  logo?: React.ReactNode;
  onSuccess?: () => void;
}

export const AdminSetup: React.FC<AdminSetupProps> = ({
  globalUrl: globalUrlProp,
  loginPath = '/login',
  product = 'security',
  productName,
  logo,
  onSuccess,
}) => {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [alreadyConfigured, setAlreadyConfigured] = useState(false);

  const resolvedBaseUrl = useMemo(() => {
    if (globalUrlProp && globalUrlProp.trim()) {
      return globalUrlProp.trim().replace(/\/+$/, '');
    }
    const host = getHostBaseUrl();
    if (host && host.trim()) {
      return host.trim().replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }, [globalUrlProp]);

  const effectiveTitle =
    productName || (product === 'security' ? 'Shuffle Security' : 'Shuffle');

  // Verify server status on mount (scoped to self-hosted)
  useEffect(() => {
    let isCancelled = false;

    const checkServerAdminStatus = async () => {
      setInitialChecking(true);
      setError('');

      try {
        const checkUrl = resolvedBaseUrl
          ? `${resolvedBaseUrl}/api/v1/checkusers`
          : getApiUrl('/api/v1/checkusers');

        const res = await fetch(checkUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        const data = await res.json().catch(() => ({}));

        if (isCancelled) return;

        // reason: "redirect" => users already exist!
        if (data.reason === 'redirect') {
          setAlreadyConfigured(true);
          setSuccess('Administrator account is already set up. Redirecting to sign in...');
          setTimeout(() => {
            if (!isCancelled) {
              navigate(loginPath, { replace: true });
            }
          }, 2000);
          return;
        }

        // reason: "stay" => 0 users, admin account setup required.
      } catch (err) {
        if (!isCancelled) {
          setError(
            'Could not verify server status. Ensure the Shuffle backend is reachable and running.'
          );
        }
      } finally {
        if (!isCancelled) {
          setInitialChecking(false);
        }
      }
    };

    checkServerAdminStatus();

    return () => {
      isCancelled = true;
    };
  }, [resolvedBaseUrl, loginPath, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter an administrator username or email.');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const regUrl = resolvedBaseUrl
        ? `${resolvedBaseUrl}/api/v1/register`
        : getApiUrl('/api/v1/register');

      const res = await fetch(regUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setError(data.reason || data.message || 'Failed to initialize administrator account.');
        return;
      }

      setSuccess('Administrator account created successfully! Redirecting to sign in...');
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        navigate(loginPath, { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Network error while creating administrator account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        width: '100%',
        bgcolor: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        px: 2.5,
        py: 4,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'inline-flex',
              p: 0.5,
              borderRadius: 3,
              mb: 1.5,
              boxShadow: '0 8px 24px rgba(255, 102, 0, 0.2)',
            }}
          >
            {logo || <ShuffleCompanyLogo size={52} />}
          </Box>

          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: 'hsl(var(--foreground))',
              fontSize: { xs: '1.35rem', sm: '1.45rem' },
            }}
          >
            {effectiveTitle}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.85rem',
              mt: 0.5,
            }}
          >
            Create Initial Administrator Account
          </Typography>
        </Box>

        {initialChecking ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
            <CircularProgress size={32} sx={{ color: '#ff6600' }} />
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Checking server configuration...
            </Typography>
          </Box>
        ) : alreadyConfigured ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircle2 size={44} style={{ color: '#22c55e', margin: '0 auto 12px auto' }} />
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
              Instance Initialized
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3 }}>
              This Shuffle instance already has administrator accounts configured.
            </Typography>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate(loginPath, { replace: true })}
              sx={{
                bgcolor: '#ff6600',
                '&:hover': { bgcolor: '#e65c00' },
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Go to Sign In
            </Button>
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }}>
                {success}
              </Alert>
            )}

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
                Administrator Username / Email
              </Typography>
              <TextField
                fullWidth
                required
                autoFocus
                size="small"
                autoComplete="username"
                placeholder="admin@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || Boolean(success)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'hsl(var(--background))',
                  },
                }}
              />
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
                Password (minimum 10 characters)
              </Typography>
              <TextField
                fullWidth
                required
                size="small"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || Boolean(success)}
                InputProps={{
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
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'hsl(var(--background))',
                  },
                }}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 0.75,
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                }}
              >
                Confirm Password
              </Typography>
              <TextField
                fullWidth
                required
                size="small"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || Boolean(success)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'hsl(var(--background))',
                  },
                }}
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || Boolean(success)}
              sx={{
                bgcolor: '#ff6600',
                '&:hover': { bgcolor: '#e65c00' },
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                py: 1.1,
                fontSize: '0.9rem',
              }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: '#fff' }} />
              ) : (
                'Create Administrator Account'
              )}
            </Button>
          </form>
        )}
      </Paper>
    </Box>
  );
};

export default AdminSetup;
