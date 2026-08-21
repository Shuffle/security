import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import CustomFieldsPage from '@/pages/dashboard/CustomFieldsPage';

export const Route = createFileRoute("/_dash/incidents/custom-fields")({
  head: () =>
    routeMeta({
      title: "Custom fields",
      description: "Define custom incident fields for your organization workflows.",
      url: "/incidents/custom-fields",
      noindex: true,
    }),
  component: CustomFieldsPage,
});
