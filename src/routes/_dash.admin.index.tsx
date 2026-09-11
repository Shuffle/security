import { createFileRoute, redirect } from "@tanstack/react-router";
import { routeMeta } from '@/lib/routeMeta';
import AdminPage from '@/pages/dashboard/AdminPage';

export const Route = createFileRoute("/_dash/admin/")({
  beforeLoad: ({ location }) => {
    const searchStr = location.searchStr || (typeof window !== "undefined" ? window.location.search : "");
    if (!searchStr) return;
    const sp = new URLSearchParams(searchStr);
    const tab = sp.get("tab") || sp.get("admin_tab");
    if (tab) {
      const tabRoutes: Record<string, string> = {
        datastore: "/admin/datastore",
        users: "/admin/users",
        tenants: "/admin/tenants",
        "runtime-locations": "/admin/runtime-locations",
        locations: "/admin/runtime-locations",
        preferences: "/admin/preferences",
      };
      const target = tabRoutes[tab.toLowerCase()];
      if (target) {
        sp.delete("tab");
        sp.delete("admin_tab");
        const remaining = sp.toString();
        throw redirect({
          href: `${target}${remaining ? `?${remaining}` : ""}`,
        });
      }
    }
  },
  head: () =>
    routeMeta({
      title: "Administration",
      description: "Manage organizations, users, tenants and platform settings.",
      url: "/admin",
      noindex: true,
    }),
  component: AdminPage,
});

