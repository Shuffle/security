import { createFileRoute } from "@tanstack/react-router";
import TemplatesPage from '@/pages/dashboard/TemplatesPage';

export const Route = createFileRoute("/_dash/templates")({
  component: TemplatesPage,
});
