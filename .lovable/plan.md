
Plan to make “Developer: Use API Key” visible again in preview and only preview:

1) Audit and tighten the visibility gate in `src/pages/AuthPage.tsx`
- Replace the current hostname check:
  - `window.location.hostname.includes('lovable.app')`
- With the existing environment helper:
  - `isDevEnvironment()`
- Final condition will be:
  - `isLogin && isDevEnvironment()`
- This avoids brittle hardcoded domain matching and aligns with your requirement to show it in preview.

2) Keep scope minimal (no unrelated UI/auth changes)
- Do not alter login behavior, API key validation flow, redirects, or styling.
- Only change the render condition for the API key section.

3) Verify behavior in both environments
- Preview (`/login` on id-preview/lovableproject preview): API key option is visible.
- Published site (`/login`): API key option is hidden.
- Register route (`/register`): API key option remains hidden.

Technical details
- `AuthPage` already imports `isDevEnvironment` from `src/config/api.ts`, so this is a one-line logic fix.
- `isDevEnvironment()` currently detects Lovable preview environments (`lovableproject.com` and `id-preview--...`), which is exactly what we need for preview-only display.
