import { createFileRoute } from "@tanstack/react-router";
import MonitorsPage from '@/pages/dashboard/MonitorsPage';

export const Route = createFileRoute("/_dash/monitors/")({
  component: MonitorsPage,
});
