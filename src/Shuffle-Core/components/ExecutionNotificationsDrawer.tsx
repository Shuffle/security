/**
 * ExecutionNotificationsDrawer — right-side drawer listing the notifications
 * from the organization, defaulting to the ones for a single workflow execution.
 *
 * Self-contained Shuffle-Core surface: it only needs an `executionId` (and
 * optionally the `workflowId`) and fetches `/api/v1/notifications` itself,
 * filtering down to the entries that belong to this run. Rendering follows the
 * same notification shape used everywhere else in the app (title, description,
 * created_at, reference_url).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Launch as LaunchIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { getApiUrl, getAuthHeader } from '../api';

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

export interface ExecutionNotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  executionId?: string;
  workflowId?: string;
  /** Drawer width in px. Defaults to 520. */
  width?: number;
}

const formatTime = (ts?: number): string => {
  if (!ts) return '';
  const ms = ts > 1e12 ? ts : ts * 1000;
  try {
    return new Date(ms).toLocaleString('en-GB');
  } catch {
    return '';
  }
};

const matchesExecution = (
  n: ExecutionNotification,
  executionId: string,
  workflowId?: string,
): boolean => {
  if (!executionId) return false;
  if (n.execution_id === executionId) return true;
  const ref = String(n.reference_url || '');
  if (ref.includes(executionId)) return true;
  if (workflowId && n.workflow_id === workflowId && ref.includes(executionId)) return true;
  return false;
};

const matchesQuery = (n: ExecutionNotification, q: string): boolean => {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [n.title, n.description, n.reference_url, n.execution_id, n.workflow_id, n.severity]
    .some((v) => String(v || '').toLowerCase().includes(needle));
};

const ExecutionNotificationsDrawer = ({
  open,
  onClose,
  executionId,
  workflowId,
  width = 520,
}: ExecutionNotificationsDrawerProps) => {
  const [items, setItems] = useState<ExecutionNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopedToExecution, setScopedToExecution] = useState(Boolean(executionId));
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setScopedToExecution(Boolean(executionId));
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
      const all: ExecutionNotification[] = Array.isArray(data?.notifications)
        ? data.notifications
        : [];
      setItems(all);
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

  const visible = useMemo(() => {
    const scoped = scopedToExecution && executionId
      ? items.filter((n) => matchesExecution(n, executionId, workflowId))
      : items;
    return scoped.filter((n) => matchesQuery(n, query.trim()));
  }, [items, scopedToExecution, executionId, workflowId, query]);

  const scopedCount = useMemo(
    () => (executionId ? items.filter((n) => matchesExecution(n, executionId, workflowId)).length : 0),
    [items, executionId, workflowId],
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: width },
            maxWidth: '100vw',
            bgcolor: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            backgroundImage: 'none',
            borderLeft: '1px solid hsl(var(--border))',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
          Notifications
        </Typography>
        <Tooltip title="Refresh" arrow>
          <span>
            <IconButton size="small" onClick={load} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Close" arrow>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.25,
          borderBottom: '1px solid hsl(var(--border))',
          flexWrap: 'wrap',
        }}
      >
        <TextField
          size="small"
          placeholder="Search notifications"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'hsl(var(--muted-foreground))' }} />
              </InputAdornment>
            ),
          }}
        />
        {executionId ? (
          <Tooltip title="Only show notifications from the current execution" arrow>
            <Chip
              size="small"
              label={`This execution (${scopedCount})`}
              variant={scopedToExecution ? 'filled' : 'outlined'}
              onClick={() => setScopedToExecution((v) => !v)}
              sx={{
                height: 28,
                fontSize: '0.75rem',
                cursor: 'pointer',
                color: scopedToExecution ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
                bgcolor: scopedToExecution ? 'hsl(var(--primary))' : 'transparent',
                borderColor: 'hsl(var(--border))',
                '&:hover': {
                  bgcolor: scopedToExecution ? 'hsl(var(--primary) / 0.85)' : 'hsl(var(--muted) / 0.4)',
                },
              }}
            />
          </Tooltip>
        ) : null}
        <Chip
          size="small"
          label={`All (${items.length})`}
          variant={scopedToExecution ? 'outlined' : 'filled'}
          onClick={() => setScopedToExecution(false)}
          sx={{
            height: 28,
            fontSize: '0.75rem',
            cursor: 'pointer',
            color: !scopedToExecution ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
            bgcolor: !scopedToExecution ? 'hsl(var(--primary))' : 'transparent',
            borderColor: 'hsl(var(--border))',
            '&:hover': {
              bgcolor: !scopedToExecution ? 'hsl(var(--primary) / 0.85)' : 'hsl(var(--muted) / 0.4)',
            },
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {loading && visible.length === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={22} />
          </Box>
        )}

        {error && (
          <Typography sx={{ fontSize: '0.8125rem', color: 'hsl(var(--destructive))' }}>
            {error}
          </Typography>
        )}

        {!loading && !error && visible.length === 0 && (
          <Typography sx={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
            {scopedToExecution && executionId
              ? 'No notifications found for this execution.'
              : 'No notifications found.'}
          </Typography>
        )}

        {visible.map((n, i) => (
          <Box
            key={n.id || `${i}`}
            sx={{
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              p: 1.5,
              mb: 1.25,
              bgcolor: 'hsl(var(--background))',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Typography
                sx={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}
              >
                {n.title || 'Notification'}
              </Typography>
              {n.read === false && (
                <Chip
                  size="small"
                  label="Unread"
                  sx={{
                    height: 20,
                    fontSize: '0.6875rem',
                    color: 'hsl(var(--severity-medium))',
                    borderColor: 'hsl(var(--severity-medium) / 0.6)',
                    bgcolor: 'hsl(var(--severity-medium) / 0.1)',
                  }}
                  variant="outlined"
                />
              )}
              {n.reference_url && (
                <Tooltip title="Open reference" arrow>
                  <IconButton
                    size="small"
                    onClick={() => window.open(n.reference_url, '_blank', 'noopener,noreferrer')}
                    sx={{ color: 'hsl(var(--muted-foreground))' }}
                  >
                    <LaunchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {n.description && (
              <Typography
                sx={{
                  fontSize: '0.8125rem',
                  color: 'hsl(var(--muted-foreground))',
                  mt: 0.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {n.description}
              </Typography>
            )}
            {n.created_at ? (
              <Typography sx={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', mt: 0.75 }}>
                {formatTime(n.created_at)}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Box>
    </Drawer>
  );
};

export default ExecutionNotificationsDrawer;
