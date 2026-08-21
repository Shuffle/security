import { createFileRoute } from "@tanstack/react-router";
import ResponseActionsPage from '@/pages/dashboard/ResponseActionsPage';
import { SupportOnly } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/monitors/response")({
  component: () => <SupportOnly><ResponseActionsPage /></SupportOnly>,
});
