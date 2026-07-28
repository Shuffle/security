/**
 * WorkflowRunExplorer — Shuffle-Core surface for inspecting a single
 * workflow execution.
 *
 * This is the Shuffle-Security-friendly port of the original Shuffle
 * Automation sidebar (kept as reference at `./WorkflowRunExplorer.jsx`).
 * The .jsx file is a raw fragment lifted from Shuffle Automation and
 * references dozens of host-app symbols (theme, workflowExecutions,
 * apps, environments, executeWorkflow, ...). This file re-implements
 * the same visual/UX shape as a self-contained, host-agnostic
 * component that only needs an `executionId`.
 *
 * Public API:
 *   - <WorkflowRunExplorer executionId="..." /> — inline embedded view
 *   - <WorkflowRunExplorerDrawer open executionId onClose /> — drawer
 *
 * Both are re-exported through `src/Shuffle-Core/index.tsx` and wrapped
 * with `ShuffleCoreThemeProvider` so the surface matches every other
 * Shuffle-Core component (36px buttons, HSL tokens, dark by default).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Divider,
  Tooltip,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import LaunchIcon from '@mui/icons-material/Launch';
import CloseIcon from '@mui/icons-material/Close';
import { getApiUrl, getAuthHeader } from '../api';
import { ReactJson } from './stubs';

export interface WorkflowExecution {
  execution_id?: string;
  status?: string;
  started_at?: number;
  completed_at?: number;
  execution_source?: string;
  execution_argument?: string;
  execution_parent?: string;
  authgroup?: string;
  notifications_created?: number;
  results?: any[];
  workflow?: {
    id?: string;
    name?: string;
    actions?: Array<{ environment?: string }>;
  };
  [key: string]: any;
}

const IN_PROGRESS = new Set(['EXECUTING', 'WAITING', 'RUNNING']);
const isRunning = (s?: string) => IN_PROGRESS.has((s || '').toUpperCase());

const fetchExecution = async (executionId: string): Promise<WorkflowExecution | null> => {
  try {
    const resp = await fetch(getApiUrl('/api/v1/streams/results'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ execution_id: executionId, authorization: executionId }),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text || text === '{}' || text === 'null') return null;
    return JSON.parse(text) as WorkflowExecution;
  } catch {
    return null;
  }
};

const sourceLabel = (exec: WorkflowExecution): string => {
  const src = exec.execution_source || '';
  if (src.startsWith('datastore')) return 'Datastore Automation';
  if (src === 'authgroups' || exec.authgroup) return `Auth Group${exec.authgroup ? ` '${exec.authgroup}'` : ''}`;
  if (exec.execution_parent) return 'Parent Workflow';
  if (['questions', 'web', 'form', 'forms'].includes(src)) return 'Form';
  return src || 'default';
};

const shuffleUrlForExecution = (exec: WorkflowExecution): string | null => {
  const wfId = exec.workflow?.id;
  const execId = exec.execution_id;
  if (!execId) return null;
  if (wfId) return `https://shuffler.io/workflows/${wfId}?execution_id=${execId}`;
  return `https://shuffler.io/admin?admin_tab=workflow_runs&execution_id=${execId}`;
};

export interface WorkflowRunExplorerProps {
  /** Execution id to inspect. Required. */
  executionId: string;
  /** Optional close handler (renders a small breadcrumb back button). */
  onClose?: () => void;
  /** Polling interval in ms for in-progress runs. Defaults to 3000. */
  pollIntervalMs?: number;
}

export const WorkflowRunExplorer: React.FC<WorkflowRunExplorerProps> = ({
  executionId,
  onClose,
  pollIntervalMs = 3000,
}) => {
  const [exec, setExec] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const load = React.useCallback(async () => {
    const data = await fetchExecution(executionId);
    if (cancelledRef.current) return;
    setExec(data);
    setLoading(false);
  }, [executionId]);

  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    setExec(null);
    load();
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [executionId, load]);

  // Polling for in-progress runs.
  useEffect(() => {
    if (!exec || !isRunning(exec.status)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { load(); }, pollIntervalMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [exec, load, pollIntervalMs]);

  const openInShuffle = () => {
    if (!exec) return;
    const url = shuffleUrlForExecution(exec);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box
      sx={{
        bgcolor: 'hsl(var(--card))',
        color: 'hsl(var(--foreground))',
        p: { xs: '0 10px 50px 10px', sm: '25px 15px 150px 15px' },
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Breadcrumb / back */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {onClose && (
          <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--foreground))', mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
        )}
        <Typography
          variant="h6"
          onClick={onClose}
          sx={{ cursor: onClose ? 'pointer' : 'default', color: 'hsl(var(--foreground))', fontWeight: 600 }}
        >
          Back to all runs
        </Typography>
      </Box>
      <Divider sx={{ my: 1.5, bgcolor: 'hsl(var(--border))' }} />

      {/* Details header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 1,
          border: '1px solid hsl(var(--border))',
          borderRadius: 1.5,
          mb: 1.5,
          position: 'sticky',
          top: 0,
          zIndex: 3,
          bgcolor: 'hsl(var(--card))',
        }}
      >
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>Details</Typography>
        <Tooltip title="Refresh" arrow>
          <span>
            <IconButton size="small" onClick={load} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {exec && (
          <Tooltip title="Open in Shuffle" arrow>
            <span>
              <IconButton size="small" onClick={openInShuffle}>
                <LaunchIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {onClose && (
          <Tooltip title="Close" arrow>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {loading && !exec && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!loading && !exec && (
        <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', px: 1 }}>
          Execution not found or is no longer available.
        </Typography>
      )}

      {exec && (
        <Box sx={{ px: 1 }}>
          {exec.status && (
            <MetaRow label="Status" value={exec.status} />
          )}
          {(exec.execution_source || exec.authgroup) && (
            <MetaRow label="Source" value={sourceLabel(exec)} accent />
          )}
          {exec.started_at ? (
            <MetaRow
              label="Started"
              value={new Date(exec.started_at * 1000).toLocaleString('en-GB')}
            />
          ) : null}
          {exec.completed_at ? (
            <MetaRow
              label="Finished"
              value={new Date(exec.completed_at * 1000).toLocaleString('en-GB')}
            />
          ) : null}
          {exec.workflow?.actions?.[0]?.environment && (
            <MetaRow label="Location" value={exec.workflow.actions[0].environment} accent />
          )}

          {exec.execution_argument && exec.execution_argument.length > 1 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'hsl(var(--muted-foreground))' }}>
                Execution argument
              </Typography>
              <ResultRenderer value={exec.execution_argument} />
            </Box>
          )}

          <Divider sx={{ my: 2, bgcolor: 'hsl(var(--border))' }} />

          <Typography variant="subtitle2" sx={{ mb: 1, color: 'hsl(var(--muted-foreground))' }}>
            Results {exec.results ? `(${exec.results.length})` : ''}
          </Typography>
          {(!exec.results || exec.results.length === 0) && isRunning(exec.status) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                Waiting for results…
              </Typography>
            </Box>
          )}
          {exec.results?.map((r, idx) => (
            <Box
              key={r?.action?.id || idx}
              sx={{
                border: '1px solid hsl(var(--border))',
                borderRadius: 1,
                p: 1.25,
                mb: 1,
                bgcolor: 'hsl(var(--card))',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                  {r?.action?.label || r?.action?.name || `Step ${idx + 1}`}
                </Typography>
                {r?.status && (
                  <Typography
                    variant="caption"
                    sx={{
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      color:
                        r.status === 'SUCCESS' || r.status === 'FINISHED'
                          ? 'hsl(140 60% 55%)'
                          : r.status === 'FAILURE' || r.status === 'ABORTED'
                          ? 'hsl(var(--destructive))'
                          : 'hsl(45 90% 55%)',
                    }}
                  >
                    {r.status}
                  </Typography>
                )}
              </Box>
              {r?.result && (
                <Box sx={{ mt: 0.5 }}>
                  <ResultRenderer value={r.result} />
                </Box>
              )}
            </Box>
          ))}

          <Divider sx={{ my: 2, bgcolor: 'hsl(var(--border))' }} />
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Raw payload
          </Typography>
          <Box sx={{ mt: 0.5, maxHeight: 320, overflow: 'auto', border: '1px solid hsl(var(--border))', borderRadius: 1, p: 1 }}>
            <ReactJson src={exec} name={false} collapsed={2} theme="monokai" />
          </Box>
        </Box>
      )}
    </Box>
  );
};

const MetaRow: React.FC<{ label: string; value: React.ReactNode; accent?: boolean }> = ({ label, value, accent }) => (
  <Box sx={{ display: 'flex', gap: 1, ml: 1, py: 0.25 }}>
    <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80 }}>{label}</Typography>
    <Typography variant="body2" sx={{ color: accent ? '#FF8544' : 'hsl(var(--muted-foreground))' }}>
      {value}
    </Typography>
  </Box>
);

const ResultRenderer: React.FC<{ value: string }> = ({ value }) => {
  const trimmed = (value || '').trim();
  let parsed: any = null;
  try {
    parsed = trimmed && (trimmed.startsWith('{') || trimmed.startsWith('[')) ? JSON.parse(trimmed) : null;
  } catch {
    parsed = null;
  }
  if (parsed && typeof parsed === 'object') {
    return (
      <Box sx={{ maxHeight: 260, overflow: 'auto' }}>
        <ReactJson src={parsed} name={false} collapsed={1} theme="monokai" />
      </Box>
    );
  }
  return (
    <Box
      sx={{
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: 'hsl(var(--muted-foreground))',
        maxHeight: 260,
        overflow: 'auto',
      }}
    >
      {value}
    </Box>
  );
};

export interface WorkflowRunExplorerDrawerProps extends WorkflowRunExplorerProps {
  open: boolean;
  /** Drawer width in px. Defaults to 720. */
  width?: number;
  /** Minimum drawer width in px. Defaults to 480. */
  minWidth?: number;
  /** Maximum drawer width in px. Defaults to 900. */
  maxWidth?: number;
}

export const WorkflowRunExplorerDrawer: React.FC<WorkflowRunExplorerDrawerProps> = ({
  open,
  executionId,
  onClose,
  width = 720,
  minWidth = 480,
  maxWidth = 900,
  pollIntervalMs,
}) => {
  const drawerWidth = `min(${width}px, 100vw)`;
  const drawerMinWidth = `min(${minWidth}px, 100vw)`;
  const drawerMaxWidth = `min(${maxWidth}px, 100vw)`;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: drawerWidth,
          minWidth: drawerMinWidth,
          maxWidth: drawerMaxWidth,
          flex: `0 0 ${drawerWidth}`,
          bgcolor: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          borderLeft: '1px solid hsl(var(--border))',
        },
      }}
      sx={{
        '& .MuiDrawer-paper': {
          boxSizing: 'border-box',
          width: `${drawerWidth} !important`,
          minWidth: `${drawerMinWidth} !important`,
          maxWidth: `${drawerMaxWidth} !important`,
          flex: `0 0 ${drawerWidth} !important`,
        },
      }}
    >
      {open && executionId && (
        <WorkflowRunExplorer
          executionId={executionId}
          onClose={onClose}
          pollIntervalMs={pollIntervalMs}
        />
      )}
    </Drawer>
  );
};

export default WorkflowRunExplorer;
