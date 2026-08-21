import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import ShuffleCoreTestPage from '@/pages/ShuffleCoreTestPage';

export const Route = createFileRoute("/shuffle-core")({
  head: () =>
    routeMeta({
      title: "Shuffle Core components",
      description: "Preview the Shuffle Core component library used across the platform.",
      url: "/shuffle-core",
      noindex: true,
    }),
  component: ShuffleCoreTestPage,
});
