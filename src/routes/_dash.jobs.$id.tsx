import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentDetailPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/jobs/$id")({
  head: () =>
    routeMeta({
      title: "Job",
      description: "Inspect a scheduled or background job and its execution history.",
      url: "/jobs/$id",
      noindex: true,
    }),
  component: IncidentDetailPage,
});
