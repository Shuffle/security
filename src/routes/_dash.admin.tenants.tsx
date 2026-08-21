import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import AdminPage from '@/pages/dashboard/AdminPage';

export const Route = createFileRoute("/_dash/admin/tenants")({
  head: () =>
    routeMeta({
      title: "Tenants",
      description: "Manage child tenants and multi-tenant access in Shuffle Security.",
      url: "/admin/tenants",
      noindex: true,
    }),
  component: AdminPage,
});
