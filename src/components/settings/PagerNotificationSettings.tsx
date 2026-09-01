import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  Button,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import {
  Bell,
  PhoneCall,
  Volume2,
  Vibrate,
  Clock,
  Radio,
  CheckCircle,
  AlertCircle,
  Bot,
  Info,
  Send,
  Zap,
} from 'lucide-react';
import {
  getPagerSettings,
  savePagerSettings,
  PagerSettings,
  requestNotificationPermissions,
  playTestSiren,
  testPagerCall,
  triggerAgentRequestLocalAlert,
  triggerGeneralLocalAlert,
  dispatchCriticalPage,
  dispatchAgentRequestNotification,
  dispatchGeneralNotification,
  NotificationType,
} from '@/services/pagerNotificationService';
import { isCapacitorNative } from '@/Shuffle-MCPs/api';

export const PagerNotificationSettings = () => {
  const [settings, setSettings] = useState<PagerSettings>(getPagerSettings());
  const [isPlayingTestSiren, setIsPlayingTestSiren] = useState(false);
  const [sendingType, setSendingType] = useState<NotificationType | null>(null);
  const [permissionMsg, setPermissionMsg] = useState<string | null>(null);

  useEffect(() => {
    setSettings(getPagerSettings());

    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent<PagerSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };

    window.addEventListener('shuffle:pager-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('shuffle:pager-settings-changed', handleSettingsChange);
  }, []);

  const handleToggleCalling = (enabled: boolean) => {
    const next = savePagerSettings({ pagerCallingEnabled: enabled });
    setSettings(next);
  };

  const handleToggleSound = (enabled: boolean) => {
    const next = savePagerSettings({ sirenSoundEnabled: enabled });
    setSettings(next);
  };

  const handleToggleVibration = (enabled: boolean) => {
    const next = savePagerSettings({ vibrationEnabled: enabled });
    setSettings(next);
  };

  const handleTimeoutChange = (seconds: number) => {
    const next = savePagerSettings({ autoEscalateTimeoutSeconds: seconds });
    setSettings(next);
  };

  const handleRequestPermissions = async () => {
    setPermissionMsg(null);
    const granted = await requestNotificationPermissions();
    if (granted) {
      setPermissionMsg('Notification permissions granted successfully.');
    } else {
      setPermissionMsg('Notification permission was denied or dismissed. Please enable notifications in device settings.');
    }
    setSettings(getPagerSettings());
  };

  const handleTestAudio = () => {
    setIsPlayingTestSiren(true);
    playTestSiren(2200);
    setTimeout(() => {
      setIsPlayingTestSiren(false);
    }, 2300);
  };

  const handleTestRemotePush = async (type: NotificationType) => {
    if (!settings.pushToken) {
      setPermissionMsg('No device push token available. Please grant push permissions first.');
      return;
    }

    setSendingType(type);
    setPermissionMsg(null);
    try {
      let res;
      if (type === 'critical') {
        res = await dispatchCriticalPage({
          incidentId: `test-${Date.now()}`,
          title: 'Remote Pager API Verification Test',
          source: 'Shuffle API (/api/v1/functions/pager)',
          targetToken: settings.pushToken,
          severity: 'critical',
          tier: 1,
          autoEscalateSeconds: settings.autoEscalateTimeoutSeconds || 60,
        });
      } else if (type === 'agent_request') {
        res = await dispatchAgentRequestNotification({
          title: 'AI Agent - Input Required: Confirm IP Block',
          executionId: `exec-${Date.now()}`,
          workflowId: 'wf-isolate-host',
          action: 'approve_containment',
          targetToken: settings.pushToken,
          body: 'Subagent detected suspicious brute-force activity. Confirmation needed to isolate host.',
        });
      } else {
        res = await dispatchGeneralNotification({
          title: 'Weekly SOC Report Available',
          body: 'The automated weekly security posture report has been compiled.',
          referenceUrl: '/reports/weekly',
          targetToken: settings.pushToken,
        });
      }

      if (res.success) {
        setPermissionMsg(`Remote ${type} notification dispatched successfully to ${res.dispatched_to || 1} device(s) via API.`);
      } else {
        setPermissionMsg(`Dispatch error: ${res.error || 'Failed to dispatch via API'}`);
      }
    } catch (err) {
      setPermissionMsg(`Dispatch error: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setSendingType(null);
    }
  };

  const handleSimulateAgentRequest = () => {
    triggerAgentRequestLocalAlert({
      title: 'AI Agent - Input Required: Confirm IP Block',
      body: 'Subagent detected suspicious brute-force activity. Confirmation needed to isolate host.',
      executionId: `exec-${Date.now()}`,
      workflowId: 'wf-isolate-host',
      action: 'approve_containment',
    });
    setPermissionMsg('Simulated AI Agent request notification (audio chime + banner).');
  };

  const handleSimulateGeneral = () => {
    triggerGeneralLocalAlert({
      title: 'Workflow Completed: Daily SOC Backup',
      description: 'The automated nightly backup snapshot completed with 0 errors.',
      referenceUrl: '/workflows/backup',
    });
    setPermissionMsg('Simulated General FYI notification (audio chime + banner).');
  };

  const isNative = isCapacitorNative();
  const isGranted = settings.permissionStatus === 'granted';

  return (
    <Paper
      sx={{
        p: { xs: 2.5, sm: 3.5 },
        bgcolor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {/* Section Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: 'hsl(var(--primary) / 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--primary))',
            }}
          >
            <PhoneCall size={22} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', fontSize: '1.1rem' }}>
              On-Call Pager & Emergency Calling
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Configure how Shuffle alerts and rings your device during critical incident escalations.
            </Typography>
          </Box>
        </Box>

        <Chip
          icon={settings.pagerCallingEnabled ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          label={settings.pagerCallingEnabled ? 'Pager Active' : 'Pager Disabled'}
          size="small"
          sx={{
            fontWeight: 600,
            bgcolor: settings.pagerCallingEnabled ? 'rgba(22, 163, 74, 0.15)' : 'hsl(var(--muted))',
            color: settings.pagerCallingEnabled ? '#16A34A' : 'hsl(var(--muted-foreground))',
            border: `1px solid ${settings.pagerCallingEnabled ? 'rgba(22, 163, 74, 0.3)' : 'hsl(var(--border))'}`,
          }}
        />
      </Box>

      {permissionMsg && (
        <Alert
          severity={isGranted ? 'success' : 'warning'}
          onClose={() => setPermissionMsg(null)}
          sx={{ borderRadius: 2 }}
        >
          {permissionMsg}
        </Alert>
      )}

      {/* Main Switch: Enable Pager Calling */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderRadius: 2,
          bgcolor: 'hsl(var(--background))',
          border: '1px solid hsl(var(--border))',
        }}
      >
        <Box sx={{ pr: 2 }}>
          <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', mb: 0.25 }}>
            Enable Incoming Pager Calls
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.825rem' }}>
            When enabled, critical incidents trigger high-urgency ringing and a full-screen response interface.
          </Typography>
        </Box>
        <Switch
          checked={settings.pagerCallingEnabled}
          onChange={(e) => handleToggleCalling(e.target.checked)}
          color="primary"
        />
      </Box>

      {/* Granular Preferences */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, opacity: settings.pagerCallingEnabled ? 1 : 0.45, pointerEvents: settings.pagerCallingEnabled ? 'auto' : 'none' }}>
        {/* Loud Audio Siren */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Volume2 size={18} color="hsl(var(--muted-foreground))" />
            <Box>
              <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', fontSize: '0.9rem' }}>
                Emergency Siren & Ringtone
              </Typography>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                Loud dual-oscillator siren tone that loops until acknowledged.
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={handleTestAudio}
              disabled={isPlayingTestSiren}
              startIcon={<Volume2 size={14} />}
              sx={{
                height: 32,
                fontSize: '0.75rem',
                textTransform: 'none',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                '&:hover': { borderColor: 'hsl(var(--primary))' },
              }}
            >
              {isPlayingTestSiren ? 'Playing...' : 'Test Siren'}
            </Button>
            <Switch
              checked={settings.sirenSoundEnabled}
              onChange={(e) => handleToggleSound(e.target.checked)}
              color="primary"
              size="small"
            />
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'hsl(var(--border))' }} />

        {/* Haptic Vibration */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Vibrate size={18} color="hsl(var(--muted-foreground))" />
            <Box>
              <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', fontSize: '0.9rem' }}>
                Haptic Vibration Pattern
              </Typography>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                Continuous pulsing haptic vibration while the device is ringing.
              </Typography>
            </Box>
          </Box>
          <Switch
            checked={settings.vibrationEnabled}
            onChange={(e) => handleToggleVibration(e.target.checked)}
            color="primary"
            size="small"
          />
        </Box>

        <Divider sx={{ borderColor: 'hsl(var(--border))' }} />

        {/* Auto-Escalation Ring Duration */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Clock size={18} color="hsl(var(--muted-foreground))" />
            <Box>
              <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', fontSize: '0.9rem' }}>
                Ring Duration Before Auto-Escalation
              </Typography>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                If unacknowledged after this timeout, the alert passes to the next on-call tier.
              </Typography>
            </Box>
          </Box>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={settings.autoEscalateTimeoutSeconds || 60}
              onChange={(e) => handleTimeoutChange(Number(e.target.value))}
              sx={{
                height: 36,
                fontSize: '0.85rem',
                color: 'hsl(var(--foreground))',
                '& fieldset': { borderColor: 'hsl(var(--border))' },
                '&:hover fieldset': { borderColor: 'hsl(var(--primary))' },
              }}
            >
              <MenuItem value={30}>30 seconds</MenuItem>
              <MenuItem value={60}>60 seconds (Standard)</MenuItem>
              <MenuItem value={120}>2 minutes</MenuItem>
              <MenuItem value={300}>5 minutes</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Push Permissions Status & Action */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          pt: 1,
          borderTop: '1px solid hsl(var(--border))',
        }}
      >
        <Button
          variant="outlined"
          onClick={handleRequestPermissions}
          startIcon={<Bell size={16} />}
          sx={{
            height: 40,
            fontSize: '0.85rem',
            textTransform: 'none',
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.08)' },
          }}
        >
          {isGranted ? 'Push Permissions Active' : 'Request Push Permissions'}
        </Button>

        {Boolean(settings.pushToken) && (
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>
            Token: {settings.pushToken?.slice(0, 16)}...
          </Typography>
        )}
      </Box>

      {/* ── Notification Test Suite (Critical, Agent Request, General) ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, borderTop: '1px solid hsl(var(--border))' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Zap size={18} color="hsl(var(--primary))" />
          <Typography sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', fontSize: '0.95rem' }}>
            Interactive Notification Testing Suite
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', mt: -1 }}>
          Test both local in-browser / desktop alerts and remote real-device push delivery via POST /api/v1/functions/pager.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          {/* Card 1: Critical Pager */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'hsl(var(--card))',
              borderColor: 'hsl(var(--destructive) / 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: 'hsl(var(--destructive))' }}>
                  1. Critical Pager
                </Typography>
                <Chip label="Emergency Siren" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                Outage / downtime alert. Triggers emergency audio siren, continuous vibration, and full-screen call response.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={testPagerCall}
                startIcon={<Radio size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  bgcolor: 'hsl(var(--destructive))',
                  color: '#fff',
                  '&:hover': { bgcolor: 'hsl(var(--destructive) / 0.85)' },
                }}
              >
                Simulate Call Modal
              </Button>
              {Boolean(settings.pushToken) && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleTestRemotePush('critical')}
                  disabled={sendingType === 'critical'}
                  startIcon={<Send size={14} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    borderColor: 'hsl(var(--destructive) / 0.6)',
                    color: 'hsl(var(--destructive))',
                    '&:hover': { bgcolor: 'hsl(var(--destructive) / 0.08)' },
                  }}
                >
                  {sendingType === 'critical' ? 'Dispatching...' : 'Remote Push API'}
                </Button>
              )}
            </Box>
          </Paper>

          {/* Card 2: Agent Request */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'hsl(var(--card))',
              borderColor: 'hsl(var(--primary) / 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: 'hsl(var(--primary))' }}>
                  2. Agent Request
                </Typography>
                <Chip label="User Input" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                Low-severity notification for when an AI agent requests user review, verification, or approval.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleSimulateAgentRequest}
                startIcon={<Bot size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  bgcolor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  '&:hover': { bgcolor: 'hsl(var(--primary) / 0.85)' },
                }}
              >
                Simulate Agent Banner
              </Button>
              {Boolean(settings.pushToken) && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleTestRemotePush('agent_request')}
                  disabled={sendingType === 'agent_request'}
                  startIcon={<Send size={14} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    borderColor: 'hsl(var(--primary) / 0.6)',
                    color: 'hsl(var(--primary))',
                    '&:hover': { bgcolor: 'hsl(var(--primary) / 0.08)' },
                  }}
                >
                  {sendingType === 'agent_request' ? 'Dispatching...' : 'Remote Push API'}
                </Button>
              )}
            </Box>
          </Paper>

          {/* Card 3: General Notification */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'hsl(var(--card))',
              borderColor: 'hsl(var(--border))',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: 'hsl(var(--foreground))' }}>
                  3. General FYI
                </Typography>
                <Chip label="Info Banner" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                Standard informational notification for completed workflows, schedule rotations, and reports.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleSimulateGeneral}
                startIcon={<Info size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  '&:hover': { bgcolor: 'hsl(var(--foreground) / 0.05)' },
                }}
              >
                Simulate FYI Banner
              </Button>
              {Boolean(settings.pushToken) && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleTestRemotePush('general')}
                  disabled={sendingType === 'general'}
                  startIcon={<Send size={14} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    '&:hover': { bgcolor: 'hsl(var(--foreground) / 0.05)' },
                  }}
                >
                  {sendingType === 'general' ? 'Dispatching...' : 'Remote Push API'}
                </Button>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Paper>
  );
};
