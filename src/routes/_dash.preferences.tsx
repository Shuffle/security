import { createFileRoute } from "@tanstack/react-router";
import OrgPreferencesPage from '@/pages/dashboard/OrgPreferencesPage';

export const Route = createFileRoute("/_dash/preferences")({
  component: OrgPreferencesPage,
});
