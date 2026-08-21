import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from '@/lib/router-compat';

export const Route = createFileRoute("/_dash/incidents/response-actions")({
  component: () => <Navigate to="/monitors/response" replace />,
});
