import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import OnboardingPage from '@/pages/OnboardingPage';

export const Route = createFileRoute("/_onboarding/onboarding/product")({
  head: () =>
    routeMeta({
      title: "Onboarding — Choose product",
      description: "Pick the Shuffle Security capabilities you want to start with.",
      url: "/onboarding/product",
      noindex: true,
    }),
  component: OnboardingPage,
});
