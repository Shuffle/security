import { createFileRoute } from "@tanstack/react-router";
import UsersPage from '@/pages/dashboard/UsersPage';

export const Route = createFileRoute("/_dash/users")({
  component: UsersPage,
});
