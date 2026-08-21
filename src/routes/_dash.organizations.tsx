import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import OrganizationsPage from '@/pages/dashboard/OrganizationsPage';

export const Route = createFileRoute("/_dash/organizations")({
  head: () =>
    routeMeta({
      title: "Organizations",
      description: "Switch between and administer your Shuffle Security organizations.",
      url: "/organizations",
      noindex: true,
    }),
  component: OrganizationsPage,
});
