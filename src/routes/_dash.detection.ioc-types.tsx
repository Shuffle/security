import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { Navigate } from '@/lib/router-compat';

export const Route = createFileRoute("/_dash/detection/ioc-types")({
  head: () =>
    routeMeta({
      title: "IOC types",
      description: "Choose which indicator types are enabled for detection and enrichment.",
      url: "/detection/ioc-types",
      noindex: true,
    }),
  component: () => <Navigate to="/incidents/observables" replace />,
});
