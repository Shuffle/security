import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from "@/lib/routeMeta";
import AdminPage from "@/pages/dashboard/AdminPage";

export const Route = createFileRoute("/_dash/admin/locations")({
  head: () =>
    routeMeta({
      title: "Runtime locations",
      description:
        "Manage default runtime location and execution environments for Shuffle Security workflows.",
      url: "/admin/locations",
      noindex: true,
    }),
  component: AdminPage,
});
