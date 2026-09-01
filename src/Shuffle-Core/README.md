# Shuffle-Core

React surfaces extracted from the Shuffle Security app — the Usecases
explorer, workflow editor entry points, dashboards, billing/tenant admin,
and shared form controls.

**Live demo:** [shuffle.security/shuffle-core-demo](https://shuffle.security/shuffle-core-demo) — every exported component rendered with its source snippet.

## Install

```bash
npm install @shuffleio/shuffle-core
```

Peer deps: `react >= 18`, `react-dom >= 18`, `@mui/material >= 5`,
`lucide-react`, `react-router-dom`, `react-ga4`,
and `@shuffleio/shuffle-mcps` (used for the embedded app search drawer).

## Quick start

```tsx
import { Usecases } from '@shuffleio/shuffle-core';
import '@shuffleio/shuffle-core/shuffle-core.css';

export default function App() {
  return <Usecases />;
}
```

Mount inside your own router under whichever path you want — the component
reads `:flowId` from `useParams()` and `selected_object` from `useSearchParams()`
when running under `react-router-dom`.

## Components

Every component below is rendered live (with source) on the demo page.

| Component | Description | Demo |
|---|---|---|
| `Usecases` (default) | Full Usecases explorer — card grid plus per-usecase detail view | [#1](https://shuffle.security/shuffle-core-demo#1) |
| `UsecaseAlluvialDiagram` | Source-tools → Shuffle → destination-tools alluvial visualization | [#2](https://shuffle.security/shuffle-core-demo#2) |
| `OnboardingFlow` | Shared Sources → Authenticate → Automate onboarding flow | [#3](https://shuffle.security/shuffle-core-demo#3) |
| `ProductChoiceStep` | Standalone "Which Shuffle are you using?" picker step | [#4](https://shuffle.security/shuffle-core-demo#4) |
| `FormInput` | Public-facing form runner for a workflow's `form_control.input_questions` | [#5](https://shuffle.security/shuffle-core-demo#5) |
| `RecentWorkflow` | Sidebar / dashboard card for a recently edited workflow | [#6](https://shuffle.security/shuffle-core-demo#6) |
| `AutomationDashboard` | Greeting plus workflow / app activity charts and filters | [#7](https://shuffle.security/shuffle-core-demo#7) |
| `DashboardOverview` | SOC overview: incidents, vuln severity, monitors, sensors | [#8](https://shuffle.security/shuffle-core-demo#8) |
| `CombinedDashboard` | `AutomationDashboard` + `DashboardOverview` composed together | — |
| `EditWorkflow` | Create / edit workflow modal (name, tags, form questions, AI gen) | [#9](https://shuffle.security/shuffle-core-demo#9) |
| `Billing` | License, subscription and app-run usage panel (cloud + on-prem) | [#10](https://shuffle.security/shuffle-core-demo#10) |
| `TenantManagement` | Multi-tenant manager: current, parent, sub-tenants, all tenants | [#11](https://shuffle.security/shuffle-core-demo#11) |
| `NotificationsDrawer` | Right-hand drawer with workflow executions and agent requests. Open from anywhere by dispatching `NOTIFICATIONS_OPEN_EVENT` | [#12](https://shuffle.security/shuffle-core-demo#12) |
| `NotificationSettings` | Device push registration plus Critical Pager / Agent Request / General notification sections, with on-call duty, team scheduling and simulate-call in the top-right menu | [#13](https://shuffle.security/shuffle-core-demo#13) |
| `OnCallScheduleManager` | Per-user availability windows, escalation tiers, weekly timeline and schedule import (`assignment_schedules` datastore item) | [#14](https://shuffle.security/shuffle-core-demo#14) |
| `AddAppDialog` / `AddAppButton` | Add-app modal and its trigger button | — |
| `WorkflowRunExplorer` / `WorkflowRunExplorerDrawer` | Workflow execution explorer, inline or in a drawer | — |
| `CategoryAutomationsDialog` | Category-scoped automations picker dialog | — |

## Helpers and hooks

| Export | Description |
|---|---|
| `ShuffleCoreThemeProvider` | MUI theme provider used by every surface — pass `mode="light" \| "dark" \| "auto"` |
| `usePageMeta` | Hook that sets `<title>`, OG tags, and JSON-LD for the current page |
| `useSyncHostBaseUrl` | Keep the library's API base URL in sync with the host app |
| `toast` / `setToastImpl` | Tiny toast facade — swap in your own impl via `setToastImpl` |
| `API_CONFIG`, `getApiUrl`, `getAuthHeader`, `shuffleFetch` | Shared API helpers |
| `setRegionUrl`, `resetRegionUrl`, `setHostBaseUrl`, `getHostBaseUrl` | Region / base URL controls |
| `installFetchBreaker`, `registerProtectedOrigin` | Opt-in fetch circuit breaker for cross-origin protection |
| `getPagerSettings`, `savePagerSettings`, `requestNotificationPermissions`, `testPagerCall` | Local pager/notification settings and permissions |
| `dispatchCriticalPage`, `dispatchAgentRequestNotification`, `dispatchGeneralNotification` | Send notifications through the backend |
| `fetchNotificationDevices`, `saveNotificationDevice`, `resolveDevicePreferences`, `getLocalDeviceId`, `getLocalDeviceName`, `getLocalDevicePlatform` | Per-device push registration helpers |
| `computeDefaultPolicy` | Default escalation policy used by `OnCallScheduleManager` |


## Theming

Every exported component accepts a `theme` prop:

- `"light"` / `"dark"` — pin the subtree to that scheme
- `"system"` — follow the host page's `.dark` class on `<html>`

If omitted, components default to `"dark"` (Shuffle's primary surface).

## Status

Published from the Shuffle Security host app verbatim. Some host-app peers
(`@/context/AuthContext`, `@/lib/utils`, `@/config/usecases`) are still
imported by a few surfaces and are being inlined / made injectable in
ongoing passes.
