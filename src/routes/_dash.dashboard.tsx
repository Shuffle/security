import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { DashboardPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/dashboard")({
  head: () =>
    routeMeta({
      title: "Dashboard",
      description: "Live overview of incidents, automation coverage, agents and vulnerabilities.",
      url: "/dashboard",
      noindex: true,
    }),
  component: DashboardPage,
});
