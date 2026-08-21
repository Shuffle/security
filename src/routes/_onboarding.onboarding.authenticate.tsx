import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import OnboardingPage from '@/pages/OnboardingPage';

export const Route = createFileRoute("/_onboarding/onboarding/authenticate")({
  head: () =>
    routeMeta({
      title: "Onboarding — Authenticate apps",
      description: "Connect and authenticate the security tools you already use.",
      url: "/onboarding/authenticate",
      noindex: true,
    }),
  component: OnboardingPage,
});
