import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { UsecasesPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_cond/usecases/")({
  head: () =>
    routeMeta({
      title: "Usecases",
      description: "Browse ready-made detection, response and enrichment usecases for your security stack.",
      url: "/usecases",
      noindex: true,
    }),
  component: UsecasesPage,
});
