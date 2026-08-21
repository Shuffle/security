import { createFileRoute } from "@tanstack/react-router";
import Index from '@/pages/Index';
import { routeMeta } from '@/lib/routeMeta';

export const Route = createFileRoute("/")({
  head: () =>
    routeMeta({
      title: 'Shuffle Security — Open Source Alert & Case Management',
      description:
        'Open-source AI-powered incident response platform with 3,000+ integrations. Automatic security you control — cloud, on-prem, hybrid.',
      url: '/',
    }),
  component: Index,
});
