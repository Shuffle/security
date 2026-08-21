import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import HostTerminalPage from '@/pages/dashboard/HostTerminalPage';

export const Route = createFileRoute("/_dash/monitors/terminal")({
  head: () =>
    routeMeta({
      title: "Terminal",
      description: "Run remote control actions across your monitored hosts.",
      url: "/monitors/terminal",
      noindex: true,
    }),
  component: HostTerminalPage,
});
