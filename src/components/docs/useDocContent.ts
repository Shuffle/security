import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { algoliasearch } from 'algoliasearch';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { resolveDocName, fetchDocsList, docSlug } from '@/components/docs/remoteDocs';
import { extractHeadings, stripInContentToc, extractDocTitleAndBody, type TocHeading } from './tocUtils';

export interface Contributor {
  name?: string;
  url?: string;
  image?: string;
}

export interface RemoteDocMeta {
  name?: string;
  contributors?: Contributor[];
  read_time?: number;
  edited?: string;
  link?: string;
}

export interface DocSuggestion {
  path: string;
  label: string;
  snippet?: string;
}

interface DocsHit {
  title?: string;
  filename?: string;
  data?: string;
  urlpath?: string;
}

const docsSearchClient = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');

const isMissingDocBody = (markdown: string) => {
  const trimmed = markdown.trim();
  if (trimmed.length > 200) return false;
  return /^(404\s*:?\s*not\s*found|not\s*found|400\s*:\s*.*|no\s*such\s*file.*)$/i.test(trimmed);
};

const docsQuery = (folder?: string, resetCache = false) => {
  const params = new URLSearchParams();
  if (folder) params.set('folder', folder);
  if (resetCache) params.set('resetCache', 'true');
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const fetchRemoteDoc = async (
  slug: string,
  resetCache = false,
  folder?: string,
): Promise<{ markdown: string; meta: RemoteDocMeta | null } | null> => {
  const exact = await resolveDocName(slug, resetCache, folder);
  const candidates = Array.from(
    new Set([exact, slug, slug.replace(/-/g, '_')].filter(Boolean) as string[]),
  );
  for (const name of candidates) {
    try {
      const res = await fetch(
        getApiUrl(`/api/v1/docs/${encodeURIComponent(name)}${docsQuery(folder, resetCache)}`),
        {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.success && typeof data.reason === 'string' && data.reason.trim().length > 0) {
        if (isMissingDocBody(data.reason)) continue;
        return { markdown: data.reason, meta: (data.meta as RemoteDocMeta) ?? null };
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
};

export interface UseDocContentOptions {
  slug: string;
  folder?: string;
  basePath?: string;
  initialContent?: string | null;
  initialMeta?: RemoteDocMeta | null;
}

export interface UseDocContentResult {
  title: string | null;
  content: string;
  meta: RemoteDocMeta | null;
  headings: TocHeading[];
  loading: boolean;
  resetting: boolean;
  error: string | null;
  suggestions: DocSuggestion[];
  suggestLoading: boolean;
  handleResetCache: () => Promise<void>;
  reload: () => Promise<void>;
}

export const useDocContent = ({
  slug,
  folder,
  basePath = '/docs',
  initialContent = null,
  initialMeta = null,
}: UseDocContentOptions): UseDocContentResult => {
  // Clean and extract title from initial SSR markdown if provided
  const initialProcessed = useMemo(() => {
    if (!initialContent) return { title: null, content: '' };
    const stripped = stripInContentToc(initialContent);
    return extractDocTitleAndBody(stripped);
  }, [initialContent]);

  const [title, setTitle] = useState<string | null>(initialProcessed.title);
  const [content, setContent] = useState<string>(initialProcessed.content);
  const [meta, setMeta] = useState<RemoteDocMeta | null>(initialMeta);
  const [loading, setLoading] = useState(!initialContent);
  const ssrSlugRef = useRef<string | null>(initialContent ? slug : null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<DocSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Synchronously compute headings from content
  const headings = useMemo(() => {
    return extractHeadings(content);
  }, [content]);

  const loadContent = useCallback(
    async (resetCache = false) => {
      ssrSlugRef.current = null;
      setLoading(true);
      setError(null);
      setMeta(null);

      let target = slug;
      const list = await fetchDocsList(resetCache, folder);
      if (!list.some((d) => docSlug(d.name) === slug.toLowerCase())) {
        const preferred =
          list.find((d) => docSlug(d.name) === 'index') ??
          list.find((d) => docSlug(d.name) === 'getting-started') ??
          list[0];
        if (slug === 'index' && preferred) target = docSlug(preferred.name);
      }

      const remote = await fetchRemoteDoc(target, resetCache, folder);
      if (remote) {
        const stripped = stripInContentToc(remote.markdown);
        const { title: extractedTitle, content: bodyContent } = extractDocTitleAndBody(stripped);
        setTitle(extractedTitle);
        setContent(bodyContent);
        setMeta(remote.meta);
      } else {
        setTitle(null);
        setError(`Documentation not found: ${slug}`);
      }
      setLoading(false);
    },
    [slug, folder],
  );

  useEffect(() => {
    if (ssrSlugRef.current === slug) return;
    loadContent();
  }, [loadContent, slug]);

  // Algolia fallback suggestions when doc 404s
  useEffect(() => {
    if (!error) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    (async () => {
      try {
        const res = await docsSearchClient.searchSingleIndex({
          indexName: 'documentation',
          searchParams: {
            query: slug.replace(/[-_]+/g, ' '),
            hitsPerPage: 8,
            attributesToRetrieve: ['title', 'filename', 'data', 'urlpath'],
          },
        });
        const seen = new Set<string>();
        const items: DocSuggestion[] = [];
        for (const raw of res.hits as unknown as DocsHit[]) {
          const rawPath = typeof raw.urlpath === 'string' ? raw.urlpath.trim() : '';
          const filename = (raw.filename || '').replace(/\.md$/i, '');
          const pathWithoutHash = rawPath.split('#')[0];
          const docSlugValue = pathWithoutHash.startsWith('/docs/')
            ? pathWithoutHash.slice('/docs/'.length).replace(/^\/+|\/+$/g, '')
            : filename.replace(/[_\s]+/g, '-').toLowerCase();
          if (!docSlugValue || seen.has(docSlugValue)) continue;
          seen.add(docSlugValue);
          items.push({
            path: rawPath.startsWith('/docs/') ? rawPath : `/docs/${docSlugValue}`,
            label:
              raw.title?.trim() ||
              (filename || docSlugValue).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            snippet: (raw.data || '').replace(/\s+/g, ' ').trim().slice(0, 160),
          });
          if (items.length >= 3) break;
        }
        let final = items;
        if (final.length === 0) {
          const list = await fetchDocsList(false, folder);
          const query = slug.replace(/[-_]+/g, ' ').toLowerCase();
          const scored = list
            .map((d) => {
              const label = d.name.replace(/[_-]+/g, ' ');
              const lower = label.toLowerCase();
              const score = lower.includes(query) || query.includes(lower) ? 2 : 0;
              return { d, label, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
          final = scored.map(({ d, label }) => ({ path: `${basePath}/${docSlug(d.name)}`, label }));
        }
        if (!cancelled) setSuggestions(final);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [error, slug, folder, basePath]);

  const handleResetCache = useCallback(async () => {
    setResetting(true);
    try {
      await loadContent(true);
    } finally {
      setResetting(false);
    }
  }, [loadContent]);

  return {
    title,
    content,
    meta,
    headings,
    loading,
    resetting,
    error,
    suggestions,
    suggestLoading,
    handleResetCache,
    reload: loadContent,
  };
};
