/**
 * Unified cross-platform abstraction for Shuffle Security.
 * Provides clean platform detection and feature gating for iOS, Android, and Web.
 */

export type AppPlatform = 'ios' | 'android' | 'web';

export interface DeviceDiagnostics {
  platform: AppPlatform;
  isNative: boolean;
  isIos: boolean;
  isAndroid: boolean;
  isWeb: boolean;
  isIosWebView: boolean;
  isAndroidWebView: boolean;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  isStandalone: boolean;
  isTouchDevice: boolean;
  online: boolean;
  capacitorPlatform?: string;
  appVersion?: string;
}

/**
 * Returns the current platform ('ios' | 'android' | 'web')
 */
export const getPlatform = (): AppPlatform => {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform && cap.isNativePlatform()) {
    const platform = typeof cap.getPlatform === 'function' ? cap.getPlatform() : '';
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }

  const ua = window.navigator?.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/android/i.test(ua)) {
    return 'android';
  }

  return 'web';
};

/**
 * Returns true if running as a Capacitor native app on iOS or Android.
 */
export const isCapacitorNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform && cap.isNativePlatform());
};

/**
 * Returns true if running specifically on iOS (native app or Safari/PWA).
 */
export const isIos = (): boolean => {
  return getPlatform() === 'ios';
};

/**
 * Returns true if running specifically on Android (native app or Chrome/PWA).
 */
export const isAndroid = (): boolean => {
  return getPlatform() === 'android';
};

/**
 * Returns true if running in a standard desktop or mobile web browser (not native wrapper).
 */
export const isWeb = (): boolean => {
  return !isCapacitorNative();
};

/**
 * Returns true if running inside the iOS Capacitor app or iOS standalone WebView/PWA.
 */
export const isIosWebView = (): boolean => {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform && cap.isNativePlatform()) {
    return typeof cap.getPlatform === 'function' ? cap.getPlatform() === 'ios' : true;
  }
  const ua = window.navigator?.userAgent || '';
  const isIosDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalonePwa = (window.navigator as any).standalone === true || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  const isEmbeddedWebview = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua);
  return isIosDevice && (isStandalonePwa || isEmbeddedWebview);
};

/**
 * Returns true if running inside the Android Capacitor app or Android standalone WebView/TWA.
 */
export const isAndroidWebView = (): boolean => {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform && cap.isNativePlatform()) {
    return typeof cap.getPlatform === 'function' ? cap.getPlatform() === 'android' : false;
  }
  const ua = window.navigator?.userAgent || '';
  const isAndroidDevice = /android/i.test(ua);
  const isStandalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  const isWebview = /;\s*wv|Version\/[\d.]+/i.test(ua) && isAndroidDevice;
  return isAndroidDevice && (isStandalone || isWebview);
};

/**
 * Collects full device & environment diagnostics for error reporting and settings.
 */
export const getDeviceDiagnostics = (): DeviceDiagnostics => {
  if (typeof window === 'undefined') {
    return {
      platform: 'web',
      isNative: false,
      isIos: false,
      isAndroid: false,
      isWeb: true,
      isIosWebView: false,
      isAndroidWebView: false,
      userAgent: 'ssr',
      screenWidth: 0,
      screenHeight: 0,
      devicePixelRatio: 1,
      isStandalone: false,
      isTouchDevice: false,
      online: true,
    };
  }

  const cap = (window as any).Capacitor;
  const platform = getPlatform();
  const isNative = isCapacitorNative();
  const isStandalone = (window.navigator as any).standalone === true ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  return {
    platform,
    isNative,
    isIos: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: !isNative,
    isIosWebView: isIosWebView(),
    isAndroidWebView: isAndroidWebView(),
    userAgent: window.navigator.userAgent || '',
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    isStandalone,
    isTouchDevice,
    online: typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
    capacitorPlatform: cap?.getPlatform?.() || undefined,
  };
};

// Global window fallback binding
if (typeof window !== 'undefined') {
  (window as any).isCapacitorNative = isCapacitorNative;
  (window as any).isIosWebView = isIosWebView;
  (window as any).isAndroidWebView = isAndroidWebView;
  (window as any).getPlatform = getPlatform;
}

