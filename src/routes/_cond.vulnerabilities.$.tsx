import { createFileRoute } from "@tanstack/react-router";
import VulnerabilityDetailPage from '@/pages/dashboard/VulnerabilityDetailPage';

export const Route = createFileRoute("/_cond/vulnerabilities/$")({
  component: VulnerabilityDetailPage,
});
