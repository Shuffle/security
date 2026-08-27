import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  Button,
  Chip,
  Avatar,
  Divider,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  PhoneCall,
  Volume2,
  Clock,
  Radio,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  UserX,
  Layers,
  Power,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { getDatastoreItem, setDatastoreItem, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import {
  getPagerSettings,
  savePagerSettings,
  type PagerSettings,
  playTestSiren,
  testPagerCall,
} from '@/services/pagerNotificationService';
import { ComponentErrorBoundary } from '@/components/common/ComponentErrorBoundary';
import type {
  AssignmentConfig,
  UserSchedule,
  EscalationLevel,
} from '@/components/users/OnCallScheduleManager';
import {
  computeDefaultPolicy,
  ESCALATION_LABELS,
  ESCALATION_COLORS,
} from '@/components/users/OnCallScheduleManager';

interface OnCallOverviewCardProps {
  compact?: boolean;
  onScheduleUpdated?: () => void;
}

// Helper to check if a user schedule is active right now
const isScheduleActiveNow = (schedule: UserSchedule): boolean => {
  if (!schedule.enabled || !schedule.schedules || schedule.schedules.length === 0) {
    return false;
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const dateStr = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  return schedule.schedules.some((entry) => {
    if (entry.startDate && dateStr < entry.startDate) return false;
    if (entry.endDate && dateStr > entry.endDate) return false;
    if (entry.daysOfWeek && !entry.daysOfWeek.includes(dayOfWeek)) return false;

    const [sh, sm] = (entry.startTime || '00:00').split(':').map(Number);
    const [eh, em] = (entry.endTime || '23:59').split(':').map(Number);
    const startTotal = (sh || 0) * 60 + (sm || 0);
    const endTotal = (eh || 0) * 60 + (em || 0);

    if (endTotal >= startTotal) {
      return currentTotalMinutes >= startTotal && currentTotalMinutes <= endTotal;
    } else {
      // Overnight shift
      return currentTotalMinutes >= startTotal || currentTotalMinutes <= endTotal;
    }
  });
};

const OnCallOverviewCardInner = ({ compact = false, onScheduleUpdated }: OnCallOverviewCardProps) => {
  const { userInfo } = useAuth();
  const currentUserId = userInfo?.id;
  const currentUsername = userInfo?.username || 'You';

  const [config, setConfig] = useState<AssignmentConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingSelfSchedule, setSavingSelfSchedule] = useState(false);

  const [pagerSettings, setPagerSettings] = useState<PagerSettings>(getPagerSettings());
  const [isPlayingTestSiren, setIsPlayingTestSiren] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Sync pager settings
  useEffect(() => {
    setPagerSettings(getPagerSettings());
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent<PagerSettings>;
      if (customEvent.detail) {
        setPagerSettings(customEvent.detail);
      }
    };
    window.addEventListener('shuffle:pager-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('shuffle:pager-settings-changed', handleSettingsChange);
  }, []);

  // Load assignment schedules from Datastore
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const response = await getDatastoreItem('assignment_schedules', DATASTORE_CATEGORIES.CONFIGURATION);
      if (response.success && response.item?.value) {
        const data: AssignmentConfig =
          typeof response.item.value === 'string'
            ? JSON.parse(response.item.value)
            : response.item.value;
        setConfig(data);
      } else {
        setConfig({
          userSchedules: [],
          updatedAt: new Date().toISOString(),
          defaultPolicy: computeDefaultPolicy([]),
        });
      }
    } catch {
      setConfig({
        userSchedules: [],
        updatedAt: new Date().toISOString(),
        defaultPolicy: computeDefaultPolicy([]),
      });
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Determine current user's schedules
  const mySchedules = useMemo(() => {
    if (!config?.userSchedules || !currentUserId) return [];
    return config.userSchedules.filter(
      (s) =>
        s.userId === currentUserId ||
        s.userId.startsWith(`${currentUserId}::`) ||
        s.userName === currentUsername ||
        s.userEmail === currentUsername
    );
  }, [config, currentUserId, currentUsername]);

  const isMyOnCallEnabled = useMemo(() => {
    if (mySchedules.length === 0) return false;
    return mySchedules.some((s) => s.enabled);
  }, [mySchedules]);

  const isMyShiftActiveNow = useMemo(() => {
    return mySchedules.some((s) => isScheduleActiveNow(s));
  }, [mySchedules]);

  const myAssignedTiers = useMemo(() => {
    const tiers = new Set<EscalationLevel>();
    mySchedules.forEach((s) => {
      if (s.enabled) tiers.add(s.escalationLevel);
    });
    return Array.from(tiers);
  }, [mySchedules]);

  // Responders active right now across all tiers
  const activeRespondersNow = useMemo(() => {
    const defaultTiers: Record<EscalationLevel, string[]> = {
      tier1: [],
      tier2: [],
      tier3: [],
      manager: [],
    };
    if (!config?.userSchedules) return defaultTiers;
    const active = config.userSchedules.filter((s) => isScheduleActiveNow(s));
    active.forEach((s) => {
      if (!defaultTiers[s.escalationLevel].includes(s.userName)) {
        defaultTiers[s.escalationLevel].push(s.userName);
      }
    });
    return defaultTiers;
  }, [config]);

  // Toggle my on-call duty in assignment_schedules
  const handleToggleMyOnCall = async (enabled: boolean) => {
    if (!config) return;
    setSavingSelfSchedule(true);

    try {
      let updatedSchedules: UserSchedule[];

      if (mySchedules.length > 0) {
        // Toggle all entries belonging to the current user
        updatedSchedules = config.userSchedules.map((s) => {
          const isMe =
            s.userId === currentUserId ||
            s.userId.startsWith(`${currentUserId}::`) ||
            s.userName === currentUsername ||
            s.userEmail === currentUsername;
          return isMe ? { ...s, enabled } : s;
        });
      } else if (enabled && currentUserId) {
        // User had no schedule entries yet — create default Tier 1 entry
        const newEntry: UserSchedule = {
          userId: currentUserId,
          userName: currentUsername,
          userEmail: currentUsername,
          escalationLevel: 'tier1',
          schedules: [
            {
              id: Math.random().toString(36).substring(2, 12),
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              startTime: '00:00',
              endTime: '23:59',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
          ],
          enabled: true,
        };
        updatedSchedules = [...config.userSchedules, newEntry];
      } else {
        updatedSchedules = config.userSchedules;
      }

      const updatedConfig: AssignmentConfig = {
        ...config,
        userSchedules: updatedSchedules,
        updatedAt: new Date().toISOString(),
        defaultPolicy: computeDefaultPolicy(updatedSchedules),
      };

      const res = await setDatastoreItem('assignment_schedules', updatedConfig, DATASTORE_CATEGORIES.CONFIGURATION);
      if (res.success) {
        setConfig(updatedConfig);
        toast.success(enabled ? 'You are now ON-CALL for incident rotations' : 'You are now OFF-CALL (rotation paused)');
        onScheduleUpdated?.();
      } else {
        throw new Error(res.error || 'Failed to update schedule');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setSavingSelfSchedule(false);
    }
  };

  // Toggle Pager Calling for device
  const handleTogglePagerCalling = (enabled: boolean) => {
    const updated = savePagerSettings({ pagerCallingEnabled: enabled });
    setPagerSettings(updated);
    toast.success(enabled ? 'Emergency pager ringing enabled on this device' : 'Emergency pager ringing disabled on this device');
  };

  const handleTestAudio = () => {
    setIsPlayingTestSiren(true);
    playTestSiren(2200);
    setTimeout(() => {
      setIsPlayingTestSiren(false);
    }, 2300);
  };

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 3,
        bgcolor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 3,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header with Title & Live Status */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              bgcolor: isMyShiftActiveNow ? 'rgba(34, 197, 94, 0.15)' : 'hsl(var(--primary) / 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isMyShiftActiveNow ? '#16A34A' : 'hsl(var(--primary))',
            }}
          >
            <PhoneCall size={18} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', fontSize: '1.05rem', lineHeight: 1.2 }}>
              On-Call & Emergency Pager
            </Typography>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Escalation and pager alerts
            </Typography>

          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, alignSelf: { xs: 'flex-start', sm: 'center' } }}>
          {isMyShiftActiveNow ? (
            <Chip
              icon={<CheckCircle2 size={14} color="#16A34A" />}
              label="You Are On-Call Now"
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                bgcolor: 'rgba(34, 197, 94, 0.15)',
                color: '#16A34A',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            />
          ) : isMyOnCallEnabled ? (
            <Chip
              icon={<Clock size={14} />}
              label="Rotation Active (Off-Hours)"
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                bgcolor: 'rgba(59, 130, 246, 0.12)',
                color: '#3B82F6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            />
          ) : (
            <Chip
              icon={<UserX size={14} />}
              label="You Are Off-Duty"
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                bgcolor: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
                border: '1px solid hsl(var(--border))',
              }}
            />
          )}

          <Button
            size="small"
            variant="text"
            onClick={() => setShowHowItWorks((prev) => !prev)}
            endIcon={showHowItWorks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            sx={{
              color: 'hsl(var(--primary))',
              fontSize: '0.75rem',
              textTransform: 'none',
              px: 1,
              py: 0.25,
              minWidth: 0,
            }}
          >
            {showHowItWorks ? 'Hide Guide' : 'How it works'}
          </Button>
        </Box>
      </Box>

      {/* Primary Feature: Personal Quick-Toggle Card for Mobile/Web */}
      <Box
        sx={{
          bgcolor: 'hsl(var(--background))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2.5,
          p: { xs: 2, sm: 2 },
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: isMyOnCallEnabled ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
              color: isMyOnCallEnabled ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {currentUsername.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>
            {currentUsername}
            {isMyOnCallEnabled && myAssignedTiers.length > 0 && (
              <Typography component="span" variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 500, ml: 0.75 }}>
                {myAssignedTiers.map((t) => ESCALATION_LABELS[t]).join(', ')}
              </Typography>
            )}
          </Typography>
        </Box>

        <Divider sx={{ my: 1, borderColor: 'hsl(var(--border))' }} />


        {/* Toggle 1: My On-Call Rotation Duty */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
          <Box sx={{ pr: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Power size={15} color={isMyOnCallEnabled ? '#16A34A' : 'hsl(var(--muted-foreground))'} />
              <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', fontSize: '0.85rem' }}>
                My On-Call Duty
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', mt: 0.25 }}>
              {isMyOnCallEnabled
                ? 'Turn OFF to take yourself off the on-call schedule (vacation / off-duty).'
                : 'Turn ON to receive incident assignments and escalation shifts.'}
            </Typography>
          </Box>
          {savingSelfSchedule ? (
            <CircularProgress size={20} sx={{ color: 'hsl(var(--primary))' }} />
          ) : (
            <Switch
              checked={isMyOnCallEnabled}
              onChange={(e) => handleToggleMyOnCall(e.target.checked)}
              color="primary"
            />
          )}
        </Box>

        <Divider sx={{ my: 0.75, borderColor: 'hsl(var(--border))' }} />

        {/* Toggle 2: Emergency Device Pager Ringing */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
          <Box sx={{ pr: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Volume2 size={15} color={pagerSettings.pagerCallingEnabled ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} />
              <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', fontSize: '0.85rem' }}>
                Phone Pager & Siren Ringing
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', mt: 0.25 }}>
              Ring this device with full-screen urgent pager alerts on critical incidents.
            </Typography>
          </Box>
          <Switch
            checked={pagerSettings.pagerCallingEnabled}
            onChange={(e) => handleTogglePagerCalling(e.target.checked)}
            color="primary"
          />
        </Box>

        {/* Action buttons: Test Siren & Simulation */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1, pt: 1, borderTop: '1px solid hsl(var(--border))', flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={handleTestAudio}
            disabled={isPlayingTestSiren}
            startIcon={<Volume2 size={13} />}
            sx={{
              height: 30,
              fontSize: '0.75rem',
              textTransform: 'none',
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.08)' },
            }}
          >
            {isPlayingTestSiren ? 'Playing Siren...' : 'Test Siren Audio'}
          </Button>

          <Button
            size="small"
            variant="outlined"
            onClick={testPagerCall}
            startIcon={<Radio size={13} />}
            sx={{
              height: 30,
              fontSize: '0.75rem',
              textTransform: 'none',
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.08)' },
            }}
          >
            Simulate Pager Call
          </Button>
        </Box>
      </Box>

      {/* Expandable "How It Works" Section */}
      <Collapse in={showHowItWorks}>
        <Box
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            bgcolor: 'hsla(var(--primary) / 0.04)',
            border: '1px solid hsla(var(--primary) / 0.2)',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', mb: 1, display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.85rem' }}>
            <Layers size={15} color="hsl(var(--primary))" />
            How On-Call & Incident Escalation Works
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1 }}>
            {/* Step 1 */}
            <Paper sx={{ p: 1.25, bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Chip size="small" label="1. First Response" sx={{ bgcolor: 'rgba(34, 197, 94, 0.15)', color: '#16A34A', fontWeight: 700, height: 20, fontSize: '0.68rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>Tier 1</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: '0.72rem' }}>
                Incoming incidents trigger on-call Tier 1 responders. If no human is available, the <strong>AI Agent automatically acts as the 24/7 safety net</strong>.
              </Typography>
            </Paper>

            {/* Step 2 */}
            <Paper sx={{ p: 1.25, bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Chip size="small" label="2. Emergency Pager" sx={{ bgcolor: 'rgba(59, 130, 246, 0.15)', color: '#2563EB', fontWeight: 700, height: 20, fontSize: '0.68rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>Alerts</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: '0.72rem' }}>
                Your device rings with loud siren audio and full-screen notification until acknowledged or declined.
              </Typography>
            </Paper>

            {/* Step 3 */}
            <Paper sx={{ p: 1.25, bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Chip size="small" label="3. Escalation Chain" sx={{ bgcolor: 'rgba(245, 158, 11, 0.15)', color: '#D97706', fontWeight: 700, height: 20, fontSize: '0.68rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>Tier 2 & 3</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: '0.72rem' }}>
                Unacknowledged alerts automatically escalate: Tier 1 &rarr; Tier 2 (Specialist) &rarr; Tier 3 (Expert) after the timeout (e.g. 60s).
              </Typography>
            </Paper>

            {/* Step 4 */}
            <Paper sx={{ p: 1.25, bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Chip size="small" label="4. Manager Triage" sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#DC2626', fontWeight: 700, height: 20, fontSize: '0.68rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>Commander</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: '0.72rem' }}>
                Critical or unhandled incidents reach the on-call Manager to ensure no critical security alert is ever missed.
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Collapse>

      {/* Live On-Call Roster Right Now */}
      <Box sx={{ mt: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.75, fontSize: '0.68rem' }}>
          Active Responders On-Duty Right Now
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {/* Tier 1 */}
          <Chip
            avatar={<Avatar sx={{ bgcolor: ESCALATION_COLORS.tier1, color: '#fff', fontSize: '0.65rem' }}>T1</Avatar>}
            label={`Tier 1: ${activeRespondersNow.tier1.length > 0 ? activeRespondersNow.tier1.join(', ') : 'AI Agent (Backup)'}`}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'hsl(var(--border))', fontSize: '0.72rem', height: 26 }}
          />

          {/* Tier 2 */}
          <Chip
            avatar={<Avatar sx={{ bgcolor: ESCALATION_COLORS.tier2, color: '#fff', fontSize: '0.65rem' }}>T2</Avatar>}
            label={`Tier 2: ${activeRespondersNow.tier2.length > 0 ? activeRespondersNow.tier2.join(', ') : 'None'}`}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'hsl(var(--border))', fontSize: '0.72rem', height: 26 }}
          />

          {/* Tier 3 */}
          <Chip
            avatar={<Avatar sx={{ bgcolor: ESCALATION_COLORS.tier3, color: '#fff', fontSize: '0.65rem' }}>T3</Avatar>}
            label={`Tier 3: ${activeRespondersNow.tier3.length > 0 ? activeRespondersNow.tier3.join(', ') : 'None'}`}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'hsl(var(--border))', fontSize: '0.72rem', height: 26 }}
          />

          {/* Manager */}
          <Chip
            avatar={<Avatar sx={{ bgcolor: ESCALATION_COLORS.manager, color: '#fff', fontSize: '0.65rem' }}>M</Avatar>}
            label={`Manager: ${activeRespondersNow.manager.length > 0 ? activeRespondersNow.manager.join(', ') : 'None'}`}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'hsl(var(--border))', fontSize: '0.72rem', height: 26 }}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export const OnCallOverviewCard: React.FC<OnCallOverviewCardProps> = (props) => (
  <ComponentErrorBoundary name="On-Call Management Overview">
    <OnCallOverviewCardInner {...props} />
  </ComponentErrorBoundary>
);
