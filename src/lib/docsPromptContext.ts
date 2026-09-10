/**
 * Utilities for dynamically managing and injecting documentation context into
 * AI Agent prompts when on documentation pages (/docs/*, /legal/*).
 */

import { stripInContentToc } from '../components/docs/tocUtils';

export interface ActiveDocInfo {
  title: string;
  content: string;
  slug?: string;
  basePath?: string;
  pathname?: string;
}

// Global window / globalThis key so any component can access the active doc even across bundles
const GLOBAL_DOC_KEY = '__shuffleActiveDocInfo';

const getGlobalScope = (): any => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  return null;
};

/**
 * Registers the active document context (title, raw markdown, slug, pathname) globally.
 */
export const setActiveDocPromptContext = (info: ActiveDocInfo | null) => {
  const scope = getGlobalScope();
  if (!scope) return;
  if (info) {
    scope[GLOBAL_DOC_KEY] = { ...info };
  } else {
    delete scope[GLOBAL_DOC_KEY];
  }
};

/**
 * Retrieves the currently active document context.
 */
export const getActiveDocPromptContext = (): ActiveDocInfo | null => {
  const scope = getGlobalScope();
  if (!scope) return null;
  const info = scope[GLOBAL_DOC_KEY];
  if (info && typeof info === 'object') {
    return info as ActiveDocInfo;
  }
  return null;
};

/**
 * Clears the active document context.
 */
export const clearActiveDocPromptContext = () => {
  setActiveDocPromptContext(null);
};

/**
 * Checks whether a given pathname is a documentation route (/docs, /docs/*, /legal/*).
 */
export const isDocsRoute = (pathname?: string): boolean => {
  if (!pathname) return false;
  return (
    pathname === '/docs' ||
    pathname.startsWith('/docs/') ||
    pathname === '/legal' ||
    pathname.startsWith('/legal/')
  );
};

export const DOC_PROMPT_DELIMITER_START = '--- BEGIN DOCUMENTATION ---';
export const DOC_PROMPT_DELIMITER_END = '--- END DOCUMENTATION ---';
const DOC_PROMPT_PREFIX_REGEX = /^Answer the users? question about (?:["']?)(.*?)(?:["']?) based on(?: on)? the following (?:documentation )?content:/i;

/**
 * Sanitizes markdown content for inclusion in an LLM prompt:
 * - Strips YAML frontmatter
 * - Strips in-content TOC tables/headings
 * - Strips HTML comments, script tags, style tags, and iframes
 * - Replaces huge base64 data URIs with concise placeholders
 * - Normalizes excessive whitespace / newlines
 * - Caps maximum length safely (~35,000 chars) to prevent context exhaustion
 */
export const sanitizeDocMarkdown = (markdown: string): string => {
  if (!markdown || typeof markdown !== 'string') return '';

  let cleaned = markdown;

  // 1. Strip YAML frontmatter at beginning of file
  cleaned = cleaned.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, '');

  // 2. Strip legacy in-content TOC
  cleaned = stripInContentToc(cleaned);

  // 3. Strip HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // 4. Strip <script>, <style>, and <iframe> elements
  cleaned = cleaned.replace(/<(script|style|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // 5. Replace massive base64 image data URIs
  cleaned = cleaned.replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g, '[embedded image]');

  // 6. Condense excessive blank lines (3+ to 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  cleaned = cleaned.trim();

  // 7. Maximum length safety cutoff (~35k chars / ~8.5k tokens)
  const MAX_DOC_CHARS = 35000;
  if (cleaned.length > MAX_DOC_CHARS) {
    const cut = cleaned.lastIndexOf('\n\n', MAX_DOC_CHARS);
    const splitIndex = cut > MAX_DOC_CHARS * 0.7 ? cut : MAX_DOC_CHARS;
    cleaned = `${cleaned.slice(0, splitIndex).trim()}\n\n[Documentation content truncated for length...]`;
  }

  return cleaned;
};

/**
 * Checks if a prompt string has already been wrapped with doc context.
 */
export const isDocInjectedPrompt = (prompt?: string | null): boolean => {
  if (!prompt || typeof prompt !== 'string') return false;
  return (
    prompt.includes(DOC_PROMPT_DELIMITER_START) ||
    DOC_PROMPT_PREFIX_REGEX.test(prompt)
  );
};

/**
 * Extracts the user's actual question from a doc-injected prompt,
 * so the UI header and rerun forms stay completely clean.
 */
export const extractCleanDisplayPrompt = (prompt?: string | null): string => {
  if (!prompt || typeof prompt !== 'string') return '';
  const trimmed = prompt.trim();
  if (!isDocInjectedPrompt(trimmed)) return trimmed;

  // 1. If delimited by --- END DOCUMENTATION ---
  if (trimmed.includes(DOC_PROMPT_DELIMITER_END)) {
    const parts = trimmed.split(DOC_PROMPT_DELIMITER_END);
    const after = parts[parts.length - 1]?.trim() || '';
    const cleaned = after.replace(/^(?:User\s+Question:\s*|Question:\s*)/i, '').trim();
    if (cleaned) return cleaned;
  }

  // 2. Fallback: split by double newline and check the last section
  if (DOC_PROMPT_PREFIX_REGEX.test(trimmed)) {
    const paragraphs = trimmed.split(/\n\s*\n/).filter(Boolean);
    if (paragraphs.length > 1) {
      const last = paragraphs[paragraphs.length - 1].trim();
      const cleaned = last.replace(/^(?:User\s+Question:\s*|Question:\s*)/i, '').trim();
      if (cleaned) return cleaned;
    }
  }

  return trimmed;
};

/**
 * Pre-injects current document markdown into the prompt payload sent to the agent.
 */
export const composeDocPromptInput = (
  userQuestion: string,
  pathname?: string,
  fallbackTitle?: string,
  overrideDocInfo?: ActiveDocInfo | null,
): string => {
  const trimmedQuestion = (userQuestion || '').trim();
  if (!trimmedQuestion) return '';

  // Avoid double-wrapping
  if (isDocInjectedPrompt(trimmedQuestion)) {
    return trimmedQuestion;
  }

  const activeDoc = overrideDocInfo ?? getActiveDocPromptContext();
  const title = (
    activeDoc?.title ||
    fallbackTitle ||
    getGlobalScope()?.__shuffleActiveEntityTitle ||
    'Documentation'
  ).trim();

  const rawMarkdown = activeDoc?.content || '';
  const sanitizedMarkdown = sanitizeDocMarkdown(rawMarkdown);

  if (sanitizedMarkdown) {
    return `Answer the users question about ${title} based on the following content:
${DOC_PROMPT_DELIMITER_START}
${sanitizedMarkdown}
${DOC_PROMPT_DELIMITER_END}

User Question:
${trimmedQuestion}`;
  }

  // Fallback when markdown is empty or still loading
  return `Answer the users question about ${title}:

${trimmedQuestion}`;
};
