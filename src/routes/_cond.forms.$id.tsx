import { createFileRoute } from "@tanstack/react-router";
import FormsPage from '@/pages/dashboard/FormsPage';

export const Route = createFileRoute("/_cond/forms/$id")({
  component: FormsPage,
});
