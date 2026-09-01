import { createFileRoute } from "@tanstack/react-router";
import DocsPage from '@/pages/docs/DocsPage';
import { routeMeta } from '@/lib/routeMeta';

export const Route = createFileRoute("/legal/")({
  head: () =>
    routeMeta({
      title: 'Legal',
      description:
        'Shuffle Security legal documents — privacy policy, terms of service and data processing information.',
      url: '/legal',
      breadcrumbs: [{ name: 'Home', path: '/' }],
    }),
  component: LegalIndexRoute,
});

function LegalIndexRoute() {
  return <DocsPage folder="legal" basePath="/legal" sectionTitle="Legal" />;
}
