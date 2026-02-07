/**
 * Agent Activity Feed - shows individual execution cards
 */

import { Box, Typography, Chip, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  Activity,
  Zap,
  FileText,
  Globe,
  Server,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AgentRun } from '@/services/agentActivity';

// Map status to icon and color
const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  FINISHED: { icon: <CheckCircle size={16} />, color: 'hsl(var(--severity-low))', label: 'Completed' },
  SUCCESS: { icon: <CheckCircle size={16} />, color: 'hsl(var(--severity-low))', label: 'Completed' },
  FAILED: { icon: <XCircle size={16} />, color: 'hsl(var(--severity-critical))', label: 'Failed' },
  ABORTED: { icon: <XCircle size={16} />, color: 'hsl(var(--severity-critical))', label: 'Aborted' },
  EXECUTING: { icon: <Loader2 size={16} />, color: 'hsl(var(--severity-medium))', label: 'Running' },
  RUNNING: { icon: <Loader2 size={16} />, color: 'hsl(var(--severity-medium))', label: 'Running' },
  WAITING: { icon: <Clock size={16} />, color: 'hsl(var(--severity-info))', label: 'Waiting' },
};

// Assign icons based on execution patterns
const getRunIcon = (run: AgentRun): React.ReactNode => {
  const src = (run.execution_source || '').toLowerCase();
  const arg = (run.execution_argument || '').toLowerCase();
  
  if (src.includes('schedule') || src.includes('cron')) return <Clock size={18} />;
  if (src.includes('webhook') || src.includes('http')) return <Globe size={18} />;
  if (arg.includes('alert') || arg.includes('detect')) return <Activity size={18} />;
  if (arg.includes('report') || arg.includes('email')) return <FileText size={18} />;
  if (arg.includes('endpoint') || arg.includes('server')) return <Server size={18} />;
  return <Zap size={18} />;
};

const getRunIconColor = (run: AgentRun): string => {
  const status = run.status?.toUpperCase() || '';
  if (status === 'FINISHED' || status === 'SUCCESS') return 'hsl(var(--severity-low))';
  if (status === 'FAILED' || status === 'ABORTED') return 'hsl(var(--severity-critical))';
  if (status === 'EXECUTING' || status === 'RUNNING') return 'hsl(var(--severity-medium))';
  return 'hsl(var(--primary))';
};

const formatDuration = (run: AgentRun): string => {
  if (run.started_at && run.completed_at) {
    const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
  if (run.duration) return `${run.duration.toFixed(1)}s`;
  return '';
};

const getTimeAgo = (dateStr: string): string => {
  try {
    // Handle both ISO strings and Unix timestamps
    const date = isNaN(Number(dateStr)) ? new Date(dateStr) : new Date(Number(dateStr) * 1000);
    if (isNaN(date.getTime())) return dateStr;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateStr;
  }
};

// Try to extract a meaningful title from the run
const getRunTitle = (run: AgentRun): string => {
  if (run.workflow?.name) return run.workflow.name;
  
  // Try to parse execution_argument for a title
  if (run.execution_argument) {
    try {
      const parsed = JSON.parse(run.execution_argument);
      if (parsed.title) return parsed.title;
      if (parsed.action) return parsed.action;
      if (parsed.name) return parsed.name;
    } catch {
      // Not JSON, use first ~60 chars
      const clean = run.execution_argument.replace(/[{}"]/g, '').trim();
      if (clean.length > 0 && clean.length < 80) return clean;
    }
  }
  
  return `Execution ${run.execution_id?.slice(0, 8) || '—'}`;
};

const getRunSubtitle = (run: AgentRun): string => {
  const parts: string[] = [];
  if (run.execution_source) parts.push(run.execution_source);
  if (run.result) {
    try {
      const parsed = JSON.parse(run.result);
      if (parsed.message) parts.push(parsed.message);
    } catch {
      if (run.result.length < 100) parts.push(run.result);
    }
  }
  return parts.join(' · ') || 'Agent execution';
};

interface AgentActivityFeedProps {
  runs: AgentRun[];
  onRunClick?: (run: AgentRun) => void;
}

const AgentActivityFeed = ({ runs, onRunClick }: AgentActivityFeedProps) => {
  if (runs.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Activity size={40} style={{ color: 'hsl(var(--muted-foreground))', marginBottom: 12 }} />
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem' }}>
          No agent activity found
        </Typography>
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mt: 0.5, opacity: 0.7 }}>
          The agent hasn't performed any actions yet
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {runs.map((run, idx) => {
        const statusCfg = STATUS_CONFIG[run.status?.toUpperCase() || ''] || STATUS_CONFIG.WAITING;
        const iconColor = getRunIconColor(run);
        const duration = formatDuration(run);
        
        return (
          <motion.div
            key={run.execution_id || idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
          >
            <Box
              onClick={() => onRunClick?.(run)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2.5,
                py: 2,
                borderRadius: 2,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--card))',
                cursor: onRunClick ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: 'hsl(var(--muted-foreground) / 0.3)',
                  bgcolor: 'hsla(var(--card) / 0.9)',
                },
              }}
            >
              {/* Icon */}
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${iconColor}15`,
                color: iconColor,
                flexShrink: 0,
              }}>
                {getRunIcon(run)}
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                  <Typography sx={{
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    color: 'hsl(var(--foreground))',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {getRunTitle(run)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', color: statusCfg.color }}>
                    {statusCfg.icon}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{
                    fontSize: '0.78rem',
                    color: 'hsl(var(--muted-foreground))',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 300,
                  }}>
                    {getRunSubtitle(run)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
                    {run.started_at ? getTimeAgo(run.started_at) : '—'}
                  </Typography>
                  {duration && (
                    <>
                      <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', opacity: 0.4 }}>·</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
                        {duration}
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>

              {/* Arrow */}
              <ChevronRight size={18} style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.5, flexShrink: 0 }} />
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
};

export default AgentActivityFeed;
