import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import DataFlowDetailPage from '@/pages/dashboard/DataFlowDetailPage';

export const Route = createFileRoute("/_dash/infrastructure/flows/$flowId")({
  head: () =>
    routeMeta({
      title: "Data flow",
      description: "Inspect an ingestion or forwarding data flow end to end.",
      url: "/infrastructure/flows/$flowId",
      noindex: true,
    }),
  component: DataFlowDetailPage,
});
