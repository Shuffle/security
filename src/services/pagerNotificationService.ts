import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics } from '@capacitor/haptics';
import { isCapacitorNative } from '@/Shuffle-MCPs/api';

export interface PagerIncident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  source?: string;
  orgName?: string;
  timestamp?: number;
  tier?: string;
  description?: string;
}

export interface PagerSettings {
  pagerCallingEnabled: boolean;
  sirenSoundEnabled: boolean;
  vibrationEnabled: boolean;
  autoEscalateTimeoutSeconds: number;
  pushToken?: string | null;
  permissionStatus?: 'granted' | 'denied' | 'prompt' | 'unknown';
}

const STORAGE_KEY = 'shuffle_pager_settings';
const INCOMING_CALL_EVENT = 'shuffle:incoming-pager-call';
const CALL_DISMISSED_EVENT = 'shuffle:pager-call-dismissed';

const DEFAULT_SETTINGS: PagerSettings = {
  pagerCallingEnabled: true,
  sirenSoundEnabled: true,
  vibrationEnabled: true,
  autoEscalateTimeoutSeconds: 60,
  pushToken: null,
  permissionStatus: 'unknown',
};

// ── Settings Manager ─────────────────────────────────────────────────────────

export const getPagerSettings = (): PagerSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const savePagerSettings = (settings: Partial<PagerSettings>): PagerSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const current = getPagerSettings();
    const next = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('shuffle:pager-settings-changed', { detail: next }));
    return next;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

// ── Web Audio Emergency Siren Synthesizer ────────────────────────────────────

let audioCtx: AudioContext | null = null;
let sirenOscillator1: OscillatorNode | null = null;
let sirenOscillator2: OscillatorNode | null = null;
let sirenGainNode: GainNode | null = null;
let sirenLfoNode: OscillatorNode | null = null;
let sirenLfoGain: GainNode | null = null;
let sirenInterval: number | null = null;
let vibrationInterval: number | null = null;
let autoEscalateTimer: number | null = null;
let activeCallIncident: PagerIncident | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
};

export const startEmergencySiren = () => {
  const settings = getPagerSettings();
  if (!settings.sirenSoundEnabled) return;

  stopEmergencySiren();

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Dual-tone urgent pulsing siren (880 Hz warbling to 1320 Hz at 4 Hz)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.01, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.1);
    masterGain.connect(ctx.destination);
    sirenGainNode = masterGain;

    // Carrier Oscillator 1 (Square wave for sharp penetration)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);

    // Carrier Oscillator 2 (Higher harmonic)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, ctx.currentTime);

    // LFO frequency modulator for the alternating pager siren
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(3.5, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(350, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    osc1.connect(masterGain);
    osc2.connect(masterGain);

    osc1.start();
    osc2.start();
    lfo.start();

    sirenOscillator1 = osc1;
    sirenOscillator2 = osc2;
    sirenLfoNode = lfo;
    sirenLfoGain = lfoGain;
  } catch {
    // Web Audio fallback silence
  }
};

export const stopEmergencySiren = () => {
  if (sirenInterval) {
    window.clearInterval(sirenInterval);
    sirenInterval = null;
  }

  try {
    if (sirenGainNode && audioCtx) {
      sirenGainNode.gain.setValueAtTime(sirenGainNode.gain.value, audioCtx.currentTime);
      sirenGainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    }
  } catch {
    // Ignore
  }

  setTimeout(() => {
    try {
      if (sirenOscillator1) {
        sirenOscillator1.stop();
        sirenOscillator1.disconnect();
        sirenOscillator1 = null;
      }
      if (sirenOscillator2) {
        sirenOscillator2.stop();
        sirenOscillator2.disconnect();
        sirenOscillator2 = null;
      }
      if (sirenLfoNode) {
        sirenLfoNode.stop();
        sirenLfoNode.disconnect();
        sirenLfoNode = null;
      }
      if (sirenLfoGain) {
        sirenLfoGain.disconnect();
        sirenLfoGain = null;
      }
      if (sirenGainNode) {
        sirenGainNode.disconnect();
        sirenGainNode = null;
      }
    } catch {
      // Ignore
    }
  }, 60);
};

// ── Vibration & Haptics Engine ───────────────────────────────────────────────

export const startPagerVibration = () => {
  const settings = getPagerSettings();
  if (!settings.vibrationEnabled) return;

  stopPagerVibration();

  const pulse = () => {
    try {
      if (isCapacitorNative()) {
        Haptics.vibrate({ duration: 800 }).catch(() => {});
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([600, 200, 600, 200]);
      }
    } catch {
      // Ignore vibration error
    }
  };

  pulse();
  vibrationInterval = window.setInterval(pulse, 1600);
};

export const stopPagerVibration = () => {
  if (vibrationInterval) {
    window.clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(0);
    }
  } catch {
    // Ignore
  }
};

// ── Push & Local Notifications ───────────────────────────────────────────────

export const initializeNotificationChannels = async () => {
  if (!isCapacitorNative()) return;

  try {
    await LocalNotifications.createChannel({
      id: 'critical_pager',
      name: 'Critical Incident Pager Alerts',
      description: 'High-urgency alerts and incoming escalation calls for on-call personnel',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'res://raw/alert',
      lights: true,
      lightColor: '#FF6600',
    });
  } catch {
    // Channel initialization ignored if already exists
  }
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (!isCapacitorNative()) {
    if (typeof Notification !== 'undefined') {
      try {
        const res = await Notification.requestPermission();
        savePagerSettings({ permissionStatus: res === 'granted' ? 'granted' : 'denied' });
        return res === 'granted';
      } catch {
        return false;
      }
    }
    return false;
  }

  try {
    const pushPerm = await PushNotifications.requestPermissions();
    const localPerm = await LocalNotifications.requestPermissions();
    const granted = pushPerm.receive === 'granted' && localPerm.display === 'granted';

    savePagerSettings({ permissionStatus: granted ? 'granted' : 'denied' });

    if (granted) {
      await initializeNotificationChannels();
      await PushNotifications.register();
    }
    return granted;
  } catch {
    return false;
  }
};

export const setupPushNotificationListeners = () => {
  if (!isCapacitorNative()) return;

  try {
    PushNotifications.addListener('registration', (token) => {
      savePagerSettings({ pushToken: token.value });
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const data = notification.data || {};
      if (data.type === 'pager_alert' || data.incidentId) {
        triggerIncomingPagerCall({
          id: data.incidentId || String(Date.now()),
          title: notification.title || data.title || 'Critical Security Incident',
          severity: data.severity || 'critical',
          source: data.source || 'Shuffle SOC',
          orgName: data.orgName,
          tier: data.tier,
          description: notification.body || data.description,
        });
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data || {};
      if (data.incidentId && typeof window !== 'undefined') {
        window.location.href = `/incidents/${data.incidentId}`;
      }
    });
  } catch {
    // Ignore listener setup errors
  }
};

// ── Call Lifecycle Management ────────────────────────────────────────────────

export const triggerIncomingPagerCall = (incident: PagerIncident) => {
  const settings = getPagerSettings();
  if (!settings.pagerCallingEnabled) return;

  activeCallIncident = incident;

  // 1. Audio siren & vibration
  startEmergencySiren();
  startPagerVibration();

  // 2. Dispatch event for full-screen incoming call overlay
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(INCOMING_CALL_EVENT, {
        detail: { incident },
      }),
    );
  }

  // 3. Local notification on device
  if (isCapacitorNative()) {
    LocalNotifications.schedule({
      notifications: [
        {
          title: `CRITICAL ALERT: ${incident.title}`,
          body: `Incoming escalation call from ${incident.source || 'Shuffle Security'}. Tap to acknowledge.`,
          id: Math.floor(Math.random() * 100000),
          channelId: 'critical_pager',
          extra: { incidentId: incident.id },
          actionTypeId: 'PAGER_ALERT_ACTIONS',
        },
      ],
    }).catch(() => {});
  }

  // 4. Auto-escalate timer
  if (autoEscalateTimer) {
    window.clearTimeout(autoEscalateTimer);
  }
  const timeoutMs = (settings.autoEscalateTimeoutSeconds || 60) * 1000;
  autoEscalateTimer = window.setTimeout(() => {
    handleAutoEscalate(incident);
  }, timeoutMs);
};

export const dismissPagerCall = (incidentId?: string) => {
  stopEmergencySiren();
  stopPagerVibration();
  if (autoEscalateTimer) {
    window.clearTimeout(autoEscalateTimer);
    autoEscalateTimer = null;
  }
  activeCallIncident = null;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CALL_DISMISSED_EVENT, {
        detail: { incidentId },
      }),
    );
  }
};

const handleAutoEscalate = (incident: PagerIncident) => {
  dismissPagerCall(incident.id);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('shuffle:pager-call-escalated', {
        detail: { incident, reason: 'timeout' },
      }),
    );
  }
};

export const testPagerCall = () => {
  triggerIncomingPagerCall({
    id: `test-incident-${Date.now()}`,
    title: 'Unauthorized Privilege Escalation Detected (Test Alert)',
    severity: 'critical',
    source: 'Wazuh EDR',
    orgName: 'Production SOC',
    tier: 'Tier 1 Response',
    description: 'Simulated on-call pager verification call. Verify audio siren, vibration, and call response controls.',
    timestamp: Date.now(),
  });
};

export const playTestSiren = (durationMs = 2000) => {
  startEmergencySiren();
  setTimeout(() => {
    stopEmergencySiren();
  }, durationMs);
};

export const getActiveCallIncident = (): PagerIncident | null => activeCallIncident;
