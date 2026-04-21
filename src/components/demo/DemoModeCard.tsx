/**
 * The Demo Mode CTA card shown at the top of the dashboard.
 *
 * Two states:
 *   - Inactive: pitch + "Start Demo Tour" button
 *   - Active:   live counts + "Continue Tour" + "Clean up demo data"
 */

import { Box, Typography, Button, Chip, CircularProgress } from '@mui/material';
import { Sparkles, Play, Trash2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDemo } from '@/context/DemoContext';

export const DemoModeCard = () => {
  const { active, isSeeding, isCleaning, stats, startDemo, openTour, cleanup } = useDemo();

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Box
        sx={{
          mb: 4,
          borderRadius: 2.5,
          border: '1px solid hsl(var(--primary) / 0.25)',
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--primary) / 0.02))',
          p: { xs: 2, sm: 2.5 },
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            backgroundColor: 'hsl(var(--primary) / 0.15)',
            color: 'hsl(var(--primary))',
            flexShrink: 0,
          }}
        >
          <Sparkles size={22} />
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {active ? 'Demo mode is active' : 'Try the platform with sample data'}
            </Typography>
            {active && (
              <Chip
                label="ON"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: 'hsl(var(--severity-low) / 0.18)',
                  color: 'hsl(var(--severity-low))',
                  letterSpacing: '0.04em',
                }}
              />
            )}
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', mt: 0.5, lineHeight: 1.5 }}>
            {active
              ? `Sample data is loaded into your account: ${stats.incidents} incidents, ${stats.assets} assets, ${stats.users} users. Take the tour to see how everything works, then clean up when you're done.`
              : "See how Shuffle handles incidents, assets, vulnerabilities, and AI agent activity — no setup required. We'll seed sample data into your account and walk you through it."}
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          {active ? (
            <>
              <Button
                onClick={openTour}
                variant="contained"
                size="small"
                startIcon={<Play size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  px: 2,
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                  '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)', boxShadow: 'none' },
                }}
              >
                Continue tour
              </Button>
              <Button
                onClick={cleanup}
                disabled={isCleaning}
                variant="outlined"
                size="small"
                startIcon={isCleaning ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : <Trash2 size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  px: 2,
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    borderColor: 'hsl(var(--destructive) / 0.5)',
                    backgroundColor: 'hsl(var(--destructive) / 0.06)',
                    color: 'hsl(var(--destructive))',
                  },
                }}
              >
                {isCleaning ? 'Cleaning…' : 'Clean up demo data'}
              </Button>
            </>
          ) : (
            <Button
              onClick={startDemo}
              disabled={isSeeding}
              variant="contained"
              size="medium"
              endIcon={isSeeding ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <ArrowRight size={16} />}
              sx={{
                textTransform: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                px: 2.5,
                py: 1,
                boxShadow: 'none',
                whiteSpace: 'nowrap',
                width: { xs: '100%', sm: 'auto' },
                '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)', boxShadow: 'none' },
              }}
            >
              {isSeeding ? 'Seeding sample data…' : 'Start demo tour'}
            </Button>
          )}
        </Box>
      </Box>
    </motion.div>
  );
};

export default DemoModeCard;
