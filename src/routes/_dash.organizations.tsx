import { createFileRoute } from "@tanstack/react-router";
import OrganizationsPage from '@/pages/dashboard/OrganizationsPage';

export const Route = createFileRoute("/_dash/organizations")({
  component: OrganizationsPage,
});
