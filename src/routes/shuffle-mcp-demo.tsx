import { createFileRoute } from "@tanstack/react-router";
import ShuffleMcpTestPage from '@/pages/ShuffleMcpTestPage';

export const Route = createFileRoute("/shuffle-mcp-demo")({
  component: ShuffleMcpTestPage,
});
