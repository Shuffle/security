import { createFileRoute } from "@tanstack/react-router";
import PricingPage from '@/pages/PricingPage';
import { routeMeta } from '@/lib/routeMeta';

export const Route = createFileRoute("/pricing")({
  head: () =>
    routeMeta({
      title: 'Pricing',
      description:
        'Shuffle Security pricing — start free and scale incident management, vulnerability handling and response automation across cloud, on-prem or hybrid.',
      url: '/pricing',
      breadcrumbs: [{ name: 'Home', path: '/' }],
    }),
  component: PricingPage,
});
