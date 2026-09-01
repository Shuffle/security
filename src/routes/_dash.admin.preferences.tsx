import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import AdminPage from '@/pages/dashboard/AdminPage';

export const Route = createFileRoute("/_dash/admin/preferences")({
  head: () =>
    routeMeta({
      title: "Tenant preferences",
      description: "Configure terminology, sidebar visibility, SLA targets and tenant-wide defaults.",
      url: "/admin/preferences",
      noindex: true,
    }),
  component: AdminPage,
});
