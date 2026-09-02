import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, Menu, MenuItem, ButtonBase } from '@mui/material';
import { ChevronLeft, ChevronDown, Check } from 'lucide-react';
import { useLocation, useNavigate, Link } from '@/lib/router-compat';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ShuffleLogo } from '@/components/common/ShuffleLogo';
import { isCapacitorNative, getPlatform } from '@/lib/platform';


const getPageTitle = (pathname: string): { title: string; parentPath?: string; parentLabel?: string } => {
  const clean = pathname.replace(/\/$/, '') || '/';

  if (clean === '/' || clean === '/incidents') {
    return { title: 'Incidents' };
  }
  if (clean.startsWith('/incidents/observables')) {
    return { title: 'Observables', parentPath: '/incidents', parentLabel: 'Incidents' };
  }
  if (clean.startsWith('/incidents/routing')) {
    return { title: 'Incident Routing', parentPath: '/incidents', parentLabel: 'Incidents' };
  }
  if (clean.startsWith('/incidents/')) {
    return { title: 'Incident Details', parentPath: '/incidents', parentLabel: 'Incidents' };
  }
  if (clean === '/ai-agent' || clean === '/agent' || clean.startsWith('/agents')) {
    return { title: 'AI Agent', parentPath: '/incidents', parentLabel: 'Incidents' };
  }
  if (clean === '/admin') {
    return { title: 'Admin Overview', parentPath: '/incidents', parentLabel: 'Incidents' };
  }
  if (clean === '/admin/users') {
    return { title: 'Users & On-Call', parentPath: '/admin', parentLabel: 'Admin' };
  }
  if (clean === '/admin/tenants') {
    return { title: 'Tenant Management', parentPath: '/admin', parentLabel: 'Admin' };
  }
  if (clean === '/settings') {
    return { title: 'Settings', parentPath: '/incidents', parentLabel: 'Incidents' };
  }
  if (clean.startsWith('/workflows')) {
    return { title: 'Workflows', parentPath: '/incidents', parentLabel: 'Incidents' };
  }
  if (clean.startsWith('/detection')) {
    return { title: 'Detections', parentPath: '/incidents', parentLabel: 'Incidents' };
  }
  if (clean.startsWith('/vulnerabilities')) {
    return { title: 'Vulnerabilities', parentPath: '/incidents', parentLabel: 'Incidents' };
  }
  if (clean.startsWith('/assets')) {
    return { title: 'Assets & Hosts', parentPath: '/incidents', parentLabel: 'Incidents' };
  }

  // Fallback for custom routes
  const segments = clean.split('/').filter(Boolean);
  if (segments.length > 0) {
    const raw = segments[segments.length - 1];
    const formatted = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/[-_]/g, ' ');
    return { title: formatted, parentPath: '/incidents', parentLabel: 'Back' };
  }

  return { title: 'Shuffle Security' };
};

const TenantSelector: React.FC<{ maxWidth?: number }> = ({ maxWidth = 140 }) => {
  const { userInfo, setActiveOrg } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [switching, setSwitching] = useState(false);

  const activeOrg = userInfo?.active_org;
  const orgs = useMemo(
    () => [...(userInfo?.orgs || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [userInfo?.orgs]
  );

  if (!activeOrg?.name) return null;

  const handleSelect = async (orgId: string) => {
    setAnchorEl(null);
    if (orgId === activeOrg.id || switching) return;
    setSwitching(true);
    try {
      await setActiveOrg(orgId);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={switching || orgs.length === 0}
        aria-label="Switch tenant"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.2,
          py: 0.4,
          borderRadius: 1.5,
          bgcolor: 'hsl(var(--muted) / 0.6)',
          border: '1px solid hsl(var(--border))',
          maxWidth,
          minWidth: 0,
        }}
      >
        <Typography
          noWrap
          variant="caption"
          sx={{
            color: 'hsl(var(--muted-foreground))',
            fontSize: '0.72rem',
            fontWeight: 500,
            minWidth: 0,
          }}
        >
          {activeOrg.name}
        </Typography>
        <ChevronDown size={12} style={{ flexShrink: 0, color: 'hsl(var(--muted-foreground))' }} />
      </ButtonBase>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              maxHeight: 320,
              minWidth: 200,
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            },
          },
        }}
      >
        {orgs.map((org) => (
          <MenuItem
            key={org.id}
            onClick={() => handleSelect(org.id)}
            selected={org.id === activeOrg.id}
            sx={{ gap: 1, fontSize: '0.82rem', color: 'hsl(var(--foreground))' }}
          >
            <Box sx={{ width: 14, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {org.id === activeOrg.id && <Check size={14} />}
            </Box>
            <Typography noWrap sx={{ fontSize: '0.82rem' }}>{org.name}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export const MobileNavHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo } = useAuth();
  const { brandColor } = useTheme();
  const primaryColor = brandColor || '#FF6600';

  // The extra status-bar / notch padding is only needed inside the native
  // Capacitor app. In a normal browser the header should sit flush on top.
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [isNativeIos, setIsNativeIos] = useState(false);
  useEffect(() => {
    const native = isCapacitorNative();
    setIsNativeApp(native);
    setIsNativeIos(native && getPlatform() === 'ios');
  }, []);

  const { title, parentPath, parentLabel } = useMemo(
    () => getPageTitle(location.pathname),
    [location.pathname]
  );

  const isRootPage = location.pathname === '/' ||
    location.pathname === '/incidents' ||
    location.pathname === '/agent' ||
    location.pathname === '/admin';

  // Browsers have their own back control, and Android has the system back
  // button, so the in-app back arrow is only shown in the native iOS app.
  const showBackButton = !isRootPage && isNativeIos;


  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else if (parentPath) {
      navigate(parentPath);
    } else {
      navigate('/incidents');
    }
  };

  return (
    <Box
      component="header"
      aria-label="Mobile Navigation Header"
      sx={{
        display: { xs: 'flex', sm: 'none' },
        flexDirection: 'column',
        justifyContent: 'flex-end',
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        // Top padding ensures all header elements are pushed safely below Dynamic Island / notch / status bar
        pt: isNativeApp ? 'max(calc(env(safe-area-inset-top, 0px) + 8px), 52px)' : 1,

        pb: 1,
        px: 'max(1rem, env(safe-area-inset-left, 0px))',
        pr: 'max(1rem, env(safe-area-inset-right, 0px))',
        bgcolor: 'hsl(var(--background) / 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid hsl(var(--border) / 0.8)',
        position: 'relative',
        zIndex: 1100,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minHeight: 44,
        }}
      >
        {isRootPage ? (
          // Root page brand header
          <>
            <Box
              component={Link}
              to="/incidents"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <ShuffleLogo size={24} color={primaryColor} />
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography
                  sx={{
                    color: primaryColor,
                    fontWeight: 700,
                    fontSize: '1rem',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Shuffle
                </Typography>
                <Typography
                  sx={{
                    color: 'hsl(var(--foreground))',
                    fontWeight: 700,
                    fontSize: '1rem',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Security
                </Typography>
              </Box>
            </Box>

            <TenantSelector maxWidth={150} />
          </>
        ) : (
          // Subpage navigation header
          <>
            {showBackButton && (
              <Box sx={{ width: '28%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                <Button
                  onClick={handleBack}
                  startIcon={<ChevronLeft size={20} style={{ marginRight: -4 }} />}
                  sx={{
                    color: primaryColor,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    p: 0,
                    minWidth: 0,
                    height: 36,
                    '&:hover': { bgcolor: 'transparent' },
                    '&:active': { opacity: 0.7 },
                  }}
                >
                  {parentLabel || 'Back'}
                </Button>
              </Box>
            )}

            <Box sx={{ minWidth: 0, flex: 1, textAlign: showBackButton ? 'center' : 'left' }}>
              <Typography
                noWrap
                sx={{
                  fontWeight: 700,
                  fontSize: '0.925rem',
                  color: 'hsl(var(--foreground))',
                  letterSpacing: '-0.2px',
                }}
              >
                {title}
              </Typography>
            </Box>

            <Box sx={{ flexShrink: 0, ml: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <TenantSelector maxWidth={110} />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export const IosWebViewNavHeader = MobileNavHeader;
