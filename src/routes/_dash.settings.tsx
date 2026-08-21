import { createFileRoute } from "@tanstack/react-router";
import SettingsPage from '@/pages/dashboard/SettingsPage';

export const Route = createFileRoute("/_dash/settings")({
  component: SettingsPage,
});
