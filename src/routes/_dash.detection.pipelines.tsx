import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import PipelinesPage from '@/pages/dashboard/PipelinesPage';

export const Route = createFileRoute("/_dash/detection/pipelines")({
  head: () =>
    routeMeta({
      title: "Detection pipelines",
      description: "Configure ingestion pipelines and sensors that feed detections.",
      url: "/detection/pipelines",
      noindex: true,
    }),
  component: PipelinesPage,
});
