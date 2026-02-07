/**
 * Agent Activity Stats - right sidebar with stats cards
 */

import { Box, Typography, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  TrendingUp,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { AgentActivityStats as Stats } from '@/hooks/useAgentActivity';

interface AgentActivityStatsProps {
  stats: Stats;
}

const StatCard = ({ 
  icon, 
  label, 
  value, 
  color,
  delay = 0,
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  color: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
  >
    <Paper sx={{
      px: 2.5,
      py: 2,
      bgcolor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: `${color}15`,
          color,
        }}>
          {icon}
        </Box>
      </Box>
      <Box>
        <Typography sx={{ 
          fontSize: '1.5rem', 
          fontWeight: 700, 
          color: 'hsl(var(--foreground))',
          lineHeight: 1.1,
        }}>
          {value}
        </Typography>
        <Typography sx={{ 
          fontSize: '0.75rem', 
          color: 'hsl(var(--muted-foreground))',
          mt: 0.25,
        }}>
          {label}
        </Typography>
      </Box>
    </Paper>
  </motion.div>
);

const AgentActivityStatsPanel = ({ stats }: AgentActivityStatsProps) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Stats grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <StatCard
          icon={<CheckCircle size={16} />}
          label="Tasks Completed"
          value={String(stats.successCount)}
          color="hsl(var(--severity-low))"
          delay={0}
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          color="hsl(var(--primary))"
          delay={0.05}
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Avg Duration"
          value={stats.avgDuration < 60 ? `${stats.avgDuration.toFixed(1)}s` : `${(stats.avgDuration / 60).toFixed(1)}m`}
          color="hsl(var(--severity-medium))"
          delay={0.1}
        />
        <StatCard
          icon={<MessageSquare size={16} />}
          label="Total Runs"
          value={String(stats.totalRuns)}
          color="hsl(var(--severity-info))"
          delay={0.15}
        />
      </Box>

      {/* Activity summary */}
      <Paper sx={{
        px: 2.5,
        py: 2,
        bgcolor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 2,
      }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))', mb: 1.5 }}>
          Activity Summary
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle size={14} style={{ color: 'hsl(var(--severity-low))' }} />
            <Box>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                {stats.successCount}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>
                Succeeded
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: 'hsl(var(--severity-critical))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '0.5rem', color: 'white', fontWeight: 700 }}>!</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                {stats.failedCount}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>
                Failed
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Clock size={14} style={{ color: 'hsl(var(--severity-medium))' }} />
            <Box>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                {stats.runningCount}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>
                Running
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp size={14} style={{ color: 'hsl(var(--primary))' }} />
            <Box>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                {stats.avgDuration < 60 ? `${stats.avgDuration.toFixed(1)}s` : `${(stats.avgDuration / 60).toFixed(1)}m`}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>
                Avg Duration
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default AgentActivityStatsPanel;
