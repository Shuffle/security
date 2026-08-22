import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { ShufflerExternalRedirect } from '@/components/routing/routeShims';

export const Route = createFileRoute("/blog/")({
  head: () =>
    routeMeta({
      title: "Blog",
      description: "Product updates and security automation writing from the Shuffle team.",
      url: "/blog",
      breadcrumbs: [{ name: "Home", path: "/" }],
    }),
  component: ShufflerExternalRedirect,
});
