import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import ResponseActionsPage from '@/pages/dashboard/ResponseActionsPage';
import { SupportOnly } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/monitors/response")({
  head: () =>
    routeMeta({
      title: "Monitor response actions",
      description: "Configure the response actions available on monitored hosts.",
      url: "/monitors/response",
      noindex: true,
    }),
  component: () => <SupportOnly><ResponseActionsPage /></SupportOnly>,
});
