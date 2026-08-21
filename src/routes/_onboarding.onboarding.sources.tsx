import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import OnboardingPage from '@/pages/OnboardingPage';

export const Route = createFileRoute("/_onboarding/onboarding/sources")({
  head: () =>
    routeMeta({
      title: "Onboarding — Ingestion sources",
      description: "Choose where your alerts, emails and logs come from.",
      url: "/onboarding/sources",
      noindex: true,
    }),
  component: OnboardingPage,
});
