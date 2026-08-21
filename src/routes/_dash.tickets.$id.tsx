import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentDetailPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/tickets/$id")({
  head: () =>
    routeMeta({
      title: "Ticket",
      description: "Work a ticket with linked incidents, tasks and automation.",
      url: "/tickets/$id",
      noindex: true,
    }),
  component: IncidentDetailPage,
});
