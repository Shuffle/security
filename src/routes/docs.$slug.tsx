import { createFileRoute } from "@tanstack/react-router";
import DocsPage from '@/pages/docs/DocsPage';
import { routeMeta } from '@/lib/routeMeta';
import { getDocContent } from '@/lib/docs.functions';

export const Route = createFileRoute("/docs/$slug")({
  loader: async ({ params }) => {
    try {
      const doc = await getDocContent({ data: { slug: params.slug } });
      return { doc };
    } catch {
      // Static / self-hosted builds have no server function — the page falls
      // back to the client-side fetch in MarkdownRenderer.
      return { doc: null };
    }
  },
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
  component: DocsRouteComponent,
});

function DocsRouteComponent() {
  const { doc } = Route.useLoaderData();
  return <DocsPage initialContent={doc?.markdown ?? null} initialMeta={doc?.meta ?? null} />;
}
