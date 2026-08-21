import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import WorkflowsNotSupportedPage from '@/pages/dashboard/WorkflowsNotSupportedPage';

export const Route = createFileRoute("/_dash/workflows/$id")({
  head: () =>
    routeMeta({
      title: "Workflow",
      description: "Inspect a workflow, its runs and the apps it orchestrates.",
      url: "/workflows/$id",
      noindex: true,
    }),
  component: WorkflowsNotSupportedPage,
});
