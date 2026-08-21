import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import AdminPage from '@/pages/dashboard/AdminPage';

export const Route = createFileRoute("/_dash/admin/users")({
  head: () =>
    routeMeta({
      title: "User administration",
      description: "Invite users, assign roles and control access to your security workspace.",
      url: "/admin/users",
      noindex: true,
    }),
  component: AdminPage,
});
