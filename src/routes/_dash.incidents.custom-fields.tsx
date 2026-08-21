import { createFileRoute } from "@tanstack/react-router";
import CustomFieldsPage from '@/pages/dashboard/CustomFieldsPage';

export const Route = createFileRoute("/_dash/incidents/custom-fields")({
  component: CustomFieldsPage,
});
