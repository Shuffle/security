import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import AppDetailPage from '@/pages/dashboard/AppDetailPage';

export const Route = createFileRoute("/_cond/apps/$appname")({
  head: () =>
    routeMeta({
      title: "Integration details",
      description: "Configure authentication, actions and automation for a security integration in Shuffle Security.",
      url: "/apps/$appname",
      noindex: true,
    }),
  component: AppDetailPage,
});
