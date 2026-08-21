import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentDetailPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/cases/$id")({
  head: () =>
    routeMeta({
      title: "Case",
      description: "Work a security case with timeline, tasks, stakeholders and response actions.",
      url: "/cases/$id",
      noindex: true,
    }),
  component: IncidentDetailPage,
});
