import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import AssetsPage from '@/pages/dashboard/AssetsPage';
import { SupportOnly } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/assets/")({
  head: () =>
    routeMeta({
      title: "Assets",
      description: "Maintain an OCSF asset inventory of hosts, users and cloud resources.",
      url: "/assets",
      noindex: true,
    }),
  component: () => <SupportOnly><AssetsPage /></SupportOnly>,
});
