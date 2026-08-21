import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import VulnerabilityDetailPage from '@/pages/dashboard/VulnerabilityDetailPage';

export const Route = createFileRoute("/_cond/vulnerabilities/$")({
  head: () =>
    routeMeta({
      title: "Vulnerability details",
      description: "Inspect a vulnerability, affected hosts and available remediation actions.",
      url: "/vulnerabilities/$",
      noindex: true,
    }),
  component: VulnerabilityDetailPage,
});
