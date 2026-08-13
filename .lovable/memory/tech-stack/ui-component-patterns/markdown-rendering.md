---
name: Markdown rendering standard
description: All block markdown goes through ShuffleMarkdown (src/Shuffle-MCPs/components/Markdown.tsx); InlineMarkdown for one-liners. Never import react-markdown directly.
type: preference
---
`ShuffleMarkdown` (`src/Shuffle-MCPs/components/Markdown.tsx`, re-exported from `@/components/shared/Markdown` and the Shuffle-MCPs package index) is the single block-level markdown renderer.

Defaults: remark-gfm + remark-breaks + rehype-sanitize, external links get `target="_blank" rel="noopener noreferrer"` (internal `/` links stay in-tab), shared HSL-token styling for code, pre, tables, blockquote, hr, img.

Props: `components` (merged over defaults), `remarkPlugins` (appended), `disableBreaks` (prose docs), `sx`, `className`.

Use `src/components/shared/InlineMarkdown.tsx` for single-line strings (titles, chips). Do NOT import `react-markdown` / remark plugins directly in views. Raw HTML is never enabled (no rehype-raw).
