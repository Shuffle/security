import { createFileRoute } from "@tanstack/react-router";
import { RedirectIncidentsSimple } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/incidents-simple/$id")({
  component: RedirectIncidentsSimple,
});
