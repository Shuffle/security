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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  WarningAmber as WarningAmberIcon,
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
  first_seen?: number;
  last_seen?: number;
  times_seen?: number;
  updated_at?: number;
  amount?: number;
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

type ScopeValue = 'workflows' | 'agents';

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

const SEVERITY_MAP: Record<string, string> = {
  critical: 'var(--severity-critical)',
  high: 'var(--severity-high)',
  medium: 'var(--severity-medium)',
  warning: 'var(--severity-medium)',
  low: 'var(--severity-low)',
  info: 'var(--severity-info)',
  informational: 'var(--severity-info)',
};

const getSeverityColor = (sev?: string): string | null => {
  if (!sev) return null;
  return SEVERITY_MAP[sev.toLowerCase()] || null;
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
  width = 600,
  minWidth = 600,
  maxWidth = 600,
}: NotificationsDrawerProps) => {
  const [items, setItems] = useState<ExecutionNotification[]>([]);
  const [agentItems, setAgentItems] = useState<ExecutionNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeValue>('workflows');
  const [query, setQuery] = useState('');
  const [showRead, setShowRead] = useState(true);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery(executionId ? String(executionId) : '');
    setScope('workflows');
  }, [open, executionId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
    try {
      const [resp, agentResp] = await Promise.all([
        fetch(getApiUrl('/api/v1/notifications'), { credentials: 'include', headers }),
        fetch(getApiUrl('/api/v1/notifications?origin=agent_approval'), {
          credentials: 'include',
          headers,
        }),
      ]);
      if (!resp.ok) throw new Error(`Failed to load notifications (${resp.status})`);
      const data = await resp.json();
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);

      if (agentResp.ok) {
        const agentData = await agentResp.json();
        setAgentItems(Array.isArray(agentData?.notifications) ? agentData.notifications : []);
      } else {
        setAgentItems([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
      setAgentItems([]);
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
      setAgentItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
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

  // Clear every notification for the org. Only update local state after the
  // server confirms, otherwise notifications reappear on the next refresh.
  const clearAll = useCallback(async () => {
    setClearing(true);
    try {
      const resp = await fetch(getApiUrl('/api/v1/notifications/clear'), {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      });
      if (!resp.ok) throw new Error(`Clear failed (${resp.status})`);
      setItems([]);
      setAgentItems([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear notifications');
      load();
    } finally {
      setClearing(false);
      setConfirmClearOpen(false);
    }
  }, [load]);

  // Agent notifications come from a dedicated endpoint and are never shown
  // under the Workflows tab.
  const agentIds = useMemo(
    () => new Set(agentItems.map((n) => String(n.id))),
    [agentItems],
  );

  const workflowItems = useMemo(
    () => items.filter((n) => !agentIds.has(String(n.id)) && !isAgentNotification(n)),
    [items, agentIds],
  );

  const counts = useMemo(
    () => ({ workflows: workflowItems.length, agents: agentItems.length }),
    [workflowItems, agentItems],
  );

  const matchesScope = useCallback(
    (n: ExecutionNotification) => matchesQuery(n, query.trim()) && (showRead || n.read !== true),
    [query, showRead],
  );

  const workflowVisible = useMemo(
    () => workflowItems.filter(matchesScope),
    [workflowItems, matchesScope],
  );
  const agentVisible = useMemo(
    () => agentItems.filter(matchesScope),
    [agentItems, matchesScope],
  );

  const visible = useMemo(
    () => (scope === 'agents' ? agentVisible : workflowVisible),
    [scope, agentVisible, workflowVisible],
  );

  const filtering = query.trim().length > 0 || !showRead;

  const pillCount = (visibleCount: number, totalCount: number): number | string =>
    filtering && visibleCount !== totalCount ? `${visibleCount}/${totalCount}` : totalCount;


  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100vw', sm: `${width}px` },
          minWidth: { xs: '100vw', sm: `${minWidth}px` },
          maxWidth: { xs: '100vw', sm: `${maxWidth}px` },
          flex: { xs: '0 0 100vw', sm: `0 0 ${width}px` },
        },
      }}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: `${width}px` },
          minWidth: { xs: '100vw', sm: `${minWidth}px` },
          maxWidth: { xs: '100vw', sm: `${maxWidth}px` },
          flexShrink: 0,
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
                { value: 'workflows', label: 'Workflows', count: pillCount(workflowVisible.length, counts.workflows) },
                { value: 'agents', label: 'Agents', count: pillCount(agentVisible.length, counts.agents) },
              ]}
            />
            <Tooltip title={showRead ? 'Hiding read notifications' : 'Showing all notifications'} arrow>
              <span>
                <Button
                  size="small"
                  onClick={() => setShowRead((v) => !v)}
                  sx={{
                    height: 32,
                    minWidth: 0,
                    px: 1.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: showRead ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
                    textTransform: 'none',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '999px',
                    '&:hover': { bgcolor: 'hsl(var(--muted) / 0.5)' },
                  }}
                >
                  {showRead ? 'Hide read' : 'Show read'}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Clear every notification" arrow>
              <span>
                <Button
                  size="small"
                  onClick={() => setConfirmClearOpen(true)}
                  disabled={items.length === 0 || clearing}
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
                  {clearing ? <CircularProgress size={14} /> : 'Close all'}
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
                  {/* Leading indicator column keeps every text line aligned */}
                  <Box
                    sx={{
                      width: 8,
                      flexShrink: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      pt: '5px',
                    }}
                  >
                    {getSeverityColor(n.severity) ? (
                      <Tooltip title={`Severity: ${n.severity}`} arrow>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: `hsl(${getSeverityColor(n.severity)})`,
                          }}
                        />
                      </Tooltip>
                    ) : n.read === false ? (
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: 'hsl(var(--primary))',
                        }}
                      />
                    ) : null}
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'hsl(var(--foreground))',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {n.title || 'Notification'}
                    </Typography>

                    {n.description && (
                      <Typography
                        sx={{
                          fontSize: '0.8125rem',
                          color: 'hsl(var(--muted-foreground))',
                          mt: 0.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.4,
                        }}
                      >
                        {n.description}
                      </Typography>
                    )}

                    {/* Stats row: first seen, last seen, times seen */}
                    {(() => {
                      const firstSeen = n.first_seen || n.created_at;
                      const lastSeen = n.last_seen || n.updated_at;
                      const timesSeen =
                        n.times_seen != null ? n.times_seen : n.amount;
                      const stats: string[] = [];
                      if (firstSeen) stats.push(`First seen: ${formatTime(firstSeen)}`);
                      if (lastSeen) stats.push(`Last seen: ${formatTime(lastSeen)}`);
                      if (timesSeen != null && Number(timesSeen) > 0) {
                        stats.push(`Times seen: ${timesSeen}`);
                      }
                      if (stats.length === 0) return null;
                      return (
                        <Box
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.5,
                            mt: 1,
                          }}
                        >
                          {stats.map((label) => (
                            <Typography
                              key={label}
                              component="span"
                              sx={{
                                fontSize: '0.6875rem',
                                color: 'hsl(var(--muted-foreground) / 0.8)',
                                bgcolor: 'hsl(var(--muted) / 0.4)',
                                px: 0.75,
                                py: 0.25,
                                borderRadius: '6px',
                              }}
                            >
                              {label}
                            </Typography>
                          ))}
                        </Box>
                      );
                    })()}
                  </Box>
                </Box>

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

      {/* Confirmation dialog for "Close all" */}
      <Dialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '1px solid hsl(var(--border))',
            backgroundColor: 'hsl(var(--background))',
            backgroundImage: 'none',
          },
        }}
        sx={{ zIndex: 9999 }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 6 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'hsl(var(--warning) / 0.15)',
              color: 'hsl(var(--warning))',
              flexShrink: 0,
            }}
          >
            <WarningAmberIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            Clear all notifications?
          </Typography>
          <IconButton
            aria-label="Close"
            onClick={() => setConfirmClearOpen(false)}
            size="small"
            sx={{ position: 'absolute', right: 12, top: 12, color: 'hsl(var(--muted-foreground))' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'hsl(var(--border))' }}>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            This will mark every notification for this organization as read. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={() => setConfirmClearOpen(false)}
            variant="outlined"
            disabled={clearing}
            sx={{
              height: 36,
              textTransform: 'none',
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={clearAll}
            variant="contained"
            disabled={clearing}
            startIcon={clearing ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{
              height: 36,
              textTransform: 'none',
              backgroundColor: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
              '&:hover': { backgroundColor: 'hsl(var(--destructive) / 0.9)' },
            }}
          >
            Clear all
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
};

export default NotificationsDrawer;
