import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import AdminPage from '@/pages/dashboard/AdminPage';

export const Route = createFileRoute("/_dash/admin/billing")({
  head: () =>
    routeMeta({
      title: "Billing",
      description: "Review plan usage, execution limits and billing for your Shuffle Security organization.",
      url: "/admin/billing",
      noindex: true,
    }),
  component: AdminPage,
});
