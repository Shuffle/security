import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import MonitorDetailPage from '@/pages/dashboard/MonitorDetailPage';

export const Route = createFileRoute("/_dash/monitors/$id/")({
  head: () =>
    routeMeta({
      title: "Host monitor",
      description: "Inspect a monitored host: compliance, software, processes and actions.",
      url: "/monitors/$id",
      noindex: true,
    }),
  component: MonitorDetailPage,
});
