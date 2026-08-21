import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { ShufflerExternalRedirect } from '@/components/routing/routeShims';

const titleize = (slug: string) =>
  slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const Route = createFileRoute("/blog/$name")({
  head: ({ params }) => {
    const name = titleize(params.name);
    return routeMeta({
      title: name,
      description: `${name} — product updates and security automation writing from the Shuffle Security team.`,
      url: `/blog/${params.name}`,
      type: 'article',
      noindex: true,
    });
  },
  component: ShufflerExternalRedirect,
});
