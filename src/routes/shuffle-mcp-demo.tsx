import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import ShuffleMcpTestPage from '@/pages/ShuffleMcpTestPage';

export const Route = createFileRoute("/shuffle-mcp-demo")({
  head: () =>
    routeMeta({
      title: "Shuffle MCP demo",
      description: "Interactive demo of the Shuffle MCP components and AI agent UI.",
      url: "/shuffle-mcp-demo",
      noindex: true,
    }),
  component: ShuffleMcpTestPage,
});
