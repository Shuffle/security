import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { MobileAuthGateway } from '@/components/mobile/MobileAuthGateway';

export const Route = createFileRoute("/register")({
  head: () =>
    routeMeta({
      title: 'Create your account',
      description:
        'Create your Shuffle Security account and start automating incident response across 3,000+ integrations.',
      url: '/register',
    }),
  component: RegisterRouteComponent,
});

function RegisterRouteComponent() {
  // Password managers inject DOM into the inputs before hydration, so the
  // form is rendered client-side only (same as /login).
  return (
    <ClientOnly fallback={null}>
      <MobileAuthGateway mode="register" />
    </ClientOnly>
  );
}
