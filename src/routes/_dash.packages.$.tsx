import { createFileRoute } from "@tanstack/react-router";
import EntityReferencePage from '@/pages/dashboard/EntityReferencePage';

export const Route = createFileRoute("/_dash/packages/$")({
  component: () => <EntityReferencePage type="package" />,
});
