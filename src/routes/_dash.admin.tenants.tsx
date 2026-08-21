import { createFileRoute } from "@tanstack/react-router";
import AdminPage from '@/pages/dashboard/AdminPage';

export const Route = createFileRoute("/_dash/admin/tenants")({
  component: AdminPage,
});
