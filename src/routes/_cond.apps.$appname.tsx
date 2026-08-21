import { createFileRoute } from "@tanstack/react-router";
import AppDetailPage from '@/pages/dashboard/AppDetailPage';

export const Route = createFileRoute("/_cond/apps/$appname")({
  component: AppDetailPage,
});
