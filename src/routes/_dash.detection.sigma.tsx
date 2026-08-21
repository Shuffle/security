import { createFileRoute } from "@tanstack/react-router";
import RulesPage from '@/pages/dashboard/RulesPage';

export const Route = createFileRoute("/_dash/detection/sigma")({
  component: RulesPage,
});
