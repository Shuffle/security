## Why this is broken today

- `Add Host-Monitors` (`case_management_asset_management_monitors_1`) is configured with `customAction.href = '/monitors?add_host=true'`. The customAction path in `Usecases.tsx` only ever renders a `<Button as={Link} to=...>` — it has no way to open a modal inline in the sidebar drawer, so the user has to leave the page.
- The route `/monitors` in `src/App.tsx` is actually backed by `src/pages/dashboard/VulnAssetsPage.tsx` (1.7k lines). The page is correctly mounted at `/monitors`, but because the file/component is named "VulnAssets" and the Add Host modal lives inside that file, it looks (and reads, in the code) like the action targets vulnerabilities — not monitors.
- The Add Host dialog and all monitor UI (host table, host detail panel, terminal, action popovers) live in the host app under `src/pages/dashboard` + `src/components/monitors`, so they can't be reused inside Shuffle-Core (sidebar, dashboards, onboarding, anywhere else).

## What we will do

### 1. Extract the monitors UI into Shuffle-Core
Create a self-contained Monitors module in `src/Shuffle-Core/views/monitors/`:

```text
src/Shuffle-Core/views/monitors/
  MonitorsView.tsx          // page-level UI (was VulnAssetsPage body)
  AddHostDialog.tsx         // standalone Add Host modal (checks + deploy steps)
  MonitorHostTable.tsx      // moved from src/components/monitors
  HostDetailPanel.tsx       // moved
  HostActionPopover.tsx     // moved
  HostTerminalView.tsx      // moved
  ActionOutputView.tsx      // moved
  DisableRceConfirmDialog.tsx
  hostActionDefinitions.tsx
  index.ts                  // public exports: MonitorsView, AddHostDialog
```

Rules during the move:
- Replace any host-only imports (`@/components/...`, `@/hooks/...`) with either Shuffle-Core equivalents or props/slots. Hooks that talk to the API (`useHostActions`, `useVulnerabilities` host-data parts) move into `src/Shuffle-Core/hooks/` only if they only depend on the existing Shuffle-Core API client; otherwise expose them as injected props on `MonitorsView`.
- Keep the file naming "Monitor*" everywhere — drop the "Vuln" terminology from the monitors module entirely.
- Export `MonitorsView` and `AddHostDialog` from `src/Shuffle-Core/index.tsx`.

### 2. Rewire the host app to the new module
- `src/pages/dashboard/VulnAssetsPage.tsx` becomes a thin wrapper that renders `<MonitorsView />` from Shuffle-Core and passes any host-only props (auth, navigation helpers, demo mode).
- Rename the file to `MonitorsPage.tsx` and update the import in `src/App.tsx` (`/monitors` route). `/vulnerabilities` stays on its existing page; nothing about vulnerabilities moves.
- Delete the moved files under `src/components/monitors/` (or leave one-line re-export shims if anything else still imports them — a quick `rg` will confirm).

### 3. Make the usecase sidebar embed Add Host inline
Extend the customAction contract so a usecase can request an inline dialog instead of (or in addition to) a navigation:

```ts
customAction?: {
  label: string;
  description?: string;
  href?: string;        // existing
  url?: string;         // existing
  modal?: 'add-host';   // NEW — typed key, resolved by the host
};
```

- In `Usecases.tsx`, when `customAction.modal` is set, render the CTA as a `<Button onClick={...}>` that opens the dialog instead of a `Link`.
- The host wires the actual modal via a new `renderUsecaseActionModal` slot on `<Usecases />` (same pattern already used for `renderEndpointSlot` / `renderUsecaseDetailSlot` in `src/pages/dashboard/UsecasesPage.tsx`). The host returns `<AddHostDialog open={...} onClose={...} />` for the `'add-host'` key.
- Update the `Add Host-Monitors` usecase entry in both `src/Shuffle-Core/views/Usecases.tsx` and `src/Shuffle-Core/config/usecases.ts` to use `modal: 'add-host'` and drop the `?add_host=true` href.
- Keep the URL-param auto-open (`?add_host=true`) on `MonitorsView` so any remaining deep links still work.

### 4. Verification
- `/monitors` still renders the full monitors UI (table, detail, terminal, Add Host).
- The `Add Host-Monitors` card in the usecase grid + sidebar opens the Add Host dialog inline on the current page.
- `src/Shuffle-Core/views/monitors/` has no imports from `@/components/monitors`, `@/pages/dashboard`, or vulnerability code.
- `rg "from '@/components/monitors'"` returns nothing (or only shims).

## Out of scope
- No changes to `/vulnerabilities`, CVE pages, or vulnerability data flow.
- No backend / API changes — same endpoints, same payloads.
- No visual redesign of the Add Host modal; same two-step (checks → deploy) flow.
