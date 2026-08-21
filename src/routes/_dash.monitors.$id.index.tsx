import { createFileRoute } from "@tanstack/react-router";
import MonitorDetailPage from '@/pages/dashboard/MonitorDetailPage';

export const Route = createFileRoute("/_dash/monitors/$id/")({
  component: MonitorDetailPage,
});
