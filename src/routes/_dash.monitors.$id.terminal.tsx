import { createFileRoute } from "@tanstack/react-router";
import HostTerminalPage from '@/pages/dashboard/HostTerminalPage';

export const Route = createFileRoute("/_dash/monitors/$id/terminal")({
  component: HostTerminalPage,
});
