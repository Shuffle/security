import { createFileRoute } from "@tanstack/react-router";
import VulnerabilitiesPage from '@/pages/dashboard/VulnerabilitiesPage';

export const Route = createFileRoute("/_cond/vulnerabilities/")({
  component: VulnerabilitiesPage,
});
