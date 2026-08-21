import { createFileRoute } from "@tanstack/react-router";
import AuthPage from '@/pages/AuthPage';

export const Route = createFileRoute("/login")({
  component: () => <AuthPage mode="login" />,
});
