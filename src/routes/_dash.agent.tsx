import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from '@/lib/router-compat';

export const Route = createFileRoute("/_dash/agent")({
  component: () => <Navigate to="/agents" replace />,
});
