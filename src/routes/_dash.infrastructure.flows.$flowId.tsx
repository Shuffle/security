import { createFileRoute } from "@tanstack/react-router";
import DataFlowDetailPage from '@/pages/dashboard/DataFlowDetailPage';

export const Route = createFileRoute("/_dash/infrastructure/flows/$flowId")({
  component: DataFlowDetailPage,
});
