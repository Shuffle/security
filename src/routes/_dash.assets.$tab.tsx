import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import AssetsPage from '@/pages/dashboard/AssetsPage';

export const Route = createFileRoute("/_dash/assets/$tab")({
  head: () =>
    routeMeta({
      title: "Assets",
      description: "Explore your asset inventory by hosts, software, users and cloud resources.",
      url: "/assets/$tab",
      noindex: true,
    }),
  component: () => <AssetsPage />,
});
