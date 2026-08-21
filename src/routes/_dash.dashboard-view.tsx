import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import DashboardViewPage from '@/pages/dashboard/DashboardViewPage';

export const Route = createFileRoute("/_dash/dashboard-view")({
  head: () =>
    routeMeta({
      title: "Dashboard view",
      description: "A focused view of incident, automation and vulnerability metrics.",
      url: "/dashboard-view",
      noindex: true,
    }),
  component: DashboardViewPage,
});
