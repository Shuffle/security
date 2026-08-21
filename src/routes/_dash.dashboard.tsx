import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/dashboard")({
  component: DashboardPage,
});
