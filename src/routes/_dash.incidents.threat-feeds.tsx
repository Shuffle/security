import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import ThreatFeedsPage from '@/pages/dashboard/ThreatFeedsPage';

export const Route = createFileRoute("/_dash/incidents/threat-feeds")({
  head: () =>
    routeMeta({
      title: "Incident threat feeds",
      description: "Manage the threat feeds used to enrich incidents.",
      url: "/incidents/threat-feeds",
      noindex: true,
    }),
  component: ThreatFeedsPage,
});
