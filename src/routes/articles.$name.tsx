import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { ShufflerExternalRedirect } from '@/components/routing/routeShims';

export const Route = createFileRoute("/articles/$name")({
  head: () =>
    routeMeta({
      title: "Article",
      description: "Security automation articles and guides from the Shuffle team.",
      url: "/articles/$name",
    }),
  component: ShufflerExternalRedirect,
});
