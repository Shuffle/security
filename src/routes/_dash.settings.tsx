import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import SettingsPage from '@/pages/dashboard/SettingsPage';

export const Route = createFileRoute("/_dash/settings")({
  head: () =>
    routeMeta({
      title: "Settings",
      description: "Manage your account, API keys, notifications and workspace settings.",
      url: "/settings",
      noindex: true,
    }),
  component: SettingsPage,
});
