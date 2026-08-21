import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentDetailPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/incidents/$id")({
  head: () =>
    routeMeta({
      title: "Incident",
      description: "Investigate an incident with observables, correlations, timeline and AI automation.",
      url: "/incidents/$id",
      noindex: true,
    }),
  component: IncidentDetailPage,
});
