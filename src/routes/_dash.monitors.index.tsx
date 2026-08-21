import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import MonitorsPage from '@/pages/dashboard/MonitorsPage';

export const Route = createFileRoute("/_dash/monitors/")({
  head: () =>
    routeMeta({
      title: "Host monitors",
      description: "Deploy and manage host monitors for compliance and vulnerability data.",
      url: "/monitors",
      noindex: true,
    }),
  component: MonitorsPage,
});
