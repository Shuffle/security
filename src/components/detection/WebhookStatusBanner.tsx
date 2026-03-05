import { Box, Typography, Button, CircularProgress } from '@mui/material';
import WebhookIcon from '@mui/icons-material/Webhook';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import { toast } from 'sonner';

/**
 * Shared banner that shows whether the Ingestion Webhook is active.
 * If inactive, provides a one-click enable button.
 */
const WebhookStatusBanner = () => {
  const { exists, enabled, isLoading, enable, isEnabling } = useWebhookStatus();

  // Don't render while loading
  if (isLoading) return null;

  // Webhook is active — show a subtle confirmation
  if (exists && enabled) {
    return (
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderRadius: 1.5,
        border: '1px solid rgba(34, 197, 94, 0.2)',
        bgcolor: 'rgba(34, 197, 94, 0.06)',
      }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 16, color: '#22c55e' }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 500 }}>
          Ingestion Webhook active
        </Typography>
      </Box>
    );
  }

  // Webhook missing or stopped — show warning with enable button
  const handleEnable = async () => {
    try {
      await enable();
      toast.success('Ingestion Webhook enabled');
    } catch {
      toast.error('Failed to enable webhook');
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 2,
      py: 1,
      borderRadius: 1.5,
      border: '1px solid rgba(255, 152, 0, 0.25)',
      bgcolor: 'rgba(255, 152, 0, 0.06)',
    }}>
      <WebhookIcon sx={{ fontSize: 16, color: 'hsl(var(--severity-medium))' }} />
      <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500, flex: 1 }}>
        Ingestion Webhook is not active — detections won't forward to incidents.
      </Typography>
      <Button
        size="small"
        variant="outlined"
        disabled={isEnabling}
        onClick={handleEnable}
        startIcon={isEnabling ? <CircularProgress size={12} /> : <WebhookIcon sx={{ fontSize: 14 }} />}
        sx={{
          textTransform: 'none',
          fontSize: '0.75rem',
          fontWeight: 600,
          borderColor: 'rgba(255, 152, 0, 0.4)',
          color: 'hsl(var(--foreground))',
          whiteSpace: 'nowrap',
          '&:hover': { borderColor: 'rgba(255, 152, 0, 0.7)', bgcolor: 'rgba(255, 152, 0, 0.08)' },
        }}
      >
        {isEnabling ? 'Enabling…' : 'Enable Webhook'}
      </Button>
    </Box>
  );
};

export default WebhookStatusBanner;
