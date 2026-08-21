import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { IncidentsPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/tickets/")({
  head: () =>
    routeMeta({
      title: "Tickets",
      description: "Manage tickets alongside your incidents and cases.",
      url: "/tickets",
      noindex: true,
    }),
  component: IncidentsPage,
});
