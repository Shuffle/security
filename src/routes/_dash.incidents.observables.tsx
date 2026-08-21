import { createFileRoute } from "@tanstack/react-router";
import IOCTypesPage from '@/pages/dashboard/IOCTypesPage';

export const Route = createFileRoute("/_dash/incidents/observables")({
  component: IOCTypesPage,
});
