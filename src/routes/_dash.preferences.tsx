import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dash/preferences")({
  beforeLoad: () => {
    throw redirect({ to: '/admin/preferences' });
  },
});
