/**
 * Table of Contents utilities for documentation pages.
 */

export interface TocHeading {
  id: string;
  text: string;
  level: number; // 2 for h2, 3 for h3, etc.
  children: TocHeading[];
}

/**
 * Normalizes heading text into a URL/anchor friendly key.
 * Uses underscore separation to stay 100% compatible with existing Shuffle docs anchors.
 */
export const anchorKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/**
 * Checks if a heading title represents an in-page "Table of Contents".
 */
export const isTocHeading = (text: string): boolean => {
  const norm = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return norm === 'tableofcontents' || norm === 'tableofcontent' || norm === 'toc';
};

/**
 * Strips inline markdown syntax (formatting, links, inline code, images) from a heading string.
 */
export const stripMarkdownInline = (value: string): string =>
  value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> label
    .replace(/<[^>]+>/g, '') // HTML tags
    .replace(/[`*_~#>]/g, '') // formatting
    .replace(/\{#[^}]+\}/g, '') // custom anchor IDs like {#my-anchor}
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Removes in-content legacy "Table of Contents" blocks from raw markdown.
 * If a document has a "## Table of Contents" section followed by a bulleted list,
 * this function removes both the heading and the list.
 */
export const stripInContentToc = (markdown: string): string => {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inToc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for a heading line
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const headingText = stripMarkdownInline(headingMatch[2]);
      if (isTocHeading(headingText)) {
        inToc = true;
        continue;
      } else if (inToc) {
        // Reached next actual section heading, exit TOC block
        inToc = false;
      }
    }

    if (inToc) {
      // While inside the TOC block, skip empty lines, list items, horizontal rules, or blockquotes
      if (
        !trimmed ||
        /^[-*+]\s+/.test(trimmed) ||
        /^\d+\.\s+/.test(trimmed) ||
        /^[-*_]{3,}$/.test(trimmed) ||
        /^>/.test(trimmed) ||
        /^<ul[\s\S]*?<\/ul>$/i.test(trimmed)
      ) {
        continue;
      } else {
        // Reached normal body text, exit TOC block
        inToc = false;
      }
    }

    result.push(line);
  }

  return result.join('\n');
};

/**
 * Extracts a hierarchical list of H2 and H3 headings from markdown content.
 * Code blocks are ignored, in-content TOCs are excluded, and duplicate IDs are deduplicated.
 */
export const extractHeadings = (rawMarkdown: string): TocHeading[] => {
  if (!rawMarkdown) return [];

  // Remove code blocks first so code examples containing '#' are not matched as headings
  const withoutCodeBlocks = rawMarkdown.replace(/```[\s\S]*?```/g, '');

  const lines = withoutCodeBlocks.split('\n');
  const flatHeadings: { id: string; text: string; level: number }[] = [];
  const seenIds = new Map<string, number>();

  let inTocSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Match ## or ### headings
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (!match) {
      if (inTocSection && !/^[-*+\d\s]/.test(line) && line.length > 0) {
        inTocSection = false;
      }
      continue;
    }

    const level = match[1].length;
    // Remove trailing hashes e.g. "## Heading ##"
    const rawHeadingText = match[2].replace(/\s+#+$/, '').trim();
    const cleanText = stripMarkdownInline(rawHeadingText);

    if (!cleanText) continue;

    // Skip if it's a "Table of Contents" / "TOC" heading
    if (isTocHeading(cleanText)) {
      inTocSection = true;
      continue;
    }
    inTocSection = false;

    // Generate unique anchor ID
    const baseId = anchorKey(cleanText) || `section_${flatHeadings.length}`;
    const count = seenIds.get(baseId) || 0;
    seenIds.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}_${count}`;

    flatHeadings.push({ id, text: cleanText, level });
  }

  // Build tree: H2 are top-level parents, H3 are children of the preceding H2
  const tree: TocHeading[] = [];
  let currentParent: TocHeading | null = null;

  for (const item of flatHeadings) {
    if (item.level === 2) {
      currentParent = {
        id: item.id,
        text: item.text,
        level: 2,
        children: [],
      };
      tree.push(currentParent);
    } else if (item.level === 3) {
      const child: TocHeading = {
        id: item.id,
        text: item.text,
        level: 3,
        children: [],
      };
      if (currentParent) {
        currentParent.children.push(child);
      } else {
        // H3 without an H2 parent - treat as top-level item
        tree.push(child);
      }
    }
  }

  return tree;
};
