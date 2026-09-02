import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from "@/lib/routeMeta";
import MFASetUP from "@/Shuffle-Core/views/MFASetUP";

export const Route = createFileRoute("/login/$url/mfa-setup")({
  head: () =>
    routeMeta({
      title: "MFA Setup",
      description: "Set up multi-factor authentication for your Shuffle account.",
      url: "/login/$url/mfa-setup",
      noindex: true,
    }),
  component: MFASetupRouteComponent,
});

function MFASetupRouteComponent() {
  const { url } = Route.useParams();
  return <MFASetUP token={url} isLoaded={true} />;
}
