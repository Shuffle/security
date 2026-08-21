import { createFileRoute } from "@tanstack/react-router";
import DocsPage from '@/pages/docs/DocsPage';
import { routeMeta } from '@/lib/routeMeta';

export const Route = createFileRoute("/docs/")({
  head: () =>
    routeMeta({
      title: 'Documentation',
      description:
        'Shuffle Security documentation — set up ingestion, incident automation, detections, vulnerability management and AI agents.',
      url: '/docs',
    }),
  component: DocsPage,
});
