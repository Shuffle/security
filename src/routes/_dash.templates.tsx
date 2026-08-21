import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import TemplatesPage from '@/pages/dashboard/TemplatesPage';

export const Route = createFileRoute("/_dash/templates")({
  head: () =>
    routeMeta({
      title: "Case templates",
      description: "Create reusable case and incident templates for repeatable response.",
      url: "/templates",
      noindex: true,
    }),
  component: TemplatesPage,
});
