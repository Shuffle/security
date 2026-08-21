import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

/** Onboarding with sidebar (collapsed by default) — ported from App.tsx line 291. */
export const Route = createFileRoute("/_onboarding")({
  component: () => (
    <ProtectedRoute>
      <DashboardLayout defaultCollapsed />
    </ProtectedRoute>
  ),
});
