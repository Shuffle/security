/**
 * AskAiButton — Floating "Ask AI" trigger button in the bottom-right corner.
 * Styled after ChatGPT docs with a "Support only" tag.
 *
 * Self-contained: No host-app `@/` imports.
 */

import React from 'react';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import AgentIcon from '@/Shuffle-MCPs/components/AgentIcon';
import { isSupportUser } from '@/Shuffle-MCPs/components/AgentPresets';
import { useShuffleMcpTheme } from '@/Shuffle-MCPs/ShuffleMcpThemeProvider';

export interface AskAiButtonProps {
  /** Click handler to toggle or open the context-aware drawer */
  onClick: () => void;
  /** Whether the drawer is currently open */
  isOpen?: boolean;
  /** Authoritative support user flag. Defaults to checking localStorage when omitted. */
  isSupport?: boolean;
  /**
   * Whether to require support status to display the button.
   * Default: true ("This is for now just for support users").
   */
  requireSupport?: boolean;
  /** Custom button label. Default: "Ask AI". */
  label?: string;
  /** Tag label in the button. Default: "Support only". Set to null to hide tag. */
  tagLabel?: string | null;
  /** Optional context name or subtitle shown in tooltip (e.g. "Shuffle Incidents MCP") */
  contextHint?: string;
  /** Custom tooltip title. When omitted, auto-generated from contextHint. */
  tooltipTitle?: React.ReactNode;
  /** Custom sx style overrides for the button */
  sx?: SxProps<Theme>;
  /** Hide button when drawer is open. Default: false. */
  hideWhenOpen?: boolean;
}

export const AskAiButton: React.FC<AskAiButtonProps> = ({
  onClick,
  isOpen = false,
  isSupport,
  requireSupport = true,
  label = 'Ask AI',
  tagLabel = 'Support only',
  contextHint,
  tooltipTitle,
  sx,
  hideWhenOpen = false,
}) => {
  const themeScope = useShuffleMcpTheme();

  // Check support status (prop or fallback to localStorage)
  const isEffectiveSupport = isSupport !== undefined ? isSupport : isSupportUser();

  if (requireSupport && !isEffectiveSupport) {
    return null;
  }

  if (hideWhenOpen && isOpen) {
    return null;
  }

  const effectiveTooltip =
    tooltipTitle !== undefined
      ? tooltipTitle
      : contextHint
      ? `Ask AI (${contextHint})`
      : 'Ask AI • Context-aware assistant';

  return (
    <Box
      className={themeScope?.scopeClassName}
      sx={{
        position: 'fixed',
        bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        right: 'calc(24px + env(safe-area-inset-right, 0px))',
        zIndex: 1250,
      }}
    >
      <Tooltip title={effectiveTooltip} arrow placement="top-end">
        <ButtonBase
          onClick={onClick}
          focusRipple
          aria-label={`${label}${tagLabel ? ` (${tagLabel})` : ''}`}
          sx={[
            {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.25,
              px: 2.25,
              py: 1.25,
              borderRadius: '9999px',
              bgcolor: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
              boxShadow:
                '0 4px 20px -2px rgba(0, 0, 0, 0.35), 0 2px 6px -1px rgba(0, 0, 0, 0.16)',
              backdropFilter: 'blur(10px)',
              cursor: 'pointer',
              userSelect: 'none',
              transition:
                'transform 160ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                bgcolor: 'hsl(var(--card) / 0.95)',
                borderColor: 'hsla(var(--primary) / 0.45)',
                boxShadow:
                  '0 8px 26px -4px hsla(var(--primary) / 0.25), 0 4px 10px -2px rgba(0, 0, 0, 0.2)',
              },
              '&:active': {
                transform: 'translateY(0)',
                boxShadow: '0 2px 10px -2px rgba(0, 0, 0, 0.25)',
              },
            },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          ]}
        >
          {/* AI Icon with subtle glow */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: 'hsla(var(--primary) / 0.14)',
              color: 'hsl(var(--primary))',
              flexShrink: 0,
            }}
          >
            <AgentIcon size={16} />
          </Box>

          {/* Label */}
          <Typography
            sx={{
              fontSize: '0.86rem',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              lineHeight: 1,
              color: 'inherit',
            }}
          >
            {label}
          </Typography>

          {/* "Support only" tag */}
          {tagLabel && (
            <Box
              component="span"
              sx={{
                fontSize: '0.64rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'hsl(var(--primary))',
                bgcolor: 'hsla(var(--primary) / 0.12)',
                border: '1px solid hsla(var(--primary) / 0.26)',
                px: 0.9,
                py: 0.25,
                borderRadius: '9999px',
                lineHeight: 1.1,
                flexShrink: 0,
              }}
            >
              {tagLabel}
            </Box>
          )}
        </ButtonBase>
      </Tooltip>
    </Box>
  );
};

export default AskAiButton;
