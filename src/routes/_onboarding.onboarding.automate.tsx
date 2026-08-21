import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import OnboardingPage from '@/pages/OnboardingPage';

export const Route = createFileRoute("/_onboarding/onboarding/automate")({
  head: () =>
    routeMeta({
      title: "Onboarding — Automate",
      description: "Enable your first automated detection and response usecases.",
      url: "/onboarding/automate",
      noindex: true,
    }),
  component: OnboardingPage,
});
