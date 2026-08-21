import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import MitreAttackPage from '@/pages/dashboard/MitreAttackPage';
import { SupportOnly } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/detection/mitre")({
  head: () =>
    routeMeta({
      title: "MITRE ATT&CK",
      description: "Map your detection coverage against the MITRE ATT&CK framework.",
      url: "/detection/mitre",
      noindex: true,
    }),
  component: () => <SupportOnly><MitreAttackPage /></SupportOnly>,
});
