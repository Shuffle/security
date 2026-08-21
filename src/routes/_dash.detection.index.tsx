import { createFileRoute } from "@tanstack/react-router";
import DetectionOnboardingPage from '@/pages/dashboard/DetectionOnboardingPage';

export const Route = createFileRoute("/_dash/detection/")({
  component: DetectionOnboardingPage,
});
