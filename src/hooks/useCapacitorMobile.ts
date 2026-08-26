import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";

interface UseCapacitorMobileOptions {
  theme?: "light" | "dark";
}

/**
 * Mobile lifecycle, hardware back button, deep link, status bar, and splash screen
 * hook for Capacitor running on Android/iOS.
 */
export function useCapacitorMobile(options?: UseCapacitorMobileOptions) {
  const router = useRouter();
  const theme = options?.theme || "dark";

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const { SplashScreen, StatusBar, App } = ((Capacitor as unknown as {
      Plugins?: Record<string, any>;
    }).Plugins || {}) as Record<string, any>;

    // 1. Hide the native splash screen smoothly once the React app is mounted
    if (SplashScreen?.hide) {
      SplashScreen.hide().catch(() => {});
    }

    // 2. Configure Status Bar to match current theme
    if (StatusBar) {
      if (theme === "light") {
        StatusBar.setStyle?.({ style: "LIGHT" }).catch(() => {});
        StatusBar.setBackgroundColor?.({ color: "#FFFFFF" }).catch(() => {});
      } else {
        StatusBar.setStyle?.({ style: "DARK" }).catch(() => {});
        StatusBar.setBackgroundColor?.({ color: "#1A1A1A" }).catch(() => {});
      }
    }

    // 3. Handle Android Hardware Back Button
    let backButtonHandle: any = null;
    if (App?.addListener) {
      App.addListener("backButton", ({ canGoBack }: { canGoBack: boolean }) => {
        // Check if any open dialog/modal/drawer can be dismissed first
        const openDialog = document.querySelector('[role="dialog"][data-state="open"]');
        if (openDialog) {
          const closeBtn = openDialog.querySelector<HTMLElement>('button[aria-label="Close"], button.close');
          if (closeBtn) {
            closeBtn.click();
            return;
          }
        }

        // If history can go back, navigate back
        if (canGoBack && window.history.length > 1) {
          window.history.back();
        } else {
          // Exit app gracefully if at the root page
          App.exitApp?.();
        }
      })
        .then((handle: any) => {
          backButtonHandle = handle;
        })
        .catch(() => {});
    }

    // 4. Handle Deep Linking / App Links (e.g. shuffle://... or https://shuffle.security/...)
    let appUrlOpenHandle: any = null;
    if (App?.addListener) {
      App.addListener("appUrlOpen", (event: { url: string }) => {
        try {
          const url = new URL(event.url);
          const path = url.pathname + url.search + url.hash;
          if (path) {
            router.navigate({ to: path as any }).catch(() => {
              window.location.href = path;
            });
          }
        } catch {
          // Ignore malformed URLs
        }
      })
        .then((handle: any) => {
          appUrlOpenHandle = handle;
        })
        .catch(() => {});
    }

    return () => {
      backButtonHandle?.remove?.();
      appUrlOpenHandle?.remove?.();
    };
  }, [router, theme]);
}
