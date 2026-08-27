import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { getPlatform, isAndroid, isIos } from "@/lib/platform";
import { logBreadcrumb, initCrashReporting, recordCrash } from "@/lib/crashReporter";

interface UseCapacitorMobileOptions {
  theme?: "light" | "dark";
}

/**
 * Production-hardened mobile lifecycle, hardware back button, deep link,
 * status bar, network state, and crash reporting hook for Android & iOS.
 */
export function useCapacitorMobile(options?: UseCapacitorMobileOptions) {
  const router = useRouter();
  const theme = options?.theme || "dark";
  const lastBackPressRef = useRef<number>(0);

  // 1. One-time native initialization: Crash reporting, hardware back button, deep link & lifecycle
  useEffect(() => {
    // Initialize crash reporter immediately on all platforms
    initCrashReporting();

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isMounted = true;
    const cleanupHandles: Array<() => void> = [];
    const platform = getPlatform();

    logBreadcrumb("system", `Native mobile runtime started on ${platform}`);

    async function initMobile() {
      try {
        const [{ SplashScreen }, { App }] = await Promise.all([
          import("@capacitor/splash-screen"),
          import("@capacitor/app"),
        ]);

        if (!isMounted) return;

        // Hide native splash screen safely
        try {
          await SplashScreen.hide();
        } catch {
          // ignore if already hidden
        }

        // ==========================================
        // 1. Android Hardware / System Back Button
        // ==========================================
        const backHandler = await App.addListener("backButton", ({ canGoBack }) => {
          logBreadcrumb("ui", "Hardware back button pressed", { canGoBack, platform });

          // A. Close open modals, drawers, or popups first
          const openMuiModal = document.querySelector(
            '.MuiDialog-root:not([aria-hidden="true"]), .MuiDrawer-root:not([aria-hidden="true"]), [role="dialog"][data-state="open"]'
          );
          if (openMuiModal) {
            // Dispatch Escape key to gracefully trigger onClose handler in MUI/Radix
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Escape",
                code: "Escape",
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true,
              })
            );
            return;
          }

          // B. If on a sub-route or history exists, navigate back
          const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
          const isRootPath = currentPath === "/" || currentPath === "/incidents" || currentPath === "/login";

          if (!isRootPath && window.history.length > 1) {
            window.history.back();
            return;
          }

          // C. If at root route on Android, minimize app or exit gracefully on double press
          if (isAndroid()) {
            const now = Date.now();
            if (now - lastBackPressRef.current < 2000) {
              App.exitApp().catch(() => {});
            } else {
              lastBackPressRef.current = now;
              // Minimize rather than kill process
              if (typeof (App as any).minimizeApp === "function") {
                (App as any).minimizeApp().catch(() => {
                  App.exitApp().catch(() => {});
                });
              } else {
                App.exitApp().catch(() => {});
              }
            }
          }
        });
        cleanupHandles.push(() => backHandler.remove());

        // ==========================================
        // 2. App State Changes (Foreground / Background)
        // ==========================================
        const appStateListener = await App.addListener("appStateChange", (state) => {
          logBreadcrumb("system", `App state changed: ${state.isActive ? "active (foreground)" : "inactive (background)"}`);
        });
        cleanupHandles.push(() => appStateListener.remove());

        // ==========================================
        // 3. Deep Linking & App URL Handling
        // ==========================================
        const appUrlHandler = await App.addListener("appUrlOpen", (event) => {
          logBreadcrumb("navigation", `App URL opened: ${event.url}`);
          try {
            const url = new URL(event.url);
            const path = url.pathname + url.search + url.hash;
            if (path) {
              router.navigate({ to: path as any }).catch(() => {
                window.location.href = path;
              });
            }
          } catch (err) {
            recordCrash(err, { source: "capacitor_plugin", extra: { action: "appUrlOpen", url: event.url } });
          }
        });
        cleanupHandles.push(() => appUrlHandler.remove());

        // ==========================================
        // 4. Network Status Monitoring
        // ==========================================
        try {
          const { Network } = await import("@capacitor/network");
          const networkListener = await Network.addListener("networkStatusChange", (status) => {
            logBreadcrumb("network", `Network status changed: ${status.connected ? "online" : "offline"} (${status.connectionType})`);
          });
          cleanupHandles.push(() => networkListener.remove());
        } catch {
          // Network plugin not configured
        }
      } catch (err) {
        console.warn("[Shuffle Mobile] Capacitor mobile initialization error:", err);
        recordCrash(err, { source: "capacitor_plugin" });
      }
    }

    void initMobile();

    return () => {
      isMounted = false;
      cleanupHandles.forEach((cleanup) => {
        try {
          cleanup();
        } catch {}
      });
    };
  }, [router]);

  // 2. Cross-platform status bar styling for iOS and Android
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    async function updateStatusBar() {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        const isLight = theme === "light";

        if (isLight) {
          await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
          if (isAndroid()) {
            await StatusBar.setBackgroundColor({ color: "#FFFFFF" }).catch(() => {});
          }
        } else {
          await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
          if (isAndroid()) {
            await StatusBar.setBackgroundColor({ color: "#1A1A1A" }).catch(() => {});
          }
        }
      } catch {
        // Status bar plugin not available
      }
    }

    void updateStatusBar();
  }, [theme]);
}
