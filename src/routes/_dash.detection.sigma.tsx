import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import RulesPage from '@/pages/dashboard/RulesPage';

export const Route = createFileRoute("/_dash/detection/sigma")({
  head: () =>
    routeMeta({
      title: "Sigma rules",
      description: "Create, edit and deploy Sigma detection rules with AI assistance.",
      url: "/detection/sigma",
      noindex: true,
    }),
  component: RulesPage,
});
