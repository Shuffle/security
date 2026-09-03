import { createFileRoute, Outlet, useMatches, ClientOnly } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { MobileAuthGateway } from '@/components/mobile/MobileAuthGateway';

export const Route = createFileRoute("/login")({
  head: () =>
    routeMeta({
      title: 'Sign in',
      description:
        'Sign in to Shuffle Security to manage incidents, alerts, and security automation.',
      url: '/login',
    }),
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  const matches = useMatches();
  const currentMatch = matches[matches.length - 1];
  const isExactLogin = currentMatch?.routeId === Route.id;

  if (!isExactLogin) {
    return <Outlet />;
  }

  return <MobileAuthGateway />;
}
