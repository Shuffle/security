import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import InfrastructurePage from '@/pages/dashboard/InfrastructurePage';

export const Route = createFileRoute("/_dash/infrastructure/")({
  head: () =>
    routeMeta({
      title: "Infrastructure",
      description: "Manage ingestion, forwarding and the apps that power your automation.",
      url: "/infrastructure",
      noindex: true,
    }),
  component: InfrastructurePage,
});
