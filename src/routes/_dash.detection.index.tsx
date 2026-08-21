import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import DetectionOnboardingPage from '@/pages/dashboard/DetectionOnboardingPage';

export const Route = createFileRoute("/_dash/detection/")({
  head: () =>
    routeMeta({
      title: "Detection",
      description: "Manage detections, pipelines, threat feeds and MITRE ATT&CK coverage.",
      url: "/detection",
      noindex: true,
    }),
  component: DetectionOnboardingPage,
});
