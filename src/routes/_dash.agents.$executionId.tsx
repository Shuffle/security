import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { AgentsRoute } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/agents/$executionId")({
  head: () =>
    routeMeta({
      title: "Agent run",
      description: "Follow an AI agent run decision by decision, with tools, outputs and timings.",
      url: "/agents/$executionId",
      noindex: true,
    }),
  component: AgentsRoute,
});
