import { createFileRoute } from "@tanstack/react-router";
import { IncidentDetailPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/jobs/$id")({
  component: IncidentDetailPage,
});
