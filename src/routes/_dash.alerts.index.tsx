import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentsPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/alerts/")({
  head: () =>
    routeMeta({
      title: "Alerts",
      description: "Triage incoming security alerts with automation and AI-assisted investigation.",
      url: "/alerts",
      noindex: true,
    }),
  component: IncidentsPage,
});
