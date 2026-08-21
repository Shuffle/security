import { createFileRoute } from "@tanstack/react-router";
import DocsPage from '@/pages/docs/DocsPage';

export const Route = createFileRoute("/docs/$slug")({
  component: DocsPage,
});
