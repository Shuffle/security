# Simplified case view

## Goal
Add a new default **Simple** tab to every incident, alert, and case detail page. Keep the current experience available as **Detailed**, with all existing data and actions unchanged.

## Layout
```text
Existing incident header

Timeline        Description or Email        Contents
(narrow)        Tasks                       Open tasks
                Observables
                Correlations
```

- Desktop: three columns with a narrow communication timeline, a wide document-like center, and a sticky contents rail.
- Smaller screens: center content first, then timeline; hide the separate contents rail when space is limited.
- Preserve the current top section and its status, severity, assignee, refresh, AI, and actions controls.

## Simple tab
- Make **Simple** the default tab when no `tab` parameter is present.
- Add **Detailed** as the second tab and keep the current detail layout there.
- Keep Tasks, Observables, Correlations, Original, Translation, and OCSF tabs available as focused views.
- Make links from the simple view scroll to sections in place; existing detailed timeline links continue switching focused tabs.

## Center document
- Render Description or Email first, followed by Tasks, Observables, and Correlations in one continuous page.
- Remove outer cards and section borders. Use heading scale, whitespace, indentation, and subtle state changes for hierarchy.
- Keep description directly editable with a text-like surface.
- Render tasks as a compact editable checklist; retain the existing task board in its focused tab.
- Render observables and correlations as compact rows using the same state, counts, lookup actions, and persistence as the focused tabs.

## Right contents rail
- Add sticky links for Description/Email, Tasks, Observables, and Correlations.
- Show section counts where useful.
- Include open tasks beneath the section links; clicking one scrolls to that task in the center column.
- Track the visible center section so the active contents entry is clear.

## Technical details
- Implement the simple composition inside the existing incident detail page so it reuses the loaded incident, unsaved edits, save pipeline, public-view restrictions, and cross-tenant handling.
- Add only small presentation helpers or props where existing email/task/correlation components need a borderless mode.
- Keep query-string tab behavior backward compatible: existing `?tab=details`, `tasks`, `observables`, and other links continue to work.
- Remove the current Ask AI server/client visibility mismatch while validating the page.

## Validation
- Check default Simple and explicit Detailed/focused tabs.
- Verify description edits, task completion/title changes, observables, correlations, timeline comments, and contents scrolling all use the same incident state.
- Check desktop and mobile layouts, empty sections, email incidents, public read-only views, and merged incidents.
- Run targeted type checks and browser checks for hydration and layout stability.
