import { createFileRoute, redirect, Navigate } from '@tanstack/react-router';
import { routeMeta } from '@/lib/routeMeta';

export const Route = createFileRoute('/adminsetup')({
  head: () =>
    routeMeta({
      title: 'Administrator Setup',
      description:
        'Initialize your self-hosted Shuffle server administrator account.',
      url: '/adminsetup',
      noindex: true,
    }),
  beforeLoad: () => {
    throw redirect({
      to: '/login',
      search: { mode: 'adminsetup' },
      replace: true,
    });
  },
  component: () => <Navigate to="/login" search={{ mode: 'adminsetup' }} replace />,
});
