import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentsPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/cases/")({
  head: () =>
    routeMeta({
      title: "Cases",
      description: "Manage security cases from intake through resolution.",
      url: "/cases",
      noindex: true,
    }),
  component: IncidentsPage,
});
