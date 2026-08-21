import { createFileRoute } from "@tanstack/react-router";
import AuthPage from '@/pages/AuthPage';

export const Route = createFileRoute("/register")({
  component: () => <AuthPage mode="register" />,
});
