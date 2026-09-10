# Shuffle Branding & Styling Rules

## Logo & Branding Guidelines

### 1. Main Company Brand & Mobile App Logo
- **Entities & Products**: "Shuffle", "Shuffle LLC", "Shuffle AS", "Shuffle AI", and the **Shuffle Mobile App** (App icon, splash screens, Android/iOS native packaging).
- **Logo**: The main **Shuffle Automation** brand logo (the primary icon representing the company and platform).

### 2. Shuffle Security Logo
- **Entities & Products**: **Shuffle Security** specifically.
- **Usage**: Used on the Shuffle Security web application, web navigation header, web landing pages, footer, and sidebar product switcher to clearly distinguish Shuffle Security from other Shuffle products.
- **Logo Component**: [`ShuffleLogo`](src/components/common/ShuffleLogo.tsx) / [`ShuffleSecurityLogo`](src/components/common/ShuffleLogo.tsx) rendering the geometric vector "S" badge (`d="M14 14h28v6H20v16h16v-10h-8v-6h14v22H14V14z"`).

### 3. Agent & AI Logo
- **Entities & Products**: "Agents", "Shuffle AI", "Shuffle Agents", agent executions, and subagent views.
- **Logo**: The dedicated **Agent** logo / icon.

---

## Documentation Rules & Voice

### 1. GitHub-First & Graceful Degradation
- All documentation files (`.md`) must be 100% complete, readable, and functional when viewed in raw Markdown or rendered directly on GitHub/GitLab.
- Dynamic component injections (`<!-- component:<name> <props> -->`) are treated as pure HTML comments by standard Markdown engines and will not render on GitHub.
- **Never rely on a dynamic component to deliver essential information or steps.**
  - Always provide the manual UI navigation path, REST API endpoint, or `curl` example right next to the component.
  - Never write dangling calls-to-action like *"Click the button below to do X"*. Instead write: *"Use the interactive panel below, or navigate to `/incidents` -> **Webhook** in the header bar."*
  - Include static tables, screenshots, or ASCII flow diagrams so readers on GitHub get full visual context without live widgets.

### 2. Dynamic & Actionable in the Web App
- When rendered inside the Shuffle Security / Shuffle Core web application, documentation should not be passive text—it should be an operational console.
- Injected components must perform real work (triggering ingestion sync, toggling webhooks, testing payloads, querying live queues, or executing inline AI tasks) so users can understand and verify system status directly from the doc.

### 3. Shuffle Voice & Tone ("Sound Like Us")
- **Engineer-to-engineer**: Written for real analysts, detection engineers, and SecOps practitioners. Talk about real problems (alert fatigue, schema changes, SIEM noise, API rate limits).
- **No corporate jargon**: No marketing fluff, no buzzword soup. Direct, concise, and technically accurate.
- **Honest and pragmatic**: Explain the design rationale plainly. Be transparent about open source, licensing, and architecture.
- **Action-oriented**: Give analysts the command, the endpoint, or the button to solve their problem immediately.

---

## Strict Visual & Typography Rules

### ABSOLUTE PROHIBITION ON ICONS AND EMOJIS
- **NEVER, EVER USE ICONS OR EMOJIS. UNDER ANY CIRCUMSTANCES.**
- **No Emojis Anywhere**:
  - Never use emojis in documentation (`.md`), comments, code, UI text, or component properties.
  - No camera emojis, checkmarks, warning/alert emojis, tools, packages, locks, shields, or any Unicode pictorial characters.
  - Instead of checkmark emojis, write plain text: `Passed`, `Verified`, or `Done`.
- **No Decorative Icons in Components or Documentation**:
  - Do not use emoji characters or decorative icons in UI components, cards, lists, badges, or buttons (e.g., never do `icon: "..."`).
  - Do not create "Icon" or "Icon / Key" columns in documentation tables.
  - Rely exclusively on clean, plain-text engineering typography, crisp borders, and structured data tables.

### Hidden Internal Comments & Editorial Placeholders
- **Never render visible placeholder callouts in docs** (e.g., never do `> **Screenshot Needed: ...**` or `> **Note: need more info**`).
- **Always use standard HTML comments** (`<!-- TODO: ... -->` or `<!-- NOTE: ... -->`) for internal editorial notes, missing screenshots, or areas to revisit:
  ```markdown
  <!-- TODO: Screenshot Needed: Ingestion Webhook Dialog
  - Location: /incidents -> Webhook button in header
  - What to capture: Modal with webhook URL, toggle switch, and curl command
  - Target path: assets/incidents-webhook-modal.png -->
  ```
- Standard HTML comments are completely hidden and never rendered on GitHub or on the documentation website, keeping published documentation production-ready while preserving full context for contributors in the source code.
