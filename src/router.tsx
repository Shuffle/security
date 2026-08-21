// Must be first: installs the in-memory localStorage/sessionStorage shim so
// modules that read storage during SSR do not crash the render. The server
// entry also imports it, but dev SSR does not go through that entry.
import "./lib/ssr-storage";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
