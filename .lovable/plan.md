# Rename agent "Templates" to "Skills"

Change the agent prompt templates wording to "Skills" so it matches general agent terminology. This is a copy-only change in the agent UI — the unrelated case templates page (/templates) stays as is.

## What changes

- The chip above the agent prompt box reads "+ Skills" instead of "+ Templates".
- The dropdown header reads "Agent skills", with the subtitle "Click a skill to seed the prompt. More coming soon."
- Search placeholder becomes "Search skills…" and the empty state reads "No skills match ...".
- The disabled bottom entry text becomes "Create custom skills for your organization."
- Tooltips and aria labels in the presets trigger updated to "skills".

## Technical notes

- Files touched: `src/Shuffle-MCPs/components/AgentPresets.tsx` (all user-facing strings) and `src/Shuffle-MCPs/components/AgentUI.tsx` (only the strings/comments referencing the "+ Templates" chip label).
- No change to prop names, storage keys, template IDs, or the `/api/v1/agent/{name}` paths — purely display copy, so persisted per-template tool overrides keep working.
