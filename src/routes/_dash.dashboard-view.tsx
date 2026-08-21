import { createFileRoute } from "@tanstack/react-router";
import DashboardViewPage from '@/pages/dashboard/DashboardViewPage';

export const Route = createFileRoute("/_dash/dashboard-view")({
  component: DashboardViewPage,
});
