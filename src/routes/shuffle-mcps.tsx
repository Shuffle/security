import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import ShuffleMcpTestPage from '@/pages/ShuffleMcpTestPage';

export const Route = createFileRoute("/shuffle-mcps")({
  head: () =>
    routeMeta({
      title: "Shuffle MCPs",
      description: "Preview the Shuffle MCP component library and agent surfaces.",
      url: "/shuffle-mcps",
      noindex: true,
    }),
  component: ShuffleMcpTestPage,
});
