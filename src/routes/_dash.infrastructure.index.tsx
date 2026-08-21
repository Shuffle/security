import { createFileRoute } from "@tanstack/react-router";
import InfrastructurePage from '@/pages/dashboard/InfrastructurePage';

export const Route = createFileRoute("/_dash/infrastructure/")({
  component: InfrastructurePage,
});
