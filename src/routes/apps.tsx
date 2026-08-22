import { createFileRoute } from "@tanstack/react-router";
import AppsPage from '@/pages/AppsPage';
import { routeMeta } from '@/lib/routeMeta';

export const Route = createFileRoute("/apps")({
  head: () =>
    routeMeta({
      title: '3,000+ Integrations',
      description:
        'Browse and connect 3,000+ security integrations — SIEM, EDR, Email, Cloud, ITSM, Threat Intel and more. Use your existing tools with Shuffle Security.',
      url: '/apps',
      breadcrumbs: [{ name: 'Home', path: '/' }],
    }),
  component: AppsPage,
});
