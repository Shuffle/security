import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import FormsPage from '@/pages/dashboard/FormsPage';

export const Route = createFileRoute("/_cond/forms/$id")({
  head: () =>
    routeMeta({
      title: "Form",
      description: "Submit a Shuffle Security intake form to trigger an automated response workflow.",
      url: "/forms/$id",
      noindex: true,
    }),
  component: FormsPage,
});
