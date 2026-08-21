import { createFileRoute } from "@tanstack/react-router";
import AuthPage from '@/pages/AuthPage';
import { routeMeta } from '@/lib/routeMeta';

export const Route = createFileRoute("/register")({
  head: () =>
    routeMeta({
      title: 'Create your account',
      description:
        'Create your Shuffle Security account and start automating incident response across 3,000+ integrations.',
      url: '/register',
    }),
  component: () => <AuthPage mode="register" />,
});
