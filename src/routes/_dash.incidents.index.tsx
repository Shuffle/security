import { createFileRoute } from "@tanstack/react-router";
import { IncidentsPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/incidents/")({
  component: IncidentsPage,
});
