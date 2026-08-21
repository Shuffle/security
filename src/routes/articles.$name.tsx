import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { ShufflerExternalRedirect } from '@/components/routing/routeShims';

const titleize = (slug: string) =>
  slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const Route = createFileRoute("/articles/$name")({
  head: ({ params }) => {
    const name = titleize(params.name);
    return routeMeta({
      title: name,
      description: `${name} — security automation article and guide from the Shuffle Security team.`,
      url: `/articles/${params.name}`,
      type: 'article',
      noindex: true,
    });
  },
  component: ShufflerExternalRedirect,
});
