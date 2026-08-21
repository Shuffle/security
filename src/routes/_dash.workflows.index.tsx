import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import WorkflowsNotSupportedPage from '@/pages/dashboard/WorkflowsNotSupportedPage';

export const Route = createFileRoute("/_dash/workflows/")({
  head: () =>
    routeMeta({
      title: "Workflows",
      description: "Browse the automation workflows powering your security operations.",
      url: "/workflows",
      noindex: true,
    }),
  component: WorkflowsNotSupportedPage,
});
