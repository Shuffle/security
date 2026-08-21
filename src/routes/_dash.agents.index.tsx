import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { AgentsRoute } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/agents/")({
  head: () =>
    routeMeta({
      title: "Agent activity",
      description: "Monitor AI agent runs, decisions and handoffs across your security operations.",
      url: "/agents",
      noindex: true,
    }),
  component: AgentsRoute,
});
