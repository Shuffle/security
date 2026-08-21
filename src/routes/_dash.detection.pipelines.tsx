import { createFileRoute } from "@tanstack/react-router";
import PipelinesPage from '@/pages/dashboard/PipelinesPage';

export const Route = createFileRoute("/_dash/detection/pipelines")({
  component: PipelinesPage,
});
