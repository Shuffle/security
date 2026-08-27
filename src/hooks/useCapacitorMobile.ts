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

  // 1. One-time native initialization: Hide splash screen and set up global listeners
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isMounted = true;
    let cleanupHandles: Array<() => void> = [];

    async function initMobile() {
      try {
        const [{ SplashScreen }, { App }] = await Promise.all([
          import("@capacitor/splash-screen"),
          import("@capacitor/app"),
        ]);

        if (!isMounted) return;

        // Hide the native splash screen smoothly once the React app is mounted
        SplashScreen.hide().catch(() => {});

        // Handle Android Hardware Back Button
        const backHandler = await App.addListener("backButton", ({ canGoBack }) => {
          const openDialog = document.querySelector('[role="dialog"][data-state="open"]');
          if (openDialog) {
            const closeBtn = openDialog.querySelector<HTMLElement>('button[aria-label="Close"], button.close');
            if (closeBtn) {
              closeBtn.click();
              return;
            }
          }

          if (canGoBack && window.history.length > 1) {
            window.history.back();
          } else {
            App.exitApp().catch(() => {});
          }
        });
        cleanupHandles.push(() => backHandler.remove());

        // Handle Deep Linking / App Links
        const appUrlHandler = await App.addListener("appUrlOpen", (event) => {
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
        });
        cleanupHandles.push(() => appUrlHandler.remove());
      } catch (err) {
        console.warn("Capacitor mobile initialization error:", err);
      }
    }

    void initMobile();

    return () => {
      isMounted = false;
      cleanupHandles.forEach((cleanup) => cleanup());
    };
  }, [router]);

  // 2. Dynamic status bar styling when theme changes
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    async function updateStatusBar() {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        if (theme === "light") {
          StatusBar.setStyle({ style: Style.Light }).catch(() => {});
          StatusBar.setBackgroundColor({ color: "#FFFFFF" }).catch(() => {});
        } else {
          StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
          StatusBar.setBackgroundColor({ color: "#1A1A1A" }).catch(() => {});
        }
      } catch {
        // Status bar plugin not available
      }
    }

    void updateStatusBar();
  }, [theme]);
}
