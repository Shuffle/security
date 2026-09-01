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
  Collapse,
  IconButton,
} from '@mui/material';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
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
import {
  NotificationDevice,
  DevicePreferences,
  fetchNotificationDevices,
  saveNotificationDevice,
  resolveDevicePreferences,
  getLocalDeviceId,
  getLocalDeviceName,
  getLocalDevicePlatform,
} from '@/services/notificationDevices';

const PREFERENCE_KEY: Record<NotificationType, keyof DevicePreferences> = {
  critical: 'critical_pager',
  agent_request: 'agent_requests',
  general: 'general_alerts',
};

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
  disabled?: boolean;
  onToggle: (value: boolean) => void;
  expanded: boolean;
  onExpandToggle: () => void;
  children: ReactNode;
}

const NotificationSection = ({
  title,
  description,
  enabled,
  disabled,
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
        disabled={disabled}
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

interface PermissionHelp {
  device: string;
  steps: string;
  internalUrl?: string;
  docsUrl?: string;
}

const getPermissionHelp = (): PermissionHelp => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  const isAndroid = /Android/.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isChromium = /Chrome\/|Chromium\//.test(ua) && !isEdge;
  const isSafari = /Safari\//.test(ua) && !/Chrome\/|Chromium\//.test(ua);

  if (isIOS) {
    return {
      device: 'iOS',
      steps: 'Open Settings, then Notifications, select the browser or the Shuffle app and turn on Allow Notifications. In Safari also check Settings, Apps, Safari, Advanced, Website Data permissions.',
      docsUrl: 'https://support.apple.com/en-us/HT201925',
    };
  }
  if (isAndroid) {
    return {
      device: 'Android',
      steps: 'Open Settings, then Notifications, select the browser or the Shuffle app and allow notifications. In Chrome you can also tap the lock icon in the address bar and set Notifications to Allow.',
      docsUrl: 'https://support.google.com/chrome/answer/3220216?hl=en&co=GENIE.Platform%3DAndroid',
    };
  }
  if (isEdge) {
    return {
      device: 'Microsoft Edge',
      steps: 'Open the Edge notification settings page and set this site to Allow.',
      internalUrl: 'edge://settings/content/notifications',
      docsUrl: 'https://support.microsoft.com/en-us/microsoft-edge/manage-website-notifications-in-microsoft-edge-0c555609-5bf2-479d-a59d-fb30a0b80b2b',
    };
  }
  if (isFirefox) {
    return {
      device: 'Firefox',
      steps: 'Open the Firefox permissions settings and remove the block for this site.',
      internalUrl: 'about:preferences#privacy',
      docsUrl: 'https://support.mozilla.org/en-US/kb/push-notifications-firefox',
    };
  }
  if (isSafari) {
    return {
      device: 'Safari on macOS',
      steps: 'Open Safari, then Settings, Websites, Notifications, and set this site to Allow.',
      docsUrl: 'https://support.apple.com/guide/safari/customize-website-notifications-sfri40734/mac',
    };
  }
  if (isChromium) {
    return {
      device: 'Chrome',
      steps: 'Open the Chrome notification settings page and set this site to Allow, or click the icon left of the address bar and allow notifications.',
      internalUrl: 'chrome://settings/content/notifications',
      docsUrl: 'https://support.google.com/chrome/answer/3220216?hl=en&co=GENIE.Platform%3DDesktop',
    };
  }
  return {
    device: 'this device',
    steps: 'Open your browser or system notification settings and allow notifications for this site.',
  };
};

export const PagerNotificationSettings = () => {
  const { userInfo } = useAuth();
  const [settings, setSettings] = useState<PagerSettings>(getPagerSettings());
  const [isPlayingTestSiren, setIsPlayingTestSiren] = useState(false);
  const [sendingType, setSendingType] = useState<NotificationType | null>(null);
  const [permissionMsg, setPermissionMsg] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [expanded, setExpanded] = useState<NotificationType | null>(null);
  const [devices, setDevices] = useState<NotificationDevice[]>([]);
  const [localDeviceId, setLocalDeviceId] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [savingDevice, setSavingDevice] = useState(false);

  useEffect(() => {
    const id = getLocalDeviceId();
    setLocalDeviceId(id);
    setSelectedDeviceId((current) => current || id);

    let cancelled = false;
    fetchNotificationDevices().then((remote) => {
      if (!cancelled) setDevices(remote);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const deviceList: NotificationDevice[] = localDeviceId
    ? [
        devices.find((d) => d.id === localDeviceId) || {
          id: localDeviceId,
          device_name: getLocalDeviceName(),
          platform: getLocalDevicePlatform(),
          token: settings.pushToken || undefined,
        },
        ...devices.filter((d) => d.id !== localDeviceId),
      ]
    : devices;

  const isLocalSelected = selectedDeviceId === localDeviceId;
  const selectedDevice = deviceList.find((d) => d.id === selectedDeviceId) || null;
  const remotePreferences = resolveDevicePreferences(selectedDevice);

  const deviceRegistered = Boolean(
    selectedDevice && devices.some((d) => d.id === selectedDevice.id),
  );
  const pushAvailable = isLocalSelected
    ? settings.permissionStatus === 'granted' && Boolean(settings.pushToken)
    : Boolean(selectedDevice?.token);
  const controlsAvailable = deviceRegistered && pushAvailable;

  const sectionEnabled = (type: NotificationType): boolean => {
    if (!controlsAvailable) return false;
    if (isLocalSelected) {
      if (type === 'critical') return settings.pagerCallingEnabled;
      if (type === 'agent_request') return settings.agentRequestEnabled;
      return settings.generalNotificationsEnabled;
    }
    return remotePreferences[PREFERENCE_KEY[type]];
  };

  const persistDevicePreferences = async (preferences: DevicePreferences) => {
    if (!selectedDevice) return;
    setSavingDevice(true);
    const next: NotificationDevice = {
      id: selectedDevice.id,
      token: selectedDevice.token || settings.pushToken || '',
      platform: selectedDevice.platform || getLocalDevicePlatform(),
      device_name: selectedDevice.device_name || getLocalDeviceName(),
      preferences,
    };
    setDevices((current) => {
      const others = current.filter((d) => d.id !== next.id);
      return [...others, next];
    });
    const ok = await saveNotificationDevice(userInfo?.id || '', next);
    setSavingDevice(false);
    if (!ok) {
      setPermissionMsg('Failed to save the device notification preferences.');
    }
  };

  const setSectionEnabled = (type: NotificationType, value: boolean) => {
    if (isLocalSelected) {
      if (type === 'critical') update({ pagerCallingEnabled: value });
      else if (type === 'agent_request') update({ agentRequestEnabled: value });
      else update({ generalNotificationsEnabled: value });
    }
    void persistDevicePreferences({
      ...remotePreferences,
      [PREFERENCE_KEY[type]]: value,
    });
  };

  const handleRequestPermissions = async () => {
    setPermissionMsg(null);
    const granted = await requestNotificationPermissions();
    setPermissionMsg(
      granted
        ? 'Notification permissions granted.'
        : 'Notification permission was denied. Please enable notifications in your device settings.',
    );
    const next = getPagerSettings();
    setSettings(next);

    if (granted && localDeviceId && userInfo?.id) {
      const existing = devices.find((d) => d.id === localDeviceId);
      void saveNotificationDevice(userInfo.id, {
        id: localDeviceId,
        token: next.pushToken || existing?.token || '',
        platform: getLocalDevicePlatform(),
        device_name: existing?.device_name || getLocalDeviceName(),
        preferences: resolveDevicePreferences(existing),
      }).then(() => fetchNotificationDevices().then(setDevices));
    }
  };

  const permissionHelp = getPermissionHelp();

  const handleCopySettingsPath = async () => {
    if (!permissionHelp.internalUrl) return;
    try {
      await navigator.clipboard.writeText(permissionHelp.internalUrl);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch {
      setCopiedPath(false);
    }
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
      <Box sx={{ ...rowSx, alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', fontSize: '1.1rem' }}>
            Notifications
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Control how and when Shuffle reaches out to you.
          </Typography>
        </Box>

        {deviceList.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(String(e.target.value))}
              disabled={savingDevice}
              sx={{
                height: 30,
                fontSize: '0.78rem',
                color: 'hsl(var(--foreground))',
                '& fieldset': { borderColor: 'hsl(var(--border))' },
              }}
            >
              {deviceList.map((device) => (
                <MenuItem key={device.id} value={device.id}>
                  {(device.device_name || device.id) +
                    (device.id === localDeviceId ? ' (this device)' : '')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
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

          {permissionMsg.toLowerCase().includes('denied') && (
            <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'inherit' }}>
                {permissionHelp.device}: {permissionHelp.steps}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {permissionHelp.internalUrl && (
                  <>
                    <Typography
                      component="code"
                      sx={{
                        fontSize: '0.78rem',
                        px: 1,
                        py: 0.4,
                        borderRadius: 1,
                        border: '1px solid hsl(var(--border))',
                        bgcolor: 'hsl(var(--muted) / 0.4)',
                        color: 'hsl(var(--foreground))',
                      }}
                    >
                      {permissionHelp.internalUrl}
                    </Typography>
                    <Button variant="outlined" size="small" onClick={handleCopySettingsPath} sx={outlinedButtonSx}>
                      {copiedPath ? 'Copied' : 'Copy link'}
                    </Button>
                  </>
                )}
                {permissionHelp.docsUrl && (
                  <Button
                    variant="outlined"
                    size="small"
                    component="a"
                    href={permissionHelp.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={outlinedButtonSx}
                  >
                    How to enable
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Alert>

      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Critical Pager */}
        <NotificationSection
          title="Critical Pager"
          description="Full-screen call for critical incidents and downtime."
          enabled={sectionEnabled('critical')}
          disabled={!controlsAvailable}
          onToggle={(value) => setSectionEnabled('critical', value)}
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
          enabled={sectionEnabled('agent_request')}
          disabled={!controlsAvailable}
          onToggle={(value) => setSectionEnabled('agent_request', value)}
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
          enabled={sectionEnabled('general')}
          disabled={!controlsAvailable}
          onToggle={(value) => setSectionEnabled('general', value)}
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
