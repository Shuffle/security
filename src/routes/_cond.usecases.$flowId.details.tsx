import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { UsecasesPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_cond/usecases/$flowId/details")({
  head: () =>
    routeMeta({
      title: "Usecase details",
      description: "Inspect the apps, triggers and automation behind a security usecase.",
      url: "/usecases/$flowId/details",
      noindex: true,
    }),
  component: UsecasesPage,
});
