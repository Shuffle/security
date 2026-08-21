import { createFileRoute } from "@tanstack/react-router";
import { ShufflerExternalRedirect } from '@/components/routing/routeShims';

export const Route = createFileRoute("/blog/")({
  component: ShufflerExternalRedirect,
});
