import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { Navigate } from '@/lib/router-compat';

export const Route = createFileRoute("/_dash/incidents-simple/")({
  head: () =>
    routeMeta({
      title: "Incidents",
      description: "A simplified incident list for fast triage and response.",
      url: "/incidents-simple",
      noindex: true,
    }),
  component: () => <Navigate to="/incidents" replace />,
});
