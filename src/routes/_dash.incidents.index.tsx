import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentsPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/incidents/")({
  head: () =>
    routeMeta({
      title: "Incidents",
      description: "Triage and resolve security incidents with automation and AI agents.",
      url: "/incidents",
      noindex: true,
    }),
  component: IncidentsPage,
});
