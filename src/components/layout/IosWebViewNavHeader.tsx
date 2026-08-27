import React, { useMemo } from 'react';
import { Box, Typography, Button, IconButton } from '@mui/material';
import { ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from '@/lib/router-compat';
import { isIosWebView } from '@/Shuffle-MCPs/api';
import { useAuth } from '@/context/AuthContext';

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
  if (clean === '/admin/billing') {
    return { title: 'Billing & Plans', parentPath: '/admin', parentLabel: 'Admin' };
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

export const IosWebViewNavHeader: React.FC = () => {
  const isIos = isIosWebView();
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo } = useAuth();

  const { title, parentPath, parentLabel } = useMemo(
    () => getPageTitle(location.pathname),
    [location.pathname]
  );

  // If not iOS WebView, never render this header
  if (!isIos) {
    return null;
  }

  const isRootPage = location.pathname === '/incidents' || location.pathname === '/';
  const showBackButton = !isRootPage || (typeof window !== 'undefined' && window.history.length > 1);

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
      sx={{
        display: { xs: 'flex', sm: 'none' },
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        height: 'calc(46px + env(safe-area-inset-top, 0px))',
        pt: 'env(safe-area-inset-top, 0px)',
        px: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        pr: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        bgcolor: 'hsl(var(--background) / 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid hsl(var(--border) / 0.7)',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
      }}
    >
      {/* Left Slot: Back button */}
      <Box sx={{ width: '30%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        {showBackButton && (
          <Button
            onClick={handleBack}
            startIcon={<ChevronLeft size={22} style={{ marginRight: -4 }} />}
            sx={{
              color: 'hsl(var(--primary))',
              fontSize: '0.925rem',
              fontWeight: 600,
              textTransform: 'none',
              p: 0,
              minWidth: 0,
              height: 38,
              '&:hover': { bgcolor: 'transparent' },
              '&:active': { opacity: 0.7 },
            }}
          >
            {parentLabel || 'Back'}
          </Button>
        )}
      </Box>

      {/* Center Slot: Title */}
      <Box sx={{ width: '40%', textAlign: 'center' }}>
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

      {/* Right Slot: Org context or spacer for symmetric alignment */}
      <Box sx={{ width: '30%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {userInfo?.active_org?.name && (
          <Typography
            noWrap
            variant="caption"
            sx={{
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.72rem',
              fontWeight: 500,
              maxWidth: 90,
              textAlign: 'right',
            }}
          >
            {userInfo.active_org.name}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
