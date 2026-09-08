/**
 * Cross-domain authentication handoff between Shuffle Security and Shuffle Core (shuffler.io).
 *
 * Exposes utilities to request a single-use exchange ticket and navigate to
 * Shuffle Core while ensuring the session cookie is properly established on .shuffler.io.
 */

import { toast } from '@/lib/toast';
import { getApiUrl, getAuthHeader, getSessionToken } from '@/Shuffle-MCPs/api';
import { getShuffleCoreBaseUrl } from '@/lib/shuffleUrls';

export interface HandoffOptions {
  /** Open in a new browser tab/window instead of navigating the current tab. */
  newTab?: boolean;
}

/**
 * Returns true if the given URL points to Shuffle Core (shuffler.io or configured core base).
 */
export const isShuffleCoreUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  const coreBase = getShuffleCoreBaseUrl().toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.startsWith(coreBase)) return true;

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://shuffle.security';
    const parsed = new URL(url, origin);
    const host = parsed.hostname.toLowerCase();
    return host === 'shuffler.io' || host.endsWith('.shuffler.io');
  } catch {
    return false;
  }
};

/**
 * Builds the full destination URL for Shuffle Core from either an absolute URL or a path.
 */
export const resolveShuffleCoreTargetUrl = (destinationUrlOrPath: string): string => {
  const trimmed = (destinationUrlOrPath || '').trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const coreBase = getShuffleCoreBaseUrl();
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${coreBase}${cleanPath}`;
};

/**
 * Requests an auth handoff ticket from the current backend and navigates to Shuffle Core
 * via the ticket exchange endpoint.
 *
 * If handoff fails or auth is missing, an error toast is displayed and navigation is blocked.
 *
 * @param destinationUrlOrPath The target path (e.g. `/new-dashboard`) or full URL on Shuffle Core.
 * @param options Navigation options (e.g. `{ newTab: true }`).
 * @returns Promise<boolean> True if handoff succeeded and redirect was initiated; false otherwise.
 */
export async function navigateToShuffleCore(
  destinationUrlOrPath: string,
  options?: HandoffOptions
): Promise<boolean> {
  const isNewTab = Boolean(options?.newTab);
  const targetUrl = resolveShuffleCoreTargetUrl(destinationUrlOrPath);

  // When opening in a new tab, open blank window immediately within user gesture to avoid popup blockers
  let popupWindow: Window | null = null;
  if (isNewTab && typeof window !== 'undefined') {
    popupWindow = window.open('about:blank', '_blank');
  }

  try {
    const handoffEndpoint = getApiUrl('/api/v1/auth/handoff');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    };

    // Ensure session token is attached in Authorization header if present
    const sessionToken = getSessionToken();
    if (sessionToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    const response = await fetch(handoffEndpoint, {
      method: 'POST',
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      let reason = `Server error (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData?.reason) {
          reason = errorData.reason;
        }
      } catch {
        // use default reason
      }

      if (popupWindow) popupWindow.close();
      toast.error(`Authentication handoff failed: ${reason}`);
      return false;
    }

    const data = await response.json();
    if (!data?.success || !data?.ticket) {
      if (popupWindow) popupWindow.close();
      toast.error(`Authentication handoff failed: ${data?.reason || 'No ticket returned'}`);
      return false;
    }

    // Construct exchange URL on the target Core base
    const coreBase = getShuffleCoreBaseUrl();
    const exchangeUrl = `${coreBase}/api/v1/auth/exchange?ticket=${encodeURIComponent(data.ticket)}&redirect=${encodeURIComponent(targetUrl)}`;

    if (popupWindow) {
      popupWindow.location.href = exchangeUrl;
    } else if (typeof window !== 'undefined') {
      window.location.href = exchangeUrl;
    }

    return true;
  } catch (err: any) {
    if (popupWindow) popupWindow.close();
    toast.error(`Failed to navigate to Shuffle Core: ${err?.message || 'Network error'}`);
    return false;
  }
}
