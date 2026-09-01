import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

export interface DevicePreferences {
  critical_pager: boolean;
  agent_requests: boolean;
  general_alerts: boolean;
}

export interface NotificationDevice {
  id: string;
  token?: string;
  platform?: string;
  device_name?: string;
  preferences?: Partial<DevicePreferences>;
}

const DEVICE_ID_KEY = 'shuffle_notification_device_id';

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  critical_pager: true,
  agent_requests: true,
  general_alerts: true,
};

/** Stable per-browser/device identifier, generated once and persisted. */
export const getLocalDeviceId = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return '';
  }
};

export const getLocalDevicePlatform = (): string => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'browser';
};

export const getLocalDeviceName = (): string => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\/|Chromium\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';

  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Macintosh|Mac OS X/.test(ua)
      ? 'macOS'
      : /iPad|iPhone|iPod/.test(ua)
        ? 'iOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown';

  return `${browser} on ${os}`;
};

const extractDevices = (payload: unknown): NotificationDevice[] => {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const raw =
    (record.devices as unknown) ??
    ((record.user as Record<string, unknown> | undefined)?.devices as unknown);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is NotificationDevice => Boolean(item) && typeof item === 'object')
    .filter((item) => Boolean(item.id));
};

/** Loads the registered notification devices from the current user. */
export const fetchNotificationDevices = async (): Promise<NotificationDevice[]> => {
  try {
    const response = await fetch(getApiUrl('/api/v1/getinfo'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return extractDevices(data);
  } catch {
    return [];
  }
};

/** Registers or updates a device on the current user. */
export const saveNotificationDevice = async (device: NotificationDevice): Promise<boolean> => {
  try {
    const response = await fetch(getApiUrl('/api/v1/updateuser'), {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ device }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const resolveDevicePreferences = (device?: NotificationDevice | null): DevicePreferences => ({
  ...DEFAULT_DEVICE_PREFERENCES,
  ...(device?.preferences || {}),
});
