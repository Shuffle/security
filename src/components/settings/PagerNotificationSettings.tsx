import { useState, useEffect, ReactNode } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  Button,
  FormControl,
  Select,
  MenuItem,
  Divider,
  Alert,
  TextField,
  Collapse,
  IconButton,
} from '@mui/material';
import { ChevronDown } from 'lucide-react';
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
  getStoredVapidKey,
  saveStoredVapidKey,
  registerFirebaseWebPush,
} from '@/services/pagerNotificationService';
import { isCapacitorNative } from '@/Shuffle-MCPs/api';

const rowSx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
  gap: 2,
};

const outlinedButtonSx = {
  height: 36,
  textTransform: 'none' as const,
  fontSize: '0.8rem',
  borderColor: 'hsl(var(--border))',
  color: 'hsl(var(--foreground))',
  '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.06)' },
};

interface SectionProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  expanded: boolean;
  onExpandToggle: () => void;
  children: ReactNode;
}

const NotificationSection = ({
  title,
  description,
  enabled,
  onToggle,
  expanded,
  onExpandToggle,
  children,
}: SectionProps) => (
  <Box
    sx={{
      border: '1px solid hsl(var(--border))',
      borderRadius: 2,
      bgcolor: 'hsl(var(--muted) / 0.15)',
    }}
  >
    <Box sx={{ ...rowSx, p: 2, cursor: 'pointer' }} onClick={onExpandToggle}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onExpandToggle();
          }}
          sx={{
            color: 'hsl(var(--muted-foreground))',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        >
          <ChevronDown size={16} />
        </IconButton>
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.92rem', color: 'hsl(var(--foreground))' }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            {description}
          </Typography>
        </Box>
      </Box>
      <Switch
        checked={enabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onToggle(e.target.checked)}
        color="primary"
        size="small"
      />
    </Box>

    <Collapse in={expanded} unmountOnExit>
      <Divider sx={{ borderColor: 'hsl(var(--border))' }} />
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
    </Collapse>
  </Box>
);

const SettingRow = ({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
}) => (
  <Box sx={rowSx}>
    <Box>
      <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>{label}</Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          {hint}
        </Typography>
      )}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>{control}</Box>
  </Box>
);

export const PagerNotificationSettings = () => {
  const [settings, setSettings] = useState<PagerSettings>(getPagerSettings());
  const [isPlayingTestSiren, setIsPlayingTestSiren] = useState(false);
  const [sendingType, setSendingType] = useState<NotificationType | null>(null);
  const [permissionMsg, setPermissionMsg] = useState<string | null>(null);
  const [vapidKey, setVapidKey] = useState<string>(getStoredVapidKey());
  const [isRegisteringWebPush, setIsRegisteringWebPush] = useState(false);
  const [expanded, setExpanded] = useState<NotificationType | null>(null);

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

  const update = (patch: Partial<PagerSettings>) => {
    setSettings(savePagerSettings(patch));
  };

  const toggleExpanded = (type: NotificationType) => {
    setExpanded((current) => (current === type ? null : type));
  };

  const handleRequestPermissions = async () => {
    setPermissionMsg(null);
    const granted = await requestNotificationPermissions();
    setPermissionMsg(
      granted
        ? 'Notification permissions granted.'
        : 'Notification permission was denied. Please enable notifications in your device settings.',
    );
    setSettings(getPagerSettings());
  };

  const handleTestAudio = () => {
    setIsPlayingTestSiren(true);
    playTestSiren(2200);
    setTimeout(() => setIsPlayingTestSiren(false), 2300);
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
        setPermissionMsg(`Remote notification dispatched to ${res.dispatched_to || 1} device(s).`);
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
  };

  const handleSimulateGeneral = () => {
    triggerGeneralLocalAlert({
      title: 'Workflow Completed: Daily SOC Backup',
      description: 'The automated nightly backup snapshot completed with 0 errors.',
      referenceUrl: '/workflows/backup',
    });
  };

  const handleRegisterWebPush = async () => {
    if (!vapidKey.trim()) {
      setPermissionMsg('Please paste a valid Firebase VAPID Web Push public key.');
      return;
    }

    setIsRegisteringWebPush(true);
    setPermissionMsg(null);
    try {
      saveStoredVapidKey(vapidKey);
      const token = await registerFirebaseWebPush(vapidKey);
      if (token) {
        savePagerSettings({ pushToken: token, permissionStatus: 'granted' });
        setSettings(getPagerSettings());
        setPermissionMsg('Web push token registered for this browser.');
      } else {
        setPermissionMsg('Failed to register web push. Ensure notifications are allowed and the VAPID key matches Firebase.');
      }
    } catch (err) {
      setPermissionMsg(`Web push registration error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRegisteringWebPush(false);
    }
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
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', fontSize: '1.1rem' }}>
          Notifications
        </Typography>
        <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          Control how and when Shuffle reaches out to you.
        </Typography>
      </Box>

      {permissionMsg && (
        <Alert
          severity={
            permissionMsg.toLowerCase().includes('error') ||
            permissionMsg.toLowerCase().includes('fail') ||
            permissionMsg.toLowerCase().includes('denied')
              ? 'error'
              : 'info'
          }
          onClose={() => setPermissionMsg(null)}
          sx={{ fontSize: '0.85rem' }}
        >
          {permissionMsg}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Critical Pager */}
        <NotificationSection
          title="Critical Pager"
          description="Full-screen call for critical incidents and downtime."
          enabled={settings.pagerCallingEnabled}
          onToggle={(value) => update({ pagerCallingEnabled: value })}
          expanded={expanded === 'critical'}
          onExpandToggle={() => toggleExpanded('critical')}
        >
          <SettingRow
            label="Emergency siren"
            hint="Plays escalating siren audio while ringing."
            control={
              <>
                <Button variant="outlined" size="small" onClick={handleTestAudio} disabled={isPlayingTestSiren} sx={outlinedButtonSx}>
                  {isPlayingTestSiren ? 'Playing' : 'Test'}
                </Button>
                <Switch
                  checked={settings.sirenSoundEnabled}
                  onChange={(e) => update({ sirenSoundEnabled: e.target.checked })}
                  color="primary"
                  size="small"
                />
              </>
            }
          />

          <SettingRow
            label="Vibration"
            hint="Continuous haptic pulse while the device is ringing."
            control={
              <Switch
                checked={settings.vibrationEnabled}
                onChange={(e) => update({ vibrationEnabled: e.target.checked })}
                color="primary"
                size="small"
              />
            }
          />

          <SettingRow
            label="Ring duration before escalation"
            hint="Unacknowledged alerts pass to the next on-call tier."
            control={
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={settings.autoEscalateTimeoutSeconds || 60}
                  onChange={(e) => update({ autoEscalateTimeoutSeconds: Number(e.target.value) })}
                  sx={{
                    height: 36,
                    fontSize: '0.85rem',
                    color: 'hsl(var(--foreground))',
                    '& fieldset': { borderColor: 'hsl(var(--border))' },
                  }}
                >
                  <MenuItem value={30}>30 seconds</MenuItem>
                  <MenuItem value={60}>60 seconds</MenuItem>
                  <MenuItem value={120}>2 minutes</MenuItem>
                  <MenuItem value={300}>5 minutes</MenuItem>
                </Select>
              </FormControl>
            }
          />

          <SettingRow
            label="Test delivery"
            control={
              <>
                <Button variant="outlined" size="small" onClick={testPagerCall} sx={outlinedButtonSx}>
                  Simulate call
                </Button>
                {Boolean(settings.pushToken) && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleTestRemotePush('critical')}
                    disabled={sendingType === 'critical'}
                    sx={outlinedButtonSx}
                  >
                    {sendingType === 'critical' ? 'Sending' : 'Send push'}
                  </Button>
                )}
              </>
            }
          />
        </NotificationSection>

        {/* Agent Request */}
        <NotificationSection
          title="Agent Request"
          description="Alerts when an AI agent needs your review or approval."
          enabled={settings.agentRequestEnabled}
          onToggle={(value) => update({ agentRequestEnabled: value })}
          expanded={expanded === 'agent_request'}
          onExpandToggle={() => toggleExpanded('agent_request')}
        >
          <SettingRow
            label="Sound"
            hint="Plays a short chime when an agent asks for input."
            control={
              <Switch
                checked={settings.agentRequestSoundEnabled}
                onChange={(e) => update({ agentRequestSoundEnabled: e.target.checked })}
                color="primary"
                size="small"
              />
            }
          />

          <SettingRow
            label="Test delivery"
            control={
              <>
                <Button variant="outlined" size="small" onClick={handleSimulateAgentRequest} sx={outlinedButtonSx}>
                  Simulate
                </Button>
                {Boolean(settings.pushToken) && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleTestRemotePush('agent_request')}
                    disabled={sendingType === 'agent_request'}
                    sx={outlinedButtonSx}
                  >
                    {sendingType === 'agent_request' ? 'Sending' : 'Send push'}
                  </Button>
                )}
              </>
            }
          />
        </NotificationSection>

        {/* General Notifications */}
        <NotificationSection
          title="General Notifications"
          description="Completed workflows, rotations, and reports."
          enabled={settings.generalNotificationsEnabled}
          onToggle={(value) => update({ generalNotificationsEnabled: value })}
          expanded={expanded === 'general'}
          onExpandToggle={() => toggleExpanded('general')}
        >
          <SettingRow
            label="Sound"
            hint="Plays a short chime for informational updates."
            control={
              <Switch
                checked={settings.generalSoundEnabled}
                onChange={(e) => update({ generalSoundEnabled: e.target.checked })}
                color="primary"
                size="small"
              />
            }
          />

          <SettingRow
            label="Test delivery"
            control={
              <>
                <Button variant="outlined" size="small" onClick={handleSimulateGeneral} sx={outlinedButtonSx}>
                  Simulate
                </Button>
                {Boolean(settings.pushToken) && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleTestRemotePush('general')}
                    disabled={sendingType === 'general'}
                    sx={outlinedButtonSx}
                  >
                    {sendingType === 'general' ? 'Sending' : 'Send push'}
                  </Button>
                )}
              </>
            }
          />
        </NotificationSection>
      </Box>

      {/* Device delivery */}
      <Box sx={{ pt: 1, borderTop: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SettingRow
          label="Device push"
          hint={
            isGranted
              ? settings.pushToken
                ? `Registered (${settings.pushToken.slice(0, 16)}...)`
                : 'Permissions granted.'
              : 'Not registered on this device.'
          }
          control={
            <Button variant="outlined" size="small" onClick={handleRequestPermissions} sx={outlinedButtonSx}>
              {isGranted ? 'Permissions active' : 'Request permissions'}
            </Button>
          }
        />

      </Box>
    </Paper>
  );
};
