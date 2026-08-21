import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import OnboardingPage from '@/pages/OnboardingPage';

export const Route = createFileRoute("/_onboarding/onboarding/")({
  head: () =>
    routeMeta({
      title: "Onboarding",
      description: "Set up ingestion, integrations and automation in a few guided steps.",
      url: "/onboarding",
      noindex: true,
    }),
  component: OnboardingPage,
});
