import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { UsecasesPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_cond/usecases/$flowId/")({
  head: () =>
    routeMeta({
      title: "Usecase",
      description: "Review and enable an automated security usecase across your connected tools.",
      url: "/usecases/$flowId",
      noindex: true,
    }),
  component: UsecasesPage,
});
