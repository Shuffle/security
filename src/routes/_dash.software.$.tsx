import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import EntityReferencePage from '@/pages/dashboard/EntityReferencePage';

export const Route = createFileRoute("/_dash/software/$")({
  head: () =>
    routeMeta({
      title: "Software inventory",
      description: "Search installed software across your monitored hosts.",
      url: "/software/$",
      noindex: true,
    }),
  component: () => <EntityReferencePage type="software" />,
});
