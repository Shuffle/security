import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import EntityReferencePage from '@/pages/dashboard/EntityReferencePage';

export const Route = createFileRoute("/_dash/packages/$")({
  head: () =>
    routeMeta({
      title: "Packages",
      description: "Review installed packages and their known vulnerabilities.",
      url: "/packages/$",
      noindex: true,
    }),
  component: () => <EntityReferencePage type="package" />,
});
