import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import IOCTypesPage from '@/pages/dashboard/IOCTypesPage';

export const Route = createFileRoute("/_dash/incidents/observables")({
  head: () =>
    routeMeta({
      title: "Observables",
      description: "Review observables extracted from incidents and their threat intel context.",
      url: "/incidents/observables",
      noindex: true,
    }),
  component: IOCTypesPage,
});
