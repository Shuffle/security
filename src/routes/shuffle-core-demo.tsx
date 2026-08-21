import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import ShuffleCoreTestPage from '@/pages/ShuffleCoreTestPage';

export const Route = createFileRoute("/shuffle-core-demo")({
  head: () =>
    routeMeta({
      title: "Shuffle Core demo",
      description: "Interactive demo of the Shuffle Core component library.",
      url: "/shuffle-core-demo",
      noindex: true,
    }),
  component: ShuffleCoreTestPage,
});
