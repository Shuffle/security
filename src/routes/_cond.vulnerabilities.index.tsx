import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import VulnerabilitiesPage from '@/pages/dashboard/VulnerabilitiesPage';

export const Route = createFileRoute("/_cond/vulnerabilities/")({
  head: () =>
    routeMeta({
      title: "Vulnerabilities",
      description: "Track, prioritise and remediate vulnerabilities across your monitored hosts.",
      url: "/vulnerabilities",
      noindex: true,
    }),
  component: VulnerabilitiesPage,
});
