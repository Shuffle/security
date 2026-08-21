import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { Navigate } from '@/lib/router-compat';

export const Route = createFileRoute("/_dash/incidents/response-actions")({
  head: () =>
    routeMeta({
      title: "Response actions",
      description: "Configure the response actions available to analysts and AI agents.",
      url: "/incidents/response-actions",
      noindex: true,
    }),
  component: () => <Navigate to="/monitors/response" replace />,
});
