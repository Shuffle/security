import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { ThemeProvider as MuiThemeProvider, CssBaseline, Box } from "@mui/material";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import appCss from "../styles.css?url";

import { createMuiTheme } from "@/theme/muiTheme";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { setToastImpl } from "@/Shuffle-MCPs/toast";
import { toast as hostToast } from "@/lib/toast";
import { trackReferralParams, initAnalytics } from "@/lib/analytics";
import { installLocalStorageQuotaGuard } from "@/utils/safeLocalStorage";
import { installWorkflowFetchGate } from "@/lib/workflowFetchGate";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import ExternalLinkConfirmDialog from "@/components/common/ExternalLinkConfirmDialog";
import { ScrollToTop } from "@/components/ScrollToTop";
import { DemoProvider } from "@/context/DemoContext";
import { DemoTourDrawer } from "@/components/demo/DemoTourDrawer";
import { DemoSpotlight } from "@/components/demo/DemoSpotlight";
import { DemoCompletionWatcher } from "@/components/demo/DemoCompletionWatcher";
import { DemoResumePill } from "@/components/demo/DemoResumePill";
import GlobalAgentDrawer from "@/components/agent/GlobalAgentDrawer";
import GlobalWorkflowRunDrawer from "@/components/agent/GlobalWorkflowRunDrawer";
import GlobalNotificationsDrawer from "@/components/notifications/GlobalNotificationsDrawer";
import NotFound from "@/pages/NotFound";

// ported from main.tsx / App.tsx module scope
setToastImpl((arg, opts) => {
  // Bridge MCP-lib toast shape ({ title, description, variant }) onto the
  // host react-toastify wrapper. Plain strings pass through.
  if (typeof arg === "string") {
    hostToast(arg, opts as any);
    return;
  }
  const { title, description, variant } = (arg ?? {}) as {
    title?: string;
    description?: string;
    variant?: string;
  };
  const message = title || description || "";
  const mergedOpts = { description: title ? description : undefined, ...(opts || {}) };
  if (variant === "destructive" || variant === "error") hostToast.error(message, mergedOpts as any);
  else if (variant === "warning") hostToast.warning(message, mergedOpts as any);
  else if (variant === "success") hostToast.success(message, mergedOpts as any);
  else if (variant === "info") hostToast.info(message, mergedOpts as any);
  else hostToast(message, mergedOpts as any);
});

// ported from main.tsx
if (typeof window !== "undefined") {
  installLocalStorageQuotaGuard();
  installWorkflowFetchGate();

  const cleanupServiceWorkers = async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator)) return false;

    // Only treat this visit as "needed a reload" if an SW is actually
    // controlling the document right now. Leftover cache entries or stale
    // registrations are NOT a reason to refresh — we can clean them up
    // silently in the background.
    const hadActiveController = !!navigator.serviceWorker.controller;

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister().catch(() => false)));
    } catch {
      // ignore
    }

    if ("caches" in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((n) => caches.delete(n).catch(() => false)));
      } catch {
        // ignore
      }
    }

    return hadActiveController;
  };

  // Run SW cleanup in the background. Only force a one-time reload if a SW
  // was actively controlling this document (it would intercept module fetches).
  void cleanupServiceWorkers().then((hadActiveController) => {
    if (!hadActiveController) return;
    try {
      if (sessionStorage.getItem("__swCleaned") === "1") return;
      sessionStorage.setItem("__swCleaned", "1");
    } catch {
      // sessionStorage may be unavailable; fall through and reload once.
    }
    window.location.reload();
  });
}

const SITE_TITLE = "Shuffle Security - Automated Incident Management";
const SITE_DESCRIPTION =
  "Open-source cybersecurity incident management platform for the future AI-SOC. Controllable and transparent incident, vulnerability and response automation.";
const OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/3RrYN55ZuvUHHi6Wjhu1Xw7Dthg1/social-images/social-1779276187489-Newletter_heading_2x.webp";

// Pre-paint theme bootstrap: ThemeContext applies the class after hydration,
// but SSR paints first — resolve shuffle-theme (default: system) before paint
// to avoid a light-theme flash for dark users. RootShell's
// suppressHydrationWarning covers the expected <html> class mismatch.
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("shuffle-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.classList.add(t);}catch(e){}})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      {
        name: "keywords",
        content:
          "case management, alert management, cybersecurity, SOAR, incident response, open source, security automation, shuffle security",
      },
      { name: "author", content: "Shuffle Security" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#FF6600" },
      { name: "google-site-verification", content: "vLSnl-3IrXafKlglMz1T_LjnYu55mIdalktw88-cEZU" },
      { name: "google-site-verification", content: "XurySgWyZ4XH_J6GfrhvD167TYueG3DgElpwf0NOcXs" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Shuffle Security" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@shuffleio" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/pwa-192x192.png" },
    ],
    scripts: [
      { children: THEME_BOOTSTRAP },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Shuffle Security",
          applicationCategory: "SecurityApplication",
          operatingSystem: "Web",
          description:
            "Open-source cybersecurity alert and case management platform for managing alerts, cases, tasks, and observables.",
          url: "https://shuffle.security",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          author: {
            "@type": "Organization",
            name: "Shuffle Security",
            url: "https://shuffle.security",
          },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", ratingCount: "150" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Shuffle Security",
          url: "https://shuffle.security",
          logo: "/favicon.ico",
          sameAs: ["https://twitter.com/shuffleio", "https://github.com/shuffle"],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Shuffle Security",
          url: "https://shuffle.security",
        }),
      },
      { src: "https://js.stripe.com/v3" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** MUI theming shell — the old ThemedApp from App.tsx, minus BrowserRouter. */
function ThemedShell({ children }: { children: ReactNode }) {
  const { resolvedTheme, brandColor } = useTheme();
  const muiTheme = useMemo(() => createMuiTheme(resolvedTheme, brandColor), [resolvedTheme, brandColor]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <ExternalLinkConfirmDialog />
      <ToastContainer
        position="bottom-right"
        theme={resolvedTheme}
        autoClose={4000}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        hideProgressBar={false}
        style={{ width: "auto", maxWidth: 420 }}
      />
      <AuthProvider>
        <ScrollToTop />
        <GlobalAgentDrawer />
        <GlobalWorkflowRunDrawer />
        <GlobalNotificationsDrawer />
        <DemoProvider>
          <DemoTourDrawer />
          <DemoSpotlight />
          <DemoCompletionWatcher />
          <DemoResumePill />
          <Suspense
            fallback={
              <Box
                sx={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  zIndex: 2000,
                  backgroundColor: "hsl(var(--primary))",
                  opacity: 0.85,
                  animation: "shuffle-route-progress 1s ease-in-out infinite",
                }}
              />
            }
          >
            {children}
          </Suspense>
        </DemoProvider>
      </AuthProvider>
    </MuiThemeProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    initAnalytics();
    trackReferralParams();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemedShell>
          <Outlet />
        </ThemedShell>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mb-6 text-muted-foreground">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a
            className="rounded-md border border-border bg-card px-4 py-2 text-foreground"
            href="/"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
