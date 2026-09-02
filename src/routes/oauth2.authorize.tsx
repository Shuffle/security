import { createFileRoute } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import OAuthAuthorizeView from '@/components/oauth/OAuthAuthorizeView';

export const Route = createFileRoute("/oauth2/authorize")({
  head: () =>
    routeMeta({
      title: 'Authorize Application',
      description:
        'Authorize application or service access to Shuffle Security.',
      url: '/oauth2/authorize',
      noindex: true,
    }),
  component: OAuthAuthorizeView,
});
