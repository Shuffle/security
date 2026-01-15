// Google Analytics event tracking helper
// Provides type-safe event tracking for key user actions

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Event categories for organization
export type EventCategory = 
  | 'auth'
  | 'onboarding'
  | 'navigation'
  | 'engagement'
  | 'conversion';

// Predefined events for type safety
export const GA_EVENTS = {
  // Auth events
  LOGIN_START: { category: 'auth', action: 'login_start' },
  LOGIN_SUCCESS: { category: 'auth', action: 'login_success' },
  LOGIN_FAILURE: { category: 'auth', action: 'login_failure' },
  REGISTER_START: { category: 'auth', action: 'register_start' },
  REGISTER_SUCCESS: { category: 'auth', action: 'register_success' },
  LOGOUT: { category: 'auth', action: 'logout' },
  
  // Onboarding events
  ONBOARDING_START: { category: 'onboarding', action: 'onboarding_start' },
  ONBOARDING_STEP: { category: 'onboarding', action: 'onboarding_step' },
  ONBOARDING_COMPLETE: { category: 'onboarding', action: 'onboarding_complete' },
  CHALLENGE_SELECTED: { category: 'onboarding', action: 'challenge_selected' },
  TOOL_SELECTED: { category: 'onboarding', action: 'tool_selected' },
  
  // Navigation events
  CTA_CLICK: { category: 'navigation', action: 'cta_click' },
  NAV_CLICK: { category: 'navigation', action: 'nav_click' },
  EXTERNAL_LINK: { category: 'navigation', action: 'external_link' },
  
  // Engagement events
  SEARCH_USED: { category: 'engagement', action: 'search_used' },
  CATEGORY_FILTER: { category: 'engagement', action: 'category_filter' },
  APP_VIEWED: { category: 'engagement', action: 'app_viewed' },
  
  // Conversion events
  FREE_TRIAL_START: { category: 'conversion', action: 'free_trial_start' },
  INTEGRATION_CONNECTED: { category: 'conversion', action: 'integration_connected' },
} as const;

interface TrackEventParams {
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  custom?: Record<string, unknown>;
}

/**
 * Track a custom event in Google Analytics
 */
export function trackEvent({ category, action, label, value, custom }: TrackEventParams): void {
  if (typeof window === 'undefined' || !window.gtag) {
    // GA not loaded, log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Event]', { category, action, label, value, custom });
    }
    return;
  }

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
    ...custom,
  });
}

/**
 * Track a predefined event
 */
export function trackPredefinedEvent(
  event: typeof GA_EVENTS[keyof typeof GA_EVENTS],
  label?: string,
  value?: number,
  custom?: Record<string, unknown>
): void {
  trackEvent({
    category: event.category as EventCategory,
    action: event.action,
    label,
    value,
    custom,
  });
}

/**
 * Track page views (useful for SPA navigation)
 */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
  });
}

/**
 * Track CTA button clicks with common pattern
 */
export function trackCTA(ctaName: string, location?: string): void {
  trackPredefinedEvent(GA_EVENTS.CTA_CLICK, ctaName, undefined, {
    cta_location: location,
  });
}

/**
 * Track onboarding step progression
 */
export function trackOnboardingStep(stepNumber: number, stepName: string): void {
  trackPredefinedEvent(GA_EVENTS.ONBOARDING_STEP, stepName, stepNumber);
}
