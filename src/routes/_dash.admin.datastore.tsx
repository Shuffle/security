import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from "@/lib/routeMeta";
import AdminPage from "@/pages/dashboard/AdminPage";

export const Route = createFileRoute("/_dash/admin/datastore")({
  head: () =>
    routeMeta({
      title: "Datastore",
      description: "Manage and inspect Shuffle datastore entries, categories, and automations.",
      url: "/admin/datastore",
      noindex: true,
    }),
  component: AdminPage,
});
