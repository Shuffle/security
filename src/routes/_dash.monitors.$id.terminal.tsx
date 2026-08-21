import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import HostTerminalPage from '@/pages/dashboard/HostTerminalPage';

export const Route = createFileRoute("/_dash/monitors/$id/terminal")({
  head: () =>
    routeMeta({
      title: "Host terminal",
      description: "Run remote control and response actions on a monitored host.",
      url: "/monitors/$id/terminal",
      noindex: true,
    }),
  component: HostTerminalPage,
});
