import { createFileRoute } from "@tanstack/react-router";
import DocsPage from '@/pages/docs/DocsPage';
import { routeMeta } from '@/lib/routeMeta';

export const Route = createFileRoute("/articles/")({
  head: () =>
    routeMeta({
      title: "Articles",
      description: "Security automation articles and guides from the Shuffle team.",
      url: "/articles",
      breadcrumbs: [{ name: "Home", path: "/" }],
    }),
  component: ArticlesIndexRoute,
});

function ArticlesIndexRoute() {
  return <DocsPage folder="articles" basePath="/articles" sectionTitle="Articles" />;
}

