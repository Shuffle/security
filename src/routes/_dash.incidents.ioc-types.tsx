import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { Navigate } from '@/lib/router-compat';

export const Route = createFileRoute("/_dash/incidents/ioc-types")({
  head: () =>
    routeMeta({
      title: "Incident IOC types",
      description: "Control which indicator types are extracted from incidents.",
      url: "/incidents/ioc-types",
      noindex: true,
    }),
  component: () => <Navigate to="/incidents/observables" replace />,
});
