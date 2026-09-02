import { createFileRoute } from "@tanstack/react-router";
import AuthPage from '@/pages/AuthPage';
import { routeMeta } from '@/lib/routeMeta';
import { isCapacitorNative } from '@/Shuffle-MCPs/api';
import { MobileAuthGateway } from '@/components/mobile/MobileAuthGateway';

const LoginView = () => {
  const isMobileParam =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('mobile') === 'true' ||
      new URLSearchParams(window.location.search).get('app') === 'true');

  if (isCapacitorNative() || isMobileParam) {
    return <MobileAuthGateway />;
  }

  return <AuthPage mode="login" />;
};

export const Route = createFileRoute("/login")({
  head: () =>
    routeMeta({
      title: 'Sign in',
      description:
        'Sign in to Shuffle Security to manage incidents, alerts, and security automation.',
      url: '/login',
    }),
  component: LoginView,
});

