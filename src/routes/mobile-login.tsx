import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import { MobileAuthGateway } from '@/components/mobile/MobileAuthGateway';

export const Route = createFileRoute("/mobile-login")({
  head: () =>
    routeMeta({
      title: 'Mobile App Login',
      description:
        'Mobile application sign-in gateway for Shuffle Security.',
      url: '/mobile-login',
      noindex: true,
    }),
  component: MobileAuthGateway,
});
