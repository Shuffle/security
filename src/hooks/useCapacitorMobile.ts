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

    let isMounted = true;
    let cleanupHandles: Array<() => void> = [];

    async function initMobile() {
      try {
        const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([
          import("@capacitor/splash-screen"),
          import("@capacitor/status-bar"),
          import("@capacitor/app"),
        ]);

        if (!isMounted) return;

        // 1. Hide the native splash screen smoothly once the React app is mounted
        SplashScreen.hide().catch(() => {});

        // 2. Configure Status Bar to match current theme
        if (theme === "light") {
          StatusBar.setStyle({ style: Style.Light }).catch(() => {});
          StatusBar.setBackgroundColor({ color: "#FFFFFF" }).catch(() => {});
        } else {
          StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
          StatusBar.setBackgroundColor({ color: "#1A1A1A" }).catch(() => {});
        }

        // 3. Handle Android Hardware Back Button
        const backHandler = await App.addListener("backButton", ({ canGoBack }) => {
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
            App.exitApp().catch(() => {});
          }
        });
        cleanupHandles.push(() => backHandler.remove());

        // 4. Handle Deep Linking / App Links
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
  }, [router, theme]);
}
