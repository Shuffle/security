import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { RedirectIncidentsSimple } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/incidents-simple/$id")({
  head: () =>
    routeMeta({
      title: "Incident",
      description: "A simplified incident view for fast triage and response.",
      url: "/incidents-simple/$id",
      noindex: true,
    }),
  component: RedirectIncidentsSimple,
});
