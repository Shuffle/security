import { useEffect, useState } from 'react';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { DEMO_HOST_HOSTNAME } from '@/services/demoLiveEnvironment';

/**
 * Counts real (non-demo) host monitors registered on the current org's
 * environments. Used to decide whether the "Add Host Monitor" CTA should stay
 * highlighted on /vulnerabilities.
 */
export const useHostMonitorCount = () => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!res.ok) return;
        const data = await res.json();
        const envs = Array.isArray(data) ? data : data?.environments || [];
        const hosts = envs.flatMap((e: any) => (Array.isArray(e?.sensor_hosts) ? e.sensor_hosts : []));
        const real = hosts.filter((h: any) => {
          const uuid = String(h?.uuid || '');
          const hostname = String(h?.hostname || '');
          if (/^demo-/i.test(uuid)) return false;
          if (hostname.toLowerCase() === DEMO_HOST_HOSTNAME.toLowerCase()) return false;
          return true;
        });
        if (!cancelled) setCount(real.length);
      } catch {
        if (!cancelled) setCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
};
