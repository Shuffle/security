import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import UsersPage from '@/pages/dashboard/UsersPage';

export const Route = createFileRoute("/_dash/users")({
  head: () =>
    routeMeta({
      title: "Users",
      description: "Manage users, roles and AI agent coverage in your organization.",
      url: "/users",
      noindex: true,
    }),
  component: UsersPage,
});
