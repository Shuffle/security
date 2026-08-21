import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import AdminPage from '@/pages/dashboard/AdminPage';

export const Route = createFileRoute("/_dash/admin/")({
  head: () =>
    routeMeta({
      title: "Administration",
      description: "Manage organizations, users, tenants and platform settings.",
      url: "/admin",
      noindex: true,
    }),
  component: AdminPage,
});
