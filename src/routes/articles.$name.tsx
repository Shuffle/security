import { createFileRoute } from "@tanstack/react-router";
import DocsPage from '@/pages/docs/DocsPage';
import { routeMeta } from '@/lib/routeMeta';
import { getDocContent } from '@/lib/docs.functions';

const titleize = (slug: string) =>
  slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const Route = createFileRoute("/articles/$name")({
  loader: async ({ params }) => {
    if (typeof window !== 'undefined') {
      return { doc: null };
    }
    try {
      const doc = await getDocContent({ data: { slug: params.name, folder: 'articles' } });
      return { doc };
    } catch {
      // Static / self-hosted builds have no server function — the page falls
      // back to the client-side fetch in MarkdownRenderer.
      return { doc: null };
    }
  },
  head: ({ params, loaderData }) => {
    const doc = loaderData?.doc ?? null;
    const fallbackTitle = params.name === 'index' ? 'Articles' : titleize(params.name);
    const title = doc?.title || fallbackTitle;
    const description =
      doc?.description || `${fallbackTitle} — security automation article and guide from the Shuffle Security team.`;

    return routeMeta({
      title,
      description,
      url: `/articles/${params.name}`,
      type: 'article',
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Articles', path: '/articles' },
      ],
    });
  },
  component: ArticlesRouteComponent,
});

function ArticlesRouteComponent() {
  const { name } = Route.useParams();
  const { doc } = Route.useLoaderData();
  return (
    <DocsPage
      key={name}
      folder="articles"
      basePath="/articles"
      sectionTitle="Articles"
      initialContent={doc?.markdown ?? null}
      initialMeta={doc?.meta ?? null}
    />
  );
}

