import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentDetailPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/alerts/$id")({
  head: () =>
    routeMeta({
      title: "Alert",
      description: "Investigate an alert with observables, correlations and automated enrichment.",
      url: "/alerts/$id",
      noindex: true,
    }),
  component: IncidentDetailPage,
});
