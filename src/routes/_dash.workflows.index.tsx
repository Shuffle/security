import { createFileRoute } from "@tanstack/react-router";
import WorkflowsNotSupportedPage from '@/pages/dashboard/WorkflowsNotSupportedPage';

export const Route = createFileRoute("/_dash/workflows/")({
  component: WorkflowsNotSupportedPage,
});
