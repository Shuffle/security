import { createFileRoute, redirect } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { RedirectIncidentsSimple } from '@/components/routing/routeShims';

export const Route = createFileRoute("/_dash/incidents-simple/$id")({
  // Redirect on the server (and client) before render so legacy
  // /incidents-simple/<id> links never hit the SSR error page.
  beforeLoad: ({ params, location }) => {
    throw redirect({
      to: `/incidents/${params.id}${location.searchStr ?? ""}`,
      replace: true,
    });
  },
  head: () =>
    routeMeta({
      title: "Incident",
      description: "A simplified incident view for fast triage and response.",
      url: "/incidents-simple/$id",
      noindex: true,
    }),
  component: RedirectIncidentsSimple,
});
