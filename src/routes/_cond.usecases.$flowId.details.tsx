import { createFileRoute } from "@tanstack/react-router";
import { UsecasesPage } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_cond/usecases/$flowId/details")({
  component: UsecasesPage,
});
