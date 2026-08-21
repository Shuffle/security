import { createFileRoute } from "@tanstack/react-router";
import { AgentsRoute } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/agents/$executionId")({
  component: AgentsRoute,
});
