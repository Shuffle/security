import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import OrgPreferencesPage from '@/pages/dashboard/OrgPreferencesPage';

export const Route = createFileRoute("/_dash/preferences")({
  head: () =>
    routeMeta({
      title: "Organization preferences",
      description: "Control sidebar visibility, SLA targets and organization-wide defaults.",
      url: "/preferences",
      noindex: true,
    }),
  component: OrgPreferencesPage,
});
