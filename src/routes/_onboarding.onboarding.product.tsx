import { createFileRoute } from "@tanstack/react-router";
import OnboardingPage from '@/pages/OnboardingPage';

export const Route = createFileRoute("/_onboarding/onboarding/product")({
  component: OnboardingPage,
});
