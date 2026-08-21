import { createFileRoute } from "@tanstack/react-router";
import AppsPage from '@/pages/AppsPage';

export const Route = createFileRoute("/apps")({
  component: AppsPage,
});
