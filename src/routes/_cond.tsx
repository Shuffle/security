import { createFileRoute } from "@tanstack/react-router";
import { ConditionalDashboardLayout } from "@/components/routing/routeShims";

/** App detail & usecase detail: uses sidebar when authenticated, standalone when guest. */
export const Route = createFileRoute("/_cond")({
  component: ConditionalDashboardLayout,
});
