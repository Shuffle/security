/**
 * AskAiSidePanel — Persistent, sideshifting right-docked AI assistant panel.
 *
 * Replaces the modal drawer with a persistent panel that slides out from the
 * right and sideshifts the main UI horizontally without blocking page clicks.
 *
 * Key features:
 *  - Sideshifts layout: sets CSS variable `--ask-ai-panel-width: {width}px` on
 *    document.documentElement, smoothly shrinking DashboardLayout margin.
 *  - Compact horizontal width (~380px default).
 *  - Task-focused: minimal fluff, contextual question header (e.g. "How can we
 *    help handle incidents?"), prompt input with active skill chip -> tools chips.
 *  - Support user visibility: shows an explicit missing-config notice when no
 *    dedicated MCP app or skill is mapped for the current page.
 *  - Disabled & auto-closing on `/agents` and `/agent` routes.
 *  - Choice persistence: remembers tool and skill modifications per page.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  ButtonBase,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import {
  AlertTriangle,
  RotateCcw,
  X as CloseIcon,
} from 'lucide-react';

import AgentIcon from '@/Shuffle-MCPs/components/AgentIcon';
import AgentUI, { type AgentUIProps } from '@/Shuffle-MCPs/components/AgentUI';
import {
  isAgentRoute,
  resolveAgentContext,
  setPageContextChoice,
  clearPageContextChoice,
  type AgentContextRule,
  type AgentResolvedContext,
} from '@/Shuffle-MCPs/agentContextRegistry';
import { useShuffleMcpTheme } from '@/Shuffle-MCPs/ShuffleMcpThemeProvider';

export interface AskAiSidePanelProps {
  /** Whether the side panel is open */
  open: boolean;
  /** Callback to close the side panel */
  onClose: () => void;
  /** Current URL pathname. Falls back to window.location.pathname when omitted. */
  pathname?: string;
  /** Current URL search params string. */
  search?: string;
  /** Optional custom rules to evaluate ahead of built-ins */
  rules?: AgentContextRule[];
  /** Authoritative support user flag */
  isSupport?: boolean;
  /** Panel width in pixels. Default: 380 */
  width?: number;
  /** Theme override forwarded to AgentUI */
  theme?: 'light' | 'dark' | 'system';
  /** Backend base URL */
  globalUrl?: string;
  /** Extra props forwarded directly to AgentUI */
  agentUIProps?: Partial<AgentUIProps>;
  /** Notified when context is resolved or updated */
  onContextResolved?: (context: AgentResolvedContext) => void;
  /** Style overrides for the root panel container */
  sx?: SxProps<Theme>;
}

export const AskAiSidePanel: React.FC<AskAiSidePanelProps> = ({
  open,
  onClose,
  pathname,
  search,
  rules,
  isSupport,
  width = 380,
  theme,
  globalUrl,
  agentUIProps,
  onContextResolved,
  sx,
}) => {
  const themeScope = useShuffleMcpTheme();
  const effectiveTheme = theme || (themeScope?.isDark ? 'dark' : 'light');

  const [currentPathname, setCurrentPathname] = useState<string>(() => {
    if (pathname !== undefined) return pathname;
    if (typeof window !== 'undefined') return window.location.pathname;
    return '/';
  });

  const [currentSearch, setCurrentSearch] = useState<string>(() => {
    if (search !== undefined) return search;
    if (typeof window !== 'undefined') return window.location.search;
    return '';
  });

  // Keep path synced
  useEffect(() => {
    if (pathname !== undefined) {
      setCurrentPathname(pathname);
      return;
    }
    if (typeof window !== 'undefined') {
      const handleLocationChange = () => {
        setCurrentPathname(window.location.pathname);
        setCurrentSearch(window.location.search);
      };
      window.addEventListener('popstate', handleLocationChange);
      return () => window.removeEventListener('popstate', handleLocationChange);
    }
    return;
  }, [pathname]);

  useEffect(() => {
    if (search !== undefined) {
      setCurrentSearch(search);
    }
  }, [search]);

  // Check if current route is an excluded Agent route (/agents or /agent)
  const isAgentDisabled = isAgentRoute(currentPathname);

  // Auto-close if currently open when user navigates to an agent route
  useEffect(() => {
    if (isAgentDisabled && open) {
      onClose();
    }
  }, [isAgentDisabled, open, onClose]);

  // Track reset key to force re-resolving and resetting AgentUI
  const [resetKey, setResetKey] = useState<number>(0);

  // Resolve context awareness for the active page
  const context = React.useMemo<AgentResolvedContext>(
    () => resolveAgentContext(currentPathname, currentSearch, rules),
    [currentPathname, currentSearch, rules, resetKey],
  );

  const [isOverridden, setIsOverridden] = useState<boolean>(context.isOverridden);

  useEffect(() => {
    setIsOverridden(context.isOverridden);
  }, [context.isOverridden, context.storageKey]);

  useEffect(() => {
    onContextResolved?.(context);
  }, [context, onContextResolved]);

  // Manage UI sideshifting via CSS variable `--ask-ai-panel-width`
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (open && !isAgentDisabled) {
      document.documentElement.style.setProperty('--ask-ai-panel-width', `${width}px`);
    } else {
      document.documentElement.style.setProperty('--ask-ai-panel-width', '0px');
    }

    return () => {
      document.documentElement.style.setProperty('--ask-ai-panel-width', '0px');
    };
  }, [open, isAgentDisabled, width]);

  const handleReset = useCallback(() => {
    clearPageContextChoice(context.storageKey);
    setIsOverridden(false);
    setResetKey((c) => c + 1);
  }, [context.storageKey]);

  const handleAppsChange = useCallback<NonNullable<AgentUIProps['onAppsChange']>>(
    (nextApps) => {
      setPageContextChoice(context.storageKey, {
        apps: nextApps.map((a) => ({ name: a.name, id: a.id, icon: a.icon })),
      });
      setIsOverridden(true);
      agentUIProps?.onAppsChange?.(nextApps);
    },
    [context.storageKey, agentUIProps],
  );

  const handleSelectPreset = useCallback(
    (preset: any) => {
      setPageContextChoice(context.storageKey, {
        presetId: preset?.id ?? null,
      });
      setIsOverridden(true);
    },
    [context.storageKey],
  );

  if (isAgentDisabled) {
    return null;
  }

  const isVisible = open && !isAgentDisabled;

  return (
    <>
      {/* Mobile-only backdrop overlay to close easily on small screens */}
      <Box
        onClick={onClose}
        aria-hidden="true"
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'rgba(0, 0, 0, 0.45)',
          zIndex: 1199,
          display: { xs: isVisible ? 'block' : 'none', sm: 'none' },
          backdropFilter: 'blur(2px)',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Persistent Docked Side Panel */}
      <Box
        component="aside"
        aria-label="Ask AI"
        aria-hidden={!isVisible}
        className={themeScope?.scopeClassName}
        sx={[
          {
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: { xs: '100%', sm: width },
            maxWidth: '100vw',
            height: '100dvh',
            bgcolor: 'hsl(var(--card))',
            borderLeft: '1px solid hsl(var(--border))',
            boxShadow: isVisible ? '-6px 0 24px rgba(0, 0, 0, 0.16)' : 'none',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: isVisible ? 'auto' : 'none',
            visibility: isVisible ? 'visible' : 'hidden',
            boxSizing: 'border-box',
            overflow: 'hidden',
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {/* Top Header Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            pt: 1.5,
            pb: 1,
            borderBottom: '1px solid hsl(var(--border) / 0.6)',
            flexShrink: 0,
          }}
        >
          {/* Logo & Support Tag */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '6px',
                bgcolor: 'hsl(var(--primary) / 0.12)',
                border: '1px solid hsl(var(--primary) / 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--primary))',
                flexShrink: 0,
              }}
            >
              <AgentIcon size={14} />
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.86rem',
                color: 'hsl(var(--foreground))',
                letterSpacing: '-0.01em',
              }}
            >
              Ask AI
            </Typography>
            <Box
              sx={{
                fontSize: '0.66rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                px: 0.75,
                py: 0.2,
                borderRadius: '4px',
                bgcolor: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
                border: '1px solid hsl(var(--border))',
              }}
            >
              Support only
            </Box>
          </Box>

          {/* Header Action Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isOverridden && (
              <Tooltip title="Reset to page default MCP tools & skill" arrow>
                <ButtonBase
                  onClick={handleReset}
                  sx={{
                    fontSize: '0.72rem',
                    color: 'hsl(var(--muted-foreground))',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    '&:hover': {
                      color: 'hsl(var(--foreground))',
                      bgcolor: 'hsl(var(--muted) / 0.6)',
                    },
                  }}
                >
                  <RotateCcw size={12} />
                  Reset
                </ButtonBase>
              </Tooltip>
            )}

            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Close Ask AI panel"
              sx={{
                color: 'hsl(var(--muted-foreground))',
                p: 0.75,
                borderRadius: '8px',
                '&:hover': {
                  color: 'hsl(var(--foreground))',
                  bgcolor: 'hsl(var(--muted))',
                },
              }}
            >
              <CloseIcon size={16} />
            </IconButton>
          </Box>
        </Box>

        {/* Task-Focused Title */}
        <Box sx={{ px: 2, pt: 1.75, pb: 1, flexShrink: 0 }}>
          <Typography
            sx={{
              fontSize: '1.02rem',
              fontWeight: 650,
              lineHeight: 1.32,
              color: 'hsl(var(--foreground))',
              letterSpacing: '-0.015em',
            }}
          >
            {context.title}
          </Typography>
        </Box>

        {/* Missing Config Banner for Support Users */}
        {context.missingConfig && (
          <Box
            sx={{
              mx: 2,
              mb: 1.5,
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: 'hsl(var(--warning) / 0.1)',
              border: '1px solid hsl(var(--warning) / 0.3)',
              color: 'hsl(var(--warning))',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                fontWeight: 600,
                fontSize: '0.78rem',
              }}
            >
              <AlertTriangle size={14} />
              Missing page configuration
            </Box>
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: 'hsl(var(--muted-foreground))',
                lineHeight: 1.35,
              }}
            >
              No specific MCP apps or skills mapped for <code>{currentPathname}</code>. Using default platform tools. Support users: add a route mapping in <code>agentContextRegistry.ts</code> or manually choose tools below.
            </Typography>
          </Box>
        )}

        {/* Scrollable Agent Run Body (Fluff-free: Textfield with skill -> tools -> execution) */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            px: 1.5,
            pb: 2,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <AgentUI
            key={`${context.storageKey}-${resetKey}`}
            compact={true}
            hideHeroIcon={true}
            title=""
            subtitle={null}
            hideChooseLLM={true}
            disableSchedule={true}
            hideAttach={false}
            maxWidth={width - 32}
            defaultApps={context.apps}
            initialPresetId={context.presetId}
            defaultInput={context.defaultPrompt}
            placeholder={context.placeholder}
            onAppsChange={handleAppsChange}
            onSelectPreset={handleSelectPreset}
            apiBaseUrl={globalUrl || agentUIProps?.apiBaseUrl}
            theme={effectiveTheme}
            {...agentUIProps}
            sx={{
              minHeight: 'auto',
              pt: 0,
              pb: 2,
              ...(agentUIProps?.sx ? (Array.isArray(agentUIProps.sx) ? {} : agentUIProps.sx) : {}),
            }}
          />
        </Box>
      </Box>
    </>
  );
};

export default AskAiSidePanel;
