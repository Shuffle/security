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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import LaunchIcon from '@mui/icons-material/Launch';
import CloseIcon from '@mui/icons-material/Close';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import { getApiUrl, getAuthHeader } from '../api';
import { AppFallbackIcon } from '@/Shuffle-MCPs/components/AppFallbackIcon';
import JsonView from 'react18-json-view';
import type { JsonViewProps } from 'react18-json-view';
import 'react18-json-view/src/style.css';
import 'react18-json-view/src/dark.css';


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

const countRelevantErrors = (result: any): number => {
  if (!result?.action?.parameters?.length) return 0;
  const params = result.action.parameters;
  let count = 0;
  for (const param of params) {
    if (
      param?.name?.endsWith('_error') &&
      (param?.name?.startsWith('shuffle_') || param?.name?.startsWith('liquid_'))
    ) {
      count += 1;
    }
  }
  return count || 0;
};

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
  const [debugResult, setDebugResult] = useState<any | null>(null);
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
              <ResultRenderer value={exec.execution_argument} baseName={exec.workflow?.name} />
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
          {exec.results?.map((r, idx) => {
            const wfAction = exec.workflow?.actions?.find((a: any) =>
              (r?.action?.id && a?.id === r.action.id) ||
              (r?.action?.app_name && a?.app_name === r.action.app_name) ||
              (r?.action?.label && a?.label === r.action.label)
            );
            const imgSrc =
              r?.action?.large_image ||
              (wfAction as any)?.large_image ||
              r?.action?.small_image ||
              (wfAction as any)?.small_image ||
              '';
            const appName = r?.action?.app_name || (wfAction as any)?.app_name;
            return (
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
                {(() => {
                  const errorCount = countRelevantErrors(r);
                  return (
                    <Tooltip
                      title={
                        <Typography variant="body2">
                          Expand debug window. Errors: {errorCount}
                        </Typography>
                      }
                      arrow
                    >
                      <IconButton
                        size="small"
                        onClick={() => setDebugResult(r)}
                        sx={{
                          color: errorCount > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
                          p: 0.5,
                        }}
                      >
                        <ArrowLeftIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  );
                })()}
                {appName ? (
                  <AppFallbackIcon
                    name={appName}
                    imageUrl={imgSrc}
                    size={28}
                    alt={appName}
                    style={{ borderRadius: '50%', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--muted))' }}
                  />
                ) : null}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                    {r?.action?.label || r?.action?.name || `Step ${idx + 1}`}
                  </Typography>
                  {appName && (
                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                      {appName}
                    </Typography>
                  )}
                </Box>
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
            );
          })}
        </Box>
      )}


      <Dialog
        open={Boolean(debugResult)}
        onClose={() => setDebugResult(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid hsl(var(--border))' }}>
          <ArrowLeftIcon />
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
            Debug: {debugResult?.action?.label || debugResult?.action?.name || 'Step result'}
          </Typography>
          <IconButton size="small" onClick={() => setDebugResult(null)} sx={{ color: 'hsl(var(--foreground))' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, minHeight: 300 }}>
          <Box
            sx={{
              maxHeight: '70vh',
              overflow: 'auto',
              border: '1px solid hsl(var(--border))',
              borderRadius: 1,
              p: 1,
              bgcolor: 'hsl(var(--muted) / 0.4)',
            }}
          >
            <JsonView
              src={deepParseJson(debugResult) as object}
              dark
              collapsed={1}
              collapseStringMode="word"
              collapseStringsAfterLength={120}
              enableClipboard
              displaySize
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid hsl(var(--border))' }}>
          <Button onClick={() => setDebugResult(null)} sx={{ color: 'hsl(var(--foreground))' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
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

/** Try hard to turn a value into structured JSON. Handles double-encoded
 *  strings, code-fenced blocks, and recursively parses string properties
 *  whose contents also look like JSON. */
const deepParseJson = (input: unknown, depth = 0): unknown => {
  if (depth > 5) return input;
  if (input == null) return input;
  if (typeof input === 'string') {
    let s = input.trim();
    if (!s) return input;
    // Strip ```json fences
    if (s.startsWith('```')) {
      s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    }
    // Unwrap surrounding quotes on already-quoted JSON strings
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      try { const inner = JSON.parse(s); if (typeof inner === 'string') s = inner; } catch { /* ignore */ }
    }
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        return deepParseJson(parsed, depth + 1);
      } catch { /* fall through */ }
    }
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((v) => deepParseJson(v, depth + 1));
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = deepParseJson(v, depth + 1);
    }
    return out;
  }
  return input;
};

const safeBaseName = (name?: string | null): string => {
  if (!name) return 'workflow';
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'workflow';
};

type JsonViewWithReferenceProps = JsonViewProps & { baseName?: string };

const JsonViewWithReference: React.FC<JsonViewWithReferenceProps> = ({ baseName, ...props }) => {
  const copyModeRef = useRef<'value' | 'reference'>('value');
  const effectiveBaseName = safeBaseName(baseName);

  const customizeCopy = React.useCallback(
    (node: any, nodeMeta?: any) => {
      const mode = copyModeRef.current;
      copyModeRef.current = 'value';

      if (mode === 'reference') {
        const path = nodeMeta?.currentPath ?? nodeMeta?.parentPath ?? [];
        const segments = path.map((seg: string | number) =>
          typeof seg === 'number' || /^\d+$/.test(String(seg)) ? '#' : seg
        );
        return segments.length ? `$${effectiveBaseName}.${segments.join('.')}` : `$${effectiveBaseName}`;
      }

      if (typeof node === 'string') return node;
      if (node === null || node === undefined) return '';
      try {
        return JSON.stringify(node, null, 2);
      } catch {
        return String(node);
      }
    },
    [effectiveBaseName]
  );

  const CopyComponent = React.useCallback(
    ({ onClick, className }: { onClick: (e: React.MouseEvent) => void; className: string }) => (
      <span className={className} style={{ display: 'inline-flex', gap: 2, alignItems: 'center', verticalAlign: 'middle' }}>
        <Tooltip title="Copy value" arrow>
          <ContentCopyIcon
            fontSize="inherit"
            onClick={onClick}
            sx={{ cursor: 'pointer', width: 14, height: 14, opacity: 0.7, '&:hover': { opacity: 1 } }}
          />
        </Tooltip>
        <Tooltip title="Copy reference" arrow>
          <LinkIcon
            fontSize="inherit"
            onClick={(e) => {
              copyModeRef.current = 'reference';
              onClick(e);
            }}
            sx={{ cursor: 'pointer', width: 14, height: 14, opacity: 0.7, '&:hover': { opacity: 1 } }}
          />
        </Tooltip>
      </span>
    ),
    []
  );

  return <JsonView {...props} customizeCopy={customizeCopy} CopyComponent={CopyComponent} />;
};

const ResultRenderer: React.FC<{ value: unknown; baseName?: string }> = ({ value, baseName }) => {
  const parsed = deepParseJson(value);
  if (parsed && typeof parsed === 'object') {
    return (
      <Box sx={{ maxHeight: 320, overflow: 'auto', border: '1px solid hsl(var(--border))', borderRadius: 1, p: 1, bgcolor: 'hsl(var(--muted) / 0.4)' }}>
        <JsonViewWithReference src={parsed as object} baseName={baseName} dark collapsed={1} collapseStringMode="word" collapseStringsAfterLength={120} enableClipboard displaySize />
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
        border: '1px solid hsl(var(--border))',
        borderRadius: 1,
        p: 1,
        bgcolor: 'hsl(var(--muted) / 0.4)',
      }}
    >
      {typeof value === 'string' ? value : String(value ?? '')}
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
