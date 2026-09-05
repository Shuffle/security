import { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useCallback, ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  brandColor: string | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'shuffle-theme';
const USER_EXPLICIT_KEY = 'shuffle-theme-explicit';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') return getSystemTheme();
  return mode;
};

const applyDomTheme = (resolved: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
};

const persistThemeToBackend = async (theme: ThemeMode) => {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null;
    const base = typeof window !== 'undefined' ? (window as any).__SHUFFLE_API_BASE__ || '' : '';
    // Fire-and-forget; ignore status or errors so frontend changes happen immediately
    await fetch(`${base}/api/v1/updateuser`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ theme }),
    });
  } catch {
    // Non-blocking: optimistic frontend changes must never depend on backend success
  }
};

const hexToHSL = (hex: string): string => {
  try {
    hex = hex.replace(/^#/, '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch {
    return '24 100% 50%';
  }
};

const updateCSSVariables = (brandColor: string | null) => {
  const color = brandColor || '#FF6600';
  const hsl = hexToHSL(color);
  
  document.documentElement.style.setProperty('--primary', hsl);
  document.documentElement.style.setProperty('--ring', hsl);
  document.documentElement.style.setProperty('--sidebar-primary', hsl);
  document.documentElement.style.setProperty('--sidebar-ring', hsl);
  document.documentElement.style.setProperty('--status-open', hsl);
  
  const [h, s, l] = hsl.split(/\s+/);
  const lightness = parseInt(l);
  const glowLightness = Math.min(lightness + 10, 100);
  document.documentElement.style.setProperty('--primary-glow', `${h} ${s} ${glowLightness}%`);
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  });
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [apiChecked, setApiChecked] = useState(false);

  const themeRef = useRef(theme);
  themeRef.current = theme;

  const userExplicitRef = useRef<boolean>(
    typeof localStorage !== 'undefined' && localStorage.getItem(USER_EXPLICIT_KEY) === 'true'
  );

  // Keep systemTheme reactive to OS prefers-color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const nextSys = e.matches ? 'dark' : 'light';
      setSystemTheme(nextSys);
      if (themeRef.current === 'system') {
        applyDomTheme(nextSys);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Cross-tab synchronization via storage event
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const next = e.newValue as ThemeMode;
        if (next === 'light' || next === 'dark' || next === 'system') {
          const nextResolved = resolveTheme(next);
          applyDomTheme(nextResolved);
          setThemeState(next);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    updateCSSVariables(brandColor);
  }, [brandColor]);

  useIsomorphicLayoutEffect(() => {
    applyDomTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Theme preference is sourced from the same `/api/v1/getinfo` request that
  // AuthContext already fires on mount. Listening for the broadcast event it
  // dispatches avoids a second duplicate request to the same endpoint.
  useEffect(() => {
    if (apiChecked) return;
    const onGetInfo = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data && data.success) {
        const orgBrandColor = data.active_org?.branding?.brand_color;
        if (orgBrandColor) {
          setBrandColor(orgBrandColor);
        } else {
          setBrandColor(null);
        }
        
        const isValidTheme = (val: unknown): val is ThemeMode =>
          val === 'light' || val === 'dark' || val === 'system';

        const brandingTheme = data.active_org?.branding?.theme;
        const dataTheme = data.theme;

        const isUserExplicit =
          userExplicitRef.current ||
          (typeof localStorage !== 'undefined' && localStorage.getItem(USER_EXPLICIT_KEY) === 'true');

        if (isUserExplicit) {
          // Frontend user choice is optimistic and takes precedence over backend preferences!
          // We do not clobber the user's active theme.
        } else if (isValidTheme(brandingTheme)) {
          // Priority: Tenant branding theme overrides theme for this tenant when user hasn't explicitly set one
          setThemeState(brandingTheme);
          applyDomTheme(resolveTheme(brandingTheme));
          try {
            localStorage.setItem(THEME_STORAGE_KEY, brandingTheme);
          } catch {}
        } else {
          // No tenant branding theme: preserve existing user preference if set,
          // or hydrate user's account theme (data.theme) if available.
          const saved = typeof localStorage !== 'undefined' ? (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) : null;
          if (!saved && isValidTheme(dataTheme)) {
            setThemeState(dataTheme);
            applyDomTheme(resolveTheme(dataTheme));
            try {
              localStorage.setItem(THEME_STORAGE_KEY, dataTheme);
            } catch {}
          }
        }
      }
      setApiChecked(true);
    };
    window.addEventListener('shuffle:getinfo', onGetInfo as EventListener);
    return () => window.removeEventListener('shuffle:getinfo', onGetInfo as EventListener);
  }, [apiChecked]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    const nextResolved = resolveTheme(newTheme);

    // 1. Immediately and synchronously apply DOM class changes
    applyDomTheme(nextResolved);

    // 2. Mark explicit user selection so backend preferences don't clobber it
    userExplicitRef.current = true;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      localStorage.setItem(USER_EXPLICIT_KEY, 'true');
    } catch {}

    // 3. Immediately update React state
    setThemeState(newTheme);

    // 4. Dispatch instant change event for any custom listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('shuffle:theme-change', {
          detail: { theme: newTheme, resolvedTheme: nextResolved },
        })
      );
    }

    // 5. Fire-and-forget optimistic persist to backend
    persistThemeToBackend(newTheme).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, brandColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
