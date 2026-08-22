import { createFileRoute } from "@tanstack/react-router";
import DocsPage from '@/pages/docs/DocsPage';
import { routeMeta } from '@/lib/routeMeta';

export const Route = createFileRoute("/docs/$slug")({
  head: ({ params }) => {
    const docTitle = params.slug === 'index' ? 'Documentation' : params.slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return routeMeta({
      title: docTitle,
      description: `Shuffle Security documentation — ${docTitle}. Learn how to set up and use the platform.`,
      url: `/docs/${params.slug}`,
      type: 'article',
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Documentation', path: '/docs' },
      ],
    });
  },
  component: DocsPage,
});
