import { createFileRoute } from "@tanstack/react-router";
import ShuffleCoreTestPage from '@/pages/ShuffleCoreTestPage';

export const Route = createFileRoute("/shuffle-core-demo")({
  component: ShuffleCoreTestPage,
});
