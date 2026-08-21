import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import OnboardingPage from '@/pages/OnboardingPage';

export const Route = createFileRoute("/_onboarding/onboarding/welcome")({
  head: () =>
    routeMeta({
      title: "Onboarding — Welcome",
      description: "Welcome to Shuffle Security. Let us get your workspace ready.",
      url: "/onboarding/welcome",
      noindex: true,
    }),
  component: OnboardingPage,
});
