import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
} from '@mui/material';
import {
  PhoneCall,
  PhoneOff,
  Clock,
  Bot,
  ShieldAlert,
  Volume2,
  VolumeX,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from '@/lib/router-compat';
import {
  PagerIncident,
  dismissPagerCall,
  stopEmergencySiren,
  getPagerSettings,
} from '@/services/pagerNotificationService';

interface IncomingPagerCallModalProps {
  incident: PagerIncident | null;
  onDismiss?: () => void;
  onAcknowledge?: (incident: PagerIncident) => void;
  onEscalate?: (incident: PagerIncident) => void;
  onHandoverAgent?: (incident: PagerIncident) => void;
}

export const IncomingPagerCallModal = ({
  incident,
  onDismiss,
  onAcknowledge,
  onEscalate,
  onHandoverAgent,
}: IncomingPagerCallModalProps) => {
  const navigate = useNavigate();
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!incident) return;
    const settings = getPagerSettings();
    const duration = settings.autoEscalateTimeoutSeconds || 60;
    setSecondsRemaining(duration);
    setIsMuted(false);

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incident]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
    } else {
      stopEmergencySiren();
      setIsMuted(true);
    }
  }, [isMuted]);

  const handleAccept = useCallback(() => {
    if (!incident) return;
    dismissPagerCall(incident.id);
    if (onAcknowledge) {
      onAcknowledge(incident);
    } else {
      navigate(`/incidents/${incident.id}`);
    }
    onDismiss?.();
  }, [incident, navigate, onAcknowledge, onDismiss]);

  const handleDeclineEscalate = useCallback(() => {
    if (!incident) return;
    dismissPagerCall(incident.id);
    onEscalate?.(incident);
    onDismiss?.();
  }, [incident, onEscalate, onDismiss]);

  const handleSnooze = useCallback(() => {
    if (!incident) return;
    stopEmergencySiren();
    dismissPagerCall(incident.id);
    onDismiss?.();
  }, [incident, onDismiss]);

  const handleHandoverAgent = useCallback(() => {
    if (!incident) return;
    dismissPagerCall(incident.id);
    onHandoverAgent?.(incident);
    navigate(`/agent?incidentId=${incident.id}`);
    onDismiss?.();
  }, [incident, navigate, onHandoverAgent, onDismiss]);

  if (!incident) return null;

  return (
    <Dialog
      open={Boolean(incident)}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: { xs: 3, sm: 5 },
            position: 'relative',
            overflow: 'hidden',
          },
        },
      }}
    >
      {/* Background pulsing radar ring */}
      <Box
        component={motion.div}
        animate={{
          scale: [1, 1.4, 1.8],
          opacity: [0.35, 0.15, 0],
        }}
        transition={{
          duration: 2.2,
          repeat: Infinity,
          ease: 'easeOut',
        }}
        sx={{
          position: 'absolute',
          top: '32%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: 260, sm: 380 },
          height: { xs: 260, sm: 380 },
          borderRadius: '50%',
          border: '3px solid #FF4433',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Top Header Controls */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1,
          pt: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Radio size={18} color="#FF6600" className="animate-pulse" />
          <Typography
            variant="overline"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.75rem',
            }}
          >
            LIVE ON-CALL ESCALATION
          </Typography>
        </Box>

        <IconButton
          onClick={handleToggleMute}
          sx={{
            bgcolor: isMuted ? 'hsl(var(--muted))' : 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: isMuted ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
          }}
          title={isMuted ? 'Unmute' : 'Silence Siren'}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </IconButton>
      </Box>

      {/* Middle Incident Alert Body */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 580,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          my: 'auto',
          zIndex: 1,
        }}
      >
        <Box
          component={motion.div}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: 'rgba(255, 68, 51, 0.15)',
            border: '2px solid #FF4433',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
            boxShadow: '0 0 32px rgba(255, 68, 51, 0.3)',
          }}
        >
          <ShieldAlert size={40} color="#FF4433" />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip
            label={incident.severity.toUpperCase()}
            size="small"
            sx={{
              bgcolor: '#FF4433',
              color: '#FFFFFF',
              fontWeight: 700,
              letterSpacing: '0.05em',
              fontSize: '0.75rem',
            }}
          />
          {incident.source && (
            <Chip
              label={incident.source}
              size="small"
              sx={{
                bgcolor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                fontWeight: 600,
              }}
            />
          )}
          {incident.tier && (
            <Chip
              label={incident.tier}
              size="small"
              sx={{
                bgcolor: 'hsl(var(--primary) / 0.15)',
                color: 'hsl(var(--primary))',
                fontWeight: 600,
              }}
            />
          )}
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: 'hsl(var(--foreground))',
            fontSize: { xs: '1.35rem', sm: '1.75rem' },
            lineHeight: 1.25,
            mb: 1.5,
          }}
        >
          {incident.title}
        </Typography>

        {incident.description && (
          <Typography
            variant="body2"
            sx={{
              color: 'hsl(var(--muted-foreground))',
              maxWidth: 480,
              mb: 3,
              fontSize: '0.875rem',
            }}
          >
            {incident.description}
          </Typography>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 0.75,
            borderRadius: 3,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <Clock size={16} color="hsl(var(--muted-foreground))" />
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>
            Auto-escalating in {secondsRemaining}s
          </Typography>
        </Box>
      </Box>

      {/* Bottom Call Controls */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 580,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          zIndex: 1,
          pb: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Main Primary Action: Accept / Acknowledge */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleAccept}
          startIcon={<PhoneCall size={22} />}
          sx={{
            height: 58,
            borderRadius: 3,
            bgcolor: '#16A34A',
            color: '#FFFFFF',
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            boxShadow: '0 8px 24px rgba(22, 163, 74, 0.35)',
            '&:hover': {
              bgcolor: '#15803D',
            },
            '&:active': {
              transform: 'scale(0.98)',
            },
          }}
        >
          Acknowledge & Open Incident
        </Button>

        {/* Secondary Grid Actions */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
          }}
        >
          <Button
            variant="outlined"
            size="large"
            onClick={handleHandoverAgent}
            startIcon={<Bot size={18} />}
            sx={{
              height: 48,
              borderRadius: 2.5,
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              fontWeight: 600,
              bgcolor: 'hsl(var(--card))',
              '&:hover': {
                borderColor: 'hsl(var(--primary))',
                bgcolor: 'hsl(var(--primary) / 0.1)',
              },
            }}
          >
            Handover to AI Agent
          </Button>

          <Button
            variant="outlined"
            size="large"
            onClick={handleDeclineEscalate}
            startIcon={<PhoneOff size={18} />}
            sx={{
              height: 48,
              borderRadius: 2.5,
              borderColor: 'rgba(239, 68, 68, 0.4)',
              color: '#EF4444',
              fontWeight: 600,
              bgcolor: 'rgba(239, 68, 68, 0.05)',
              '&:hover': {
                borderColor: '#EF4444',
                bgcolor: 'rgba(239, 68, 68, 0.15)',
              },
            }}
          >
            Decline & Escalate
          </Button>
        </Box>

        {/* Tertiary Snooze Action */}
        <Button
          variant="text"
          size="small"
          onClick={handleSnooze}
          startIcon={<Clock size={16} />}
          sx={{
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'none',
            fontSize: '0.8rem',
            alignSelf: 'center',
            '&:hover': { color: 'hsl(var(--foreground))' },
          }}
        >
          Snooze Alert (5 minutes)
        </Button>
      </Box>
    </Dialog>
  );
};
