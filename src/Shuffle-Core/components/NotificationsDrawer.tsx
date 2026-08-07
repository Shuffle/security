/**
 * NotificationsDrawer — right-side drawer listing the organization's
 * notifications. Usable anywhere in the platform, not just from an execution.
 *
 * When opened with an `executionId`, the search field is pre-filled with that
 * id so the list is scoped to the run without any extra filter chips.
 *
 * Any component can open the global instance by dispatching the
 * `notifications:open` window event with an optional `{ executionId }`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Block as BlockIcon,
  CheckCircleOutline as CheckCircleIcon,
  Close as CloseIcon,
  OpenInNew as ExploreIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { getApiUrl, getAuthHeader } from '../api';
import { SegmentedControl } from './ui/segmented-control';

export const NOTIFICATIONS_OPEN_EVENT = 'notifications:open';

export interface ExecutionNotification {
  id?: string;
  title?: string;
  description?: string;
  reference_url?: string;
  created_at?: number;
  read?: boolean;
  severity?: string;
  execution_id?: string;
  workflow_id?: string;
  [key: string]: any;
}

export interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Optional execution context — pre-fills the search field. */
  executionId?: string;
  workflowId?: string;
  /** Drawer width in px. Defaults to 620. */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
}

type ScopeValue = 'workflows' | 'executions' | 'agents';

const isAgentNotification = (n: ExecutionNotification): boolean => {
  if (n.agent_id || n.agent_name) return true;
  const ref = String(n.reference_url || '');
  return /\/agents\b|execution_type=agent|type=agent/i.test(ref);
};

const formatTime = (ts?: number): string => {
  if (!ts) return '';
  const ms = ts > 1e12 ? ts : ts * 1000;
  try {
    return new Date(ms).toLocaleString('en-GB');
  } catch {
    return '';
  }
};

const getExecutionId = (n: ExecutionNotification): string => {
  if (n.execution_id) return String(n.execution_id);
  const ref = String(n.reference_url || '');
  const match = ref.match(/execution_id=([a-zA-Z0-9-]+)/);
  return match ? match[1] : '';
};

const matchesQuery = (n: ExecutionNotification, q: string): boolean => {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [n.title, n.description, n.reference_url, n.execution_id, n.workflow_id, n.severity]
    .some((v) => String(v || '').toLowerCase().includes(needle));
};

const NotificationsDrawer = ({
  open,
  onClose,
  executionId,
  workflowId,
  width = 560,
  minWidth = 360,
  maxWidth = 560,
}: NotificationsDrawerProps) => {
  const [items, setItems] = useState<ExecutionNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeValue>('workflows');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery(executionId ? String(executionId) : '');
    setScope(executionId ? 'executions' : 'workflows');
  }, [open, executionId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(getApiUrl('/api/v1/notifications'), {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      });
      if (!resp.ok) throw new Error(`Failed to load notifications (${resp.status})`);
      const data = await resp.json();
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Mark a single notification as read (Close) or disabled.
  const actOnNotification = useCallback(
    async (id: string, disabled = false) => {
      if (!id) return;
      const qs = disabled ? '?disabled=true' : '';
      // Optimistically update local state so the UI feels instant.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      try {
        await fetch(getApiUrl(`/api/v1/notifications/${id}/markasread${qs}`), {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        });
      } catch {
        /* keep optimistic state */
      }
    },
    [],
  );

  // Clear every notification for the org.
  const clearAll = useCallback(async () => {
    setItems([]);
    try {
      await fetch(getApiUrl('/api/v1/notifications/clear'), {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      });
    } catch {
      /* reload will resync on next open */
      load();
    }
  }, [load]);

  const inScope = useCallback(
    (n: ExecutionNotification) => {
      if (scope === 'agents') return isAgentNotification(n);
      if (scope === 'executions') return Boolean(getExecutionId(n)) && !isAgentNotification(n);
      return (Boolean(n.workflow_id) || !getExecutionId(n)) && !isAgentNotification(n);
    },
    [scope],
  );

  const counts = useMemo(() => {
    let executions = 0;
    let workflows = 0;
    let agents = 0;
    items.forEach((n) => {
      if (isAgentNotification(n)) {
        agents += 1;
        return;
      }
      if (getExecutionId(n)) executions += 1;
      if (n.workflow_id || !getExecutionId(n)) workflows += 1;
    });
    return { executions, workflows, agents };
  }, [items]);

  const visible = useMemo(
    () => items.filter((n) => inScope(n) && matchesQuery(n, query.trim())),
    [items, inScope, query],
  );

  const drawerMaxWidth = `min(${maxWidth}px, 100vw)`;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '100%',
          minWidth: `min(${minWidth}px, 100vw)`,
          maxWidth: drawerMaxWidth,
          backgroundColor: 'hsl(var(--background))',
          backgroundImage: 'none',
          color: 'hsl(var(--foreground))',
          borderLeft: '1px solid hsl(var(--border))',
        },
      }}
    >
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ flex: 1, fontSize: '1.125rem', fontWeight: 600 }}>
              Notifications
            </Typography>
            <Tooltip title="Refresh" arrow>
              <span>
                <IconButton
                  size="small"
                  onClick={load}
                  disabled={loading}
                  sx={{ color: 'hsl(var(--muted-foreground))' }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" onClick={onClose} sx={{ color: 'hsl(var(--muted-foreground))' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <TextField
            size="small"
            fullWidth
            placeholder="Search notifications"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'hsl(var(--muted) / 0.35)',
                borderRadius: '999px',
                fontSize: '0.8125rem',
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: 'transparent' },
                '&.Mui-focused fieldset': { borderColor: 'hsl(var(--border))' },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'hsl(var(--muted-foreground))' }} />
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SegmentedControl<ScopeValue>
              size="sm"
              variant="filled"
              value={scope}
              onChange={setScope}
              ariaLabel="Notification scope"
              options={[
                { value: 'workflows', label: 'Workflows', count: counts.workflows },
                { value: 'executions', label: 'Executions', count: counts.executions },
                { value: 'agents', label: 'Agents', count: counts.agents },
              ]}
            />
            <Tooltip title="Clear every notification" arrow>
              <span>
                <Button
                  size="small"
                  onClick={clearAll}
                  disabled={items.length === 0}
                  sx={{
                    ml: 'auto',
                    height: 32,
                    minWidth: 0,
                    px: 1.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'hsl(var(--muted-foreground))',
                    textTransform: 'none',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '999px',
                    '&:hover': { bgcolor: 'hsl(var(--muted) / 0.5)', borderColor: 'hsl(var(--border))' },
                  }}
                >
                  Close all
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 6 }}>
          {loading && visible.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={24} sx={{ color: 'hsl(var(--muted-foreground))' }} />
            </Box>
          )}

          {error && (
            <Typography sx={{ fontSize: '0.8125rem', color: 'hsl(var(--destructive))', py: 2 }}>
              {error}
            </Typography>
          )}

          {!loading && !error && visible.length === 0 && (
            <Typography
              sx={{
                fontSize: '0.8125rem',
                color: 'hsl(var(--muted-foreground))',
                textAlign: 'center',
                py: 8,
              }}
            >
              No notifications found
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {visible.map((n, i) => (
              <Box
                key={n.id || `${i}`}
                sx={{
                  borderRadius: '14px',
                  p: 2,
                  bgcolor: 'hsl(var(--muted) / 0.25)',
                  transition: 'background-color 0.15s ease',
                  '&:hover': { bgcolor: 'hsl(var(--muted) / 0.45)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  {n.read === false && (
                    <Box
                      sx={{
                        mt: '6px',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'hsl(var(--primary))',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <Typography
                    sx={{
                      flex: 1,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
                      lineHeight: 1.35,
                    }}
                  >
                    {n.title || 'Notification'}
                  </Typography>
                </Box>
                {n.description && (
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      color: 'hsl(var(--muted-foreground))',
                      mt: 0.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.5,
                    }}
                  >
                    {n.description}
                  </Typography>
                )}
                {n.created_at ? (
                  <Typography
                    sx={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground) / 0.7)', mt: 1 }}
                  >
                    {formatTime(n.created_at)}
                  </Typography>
                ) : null}
                {/* Per-notification actions */}
                <Box
                  sx={{
                    mt: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    justifyContent: 'flex-end',
                  }}
                >
                  {n.reference_url && (
                    <Tooltip title="Explore" arrow>
                      <IconButton
                        size="small"
                        onClick={() => window.open(n.reference_url, '_blank', 'noopener,noreferrer')}
                        sx={{
                          color: 'hsl(var(--muted-foreground))',
                          '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted) / 0.6)' },
                        }}
                      >
                        <ExploreIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {n.id && (
                    <Tooltip title="Close" arrow>
                      <span>
                        <IconButton
                          size="small"
                          disabled={n.read === true}
                          onClick={() => actOnNotification(n.id!, false)}
                          sx={{
                            color: 'hsl(var(--muted-foreground))',
                            '&:hover': { color: 'hsl(var(--primary))', bgcolor: 'hsl(var(--muted) / 0.6)' },
                            '&.Mui-disabled': { opacity: 0.35 },
                          }}
                        >
                          <CheckCircleIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {n.id && (
                    <Tooltip title="Disable" arrow>
                      <IconButton
                        size="small"
                        onClick={() => actOnNotification(n.id!, true)}
                        sx={{
                          color: 'hsl(var(--muted-foreground))',
                          '&:hover': { color: 'hsl(var(--destructive))', bgcolor: 'hsl(var(--muted) / 0.6)' },
                        }}
                      >
                        <BlockIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default NotificationsDrawer;
