import { createFileRoute } from "@tanstack/react-router";
import MitreAttackPage from '@/pages/dashboard/MitreAttackPage';
import { SupportOnly } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/detection/mitre")({
  component: () => <SupportOnly><MitreAttackPage /></SupportOnly>,
});
