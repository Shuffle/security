import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from '@/lib/router-compat';

export const Route = createFileRoute("/_dash/detection/threat-feeds")({
  component: () => <Navigate to="/incidents/threat-feeds" replace />,
});
