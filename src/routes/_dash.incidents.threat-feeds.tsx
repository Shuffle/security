import { createFileRoute } from "@tanstack/react-router";
import ThreatFeedsPage from '@/pages/dashboard/ThreatFeedsPage';

export const Route = createFileRoute("/_dash/incidents/threat-feeds")({
  component: ThreatFeedsPage,
});
