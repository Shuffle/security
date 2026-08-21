import { createFileRoute } from "@tanstack/react-router";
import AssetsPage from '@/pages/dashboard/AssetsPage';
import { SupportOnly } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/assets/")({
  component: () => <SupportOnly><AssetsPage /></SupportOnly>,
});
