import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { Navigate } from '@/lib/router-compat';

export const Route = createFileRoute("/_dash/detection/threat-feeds")({
  head: () =>
    routeMeta({
      title: "Threat feeds",
      description: "Connect threat intelligence feeds used for correlation and enrichment.",
      url: "/detection/threat-feeds",
      noindex: true,
    }),
  component: () => <Navigate to="/incidents/threat-feeds" replace />,
});
