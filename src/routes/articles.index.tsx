import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { ShufflerExternalRedirect } from '@/components/routing/routeShims';

export const Route = createFileRoute("/articles/")({
  head: () =>
    routeMeta({
      title: "Articles",
      description: "Security automation articles and guides from the Shuffle team.",
      url: "/articles",
    }),
  component: ShufflerExternalRedirect,
});
