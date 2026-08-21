import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import FormsPage from '@/pages/dashboard/FormsPage';

export const Route = createFileRoute("/_cond/forms/")({
  head: () =>
    routeMeta({
      title: "Forms",
      description: "Build and manage intake forms that feed incidents and automation in Shuffle Security.",
      url: "/forms",
      noindex: true,
    }),
  component: FormsPage,
});
