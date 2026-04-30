---
name: Merge candidate suggestions
description: Banner on the incident detail page surfacing past incidents to merge with, scored by shared observables/correlations/IOCs/title
type: feature
---
The Incident detail page shows a "N possible duplicates found in the last 30 days" banner above the agent action banner. It is rendered by `src/components/incidents/MergeCandidatesBanner.tsx` and powered by:

- `src/utils/mergeCandidateScoring.ts` — pure scoring fn. Weights:
  - shared known IOC observable: 10
  - shared correlation key: 6
  - shared observable (type+value): 3
  - title bigram-Jaccard ≥ 0.45: + 4 × similarity
  - skips candidates with `merged_into`, `status === 'Merged'`, `status_id === 99` (merged), or `status_id === 4` (resolved/closed)
  - skips candidates older than `maxAgeMs` (default 30 days)
- `src/hooks/useMergeCandidates.ts` — fetches the INCIDENTS datastore once per incident, re-scores locally as observables/correlations stream in. Disabled in `isPublicView`. Default limit 3.
- `MergeIncidentDialog` accepts an optional `preselectedTargetId` prop. When set, it opens directly on the confirm step. The banner uses this so "Review & merge" is one click.

Banner state (collapsed / dismissed) persists per-incident in localStorage under `merge-candidates::<incidentId>::expanded` and `::dismissed`.

Reason chips use semantic tones: `--severity-high` for IOC, `--severity-medium` for correlation, `--muted` for plain observable, `--primary` for title similarity.
