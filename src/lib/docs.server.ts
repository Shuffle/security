/**
 * Server-side documentation fetching for SSR.
 *
 * Fetches the docs list and the raw markdown for a single doc from the
 * Shuffle Core API so route loaders can render the full page — including
 * YouTube / Loom embeds — into the SSR HTML. Client-side fetching in
 * MarkdownRenderer remains the fallback for self-hosted/static builds.
 */

export interface ServerDocMeta {
  name?: string;
  contributors?: { name?: string; url?: string; image?: string }[];
  read_time?: number;
  edited?: string;
  link?: string;
}

export interface ServerDocContent {
  markdown: string;
  meta: ServerDocMeta | null;
}

interface DocsListEntry {
  name?: string;
}

// Same rule as src/components/docs/remoteDocs.ts — GitHub raw 404 bodies are
// passed through as markdown by the API and must be treated as missing docs.
const isMissingDocBody = (markdown: string): boolean => {
  const trimmed = markdown.trim();
  if (trimmed.length > 200) return false;
  return /^(404\s*:?\s*not\s*found|not\s*found|400\s*:\s*.*|no\s*such\s*file.*)$/i.test(trimmed);
};

const docSlug = (name: string): string => name.replace(/_+/g, '-').toLowerCase();

const getBaseUrl = (): string =>
  (process.env['VITE_SHUFFLE_API_URL'] || 'https://shuffler.io').replace(/\/+$/, '');

const fetchJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  return res.json().catch(() => null);
};

/**
 * Resolve a URL slug to markdown + metadata. Returns null when the doc does
 * not exist or the API is unreachable (callers then fall back to client fetch).
 */
export const fetchDocContentServer = async (slug: string): Promise<ServerDocContent | null> => {
  const base = getBaseUrl();

  const listData = (await fetchJson(`${base}/api/v1/docs`)) as
    | { success?: boolean; list?: DocsListEntry[] }
    | null;
  const list = Array.isArray(listData?.list)
    ? listData!.list.filter((d): d is { name: string } => typeof d?.name === 'string')
    : [];

  const exact = list.find((d) => docSlug(d.name) === slug.toLowerCase())?.name ?? null;
  const candidates = Array.from(
    new Set([exact, slug, slug.replace(/-/g, '_')].filter(Boolean) as string[]),
  );

  for (const name of candidates) {
    const data = (await fetchJson(`${base}/api/v1/docs/${encodeURIComponent(name)}`)) as
      | { success?: boolean; reason?: string; meta?: ServerDocMeta }
      | null;
    if (data?.success && typeof data.reason === 'string' && data.reason.trim().length > 0) {
      if (isMissingDocBody(data.reason)) continue;
      return { markdown: data.reason, meta: data.meta ?? null };
    }
  }

  return null;
};
