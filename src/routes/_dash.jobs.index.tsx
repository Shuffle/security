import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentsPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/jobs/")({
  head: () =>
    routeMeta({
      title: "Jobs",
      description: "Review scheduled and background jobs across your workspace.",
      url: "/jobs",
      noindex: true,
    }),
  component: IncidentsPage,
});
