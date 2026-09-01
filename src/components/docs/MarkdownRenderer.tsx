import { useCallback, useEffect, useRef, useState } from 'react';
import ShuffleMarkdown from '@/Shuffle-MCPs/components/Markdown';
import { Link, useLocation, useNavigate } from '@/lib/router-compat';
import { algoliasearch } from 'algoliasearch';


import { Box, CircularProgress, Avatar, AvatarGroup, Tooltip, Stack, Typography, Link as MuiLink, Button } from '@mui/material';
import { Clock as ClockIcon, Github as GithubIcon, RefreshCw as RefreshCwIcon } from 'lucide-react';
import { getApiUrl } from '@/Shuffle-MCPs/api';
import { resolveDocName, fetchDocsList, docSlug } from '@/components/docs/remoteDocs';
import { useIsSupport } from '@/hooks/useIsSupport';
import PrintDocsDialog from '@/components/docs/PrintDocsDialog';



interface Contributor {
  name?: string;
  url?: string;
  image?: string;
}

interface RemoteDocMeta {
  name?: string;
  contributors?: Contributor[];
  read_time?: number;
  edited?: string;
  link?: string;
}

interface MarkdownRendererProps {
  slug?: string;
  /** API folder to load from (e.g. "legal"); defaults to the main docs folder. */
  folder?: string;
  /** URL prefix for internal links (defaults to /docs). */
  basePath?: string;
  /** SSR-provided markdown/metadata; when present the initial client fetch is skipped. */
  initialContent?: string | null;
  initialMeta?: RemoteDocMeta | null;
  /** Hide read time, contributors and "Edit on GitHub" metadata. Print stays. */
  hideMeta?: boolean;
}

interface DocSuggestion {
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

// Public Algolia search credentials (same index used by the global search popup).
const docsSearchClient = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');


// Fetch a doc from the Shuffle Core /api/v1/docs/{name} endpoint.
// The API returns { success, reason: <markdown>, meta: {...} }.
// GitHub raw returns a plain "404: Not Found" body for missing files, which the
// API happily passes through as markdown. Treat those bodies as a missing doc.
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

const fetchRemoteDoc = async (
  slug: string,
  resetCache = false,
  folder?: string,
): Promise<{ markdown: string; meta: RemoteDocMeta | null } | null> => {
  // Names are case sensitive ("AI", "API") — resolve the exact name from /api/v1/docs.
  const exact = await resolveDocName(slug, resetCache, folder);
  const candidates = Array.from(
    new Set([exact, slug, slug.replace(/-/g, '_')].filter(Boolean) as string[]),
  );
  for (const name of candidates) {
    try {
      const res = await fetch(
        getApiUrl(`/api/v1/docs/${encodeURIComponent(name)}${docsQuery(folder, resetCache)}`),
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


// Anchor ids in the Shuffle docs use underscores ("#cloud_specific_example").
// Normalize heading text and hashes to the same shape so both underscore and
// dash variants resolve to the same heading.
const anchorKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeDocPath = (pathname: string, basePath = '/docs') => {
  const match = pathname.match(/(?:^|\/)docs\/([^/]+)$/i);
  if (!match) return pathname;
  const name = match[1].replace(/\.md$/i, '');
  return `${basePath}/${docSlug(name)}`;
};

export const MarkdownRenderer = ({ slug = 'index', folder, basePath = '/docs', initialContent = null, initialMeta = null }: MarkdownRendererProps) => {
  const [content, setContent] = useState<string>(initialContent ?? '');
  const [meta, setMeta] = useState<RemoteDocMeta | null>(initialMeta);
  const [loading, setLoading] = useState(!initialContent);
  // Slug the SSR content was rendered for — skip the client refetch until the
  // user navigates to a different doc.
  const ssrSlugRef = useRef<string | null>(initialContent ? slug : null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<DocSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const isSupport = useIsSupport();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { hash } = location;

  const scrollToDocAnchor = useCallback((rawHash: string) => {
    const root = containerRef.current;
    if (!root) return false;
    const target = anchorKey(decodeURIComponent(rawHash.replace(/^#/, '')));
    if (!target) return false;
    const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
    const match = headings.find((heading) =>
      anchorKey(heading.id || '') === target || anchorKey(heading.textContent || '') === target,
    );
    if (!match) return false;
    requestAnimationFrame(() => match.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return true;
  }, []);


  const loadContent = useCallback(async (resetCache = false) => {
    // Any client-side load invalidates the SSR handoff for this mount.
    ssrSlugRef.current = null;
    setLoading(true);
    setError(null);
    setMeta(null);

    // Resolve the doc to load. `/docs` (index) falls back to the first remote doc.
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
      setContent(remote.markdown);
      setMeta(remote.meta);
    } else {
      setError(`Documentation not found: ${slug}`);
    }
    setLoading(false);

  }, [slug, folder]);

  useEffect(() => {
    // SSR content already covers the first render of this slug.
    if (ssrSlugRef.current === slug) return;
    loadContent();
  }, [loadContent, slug]);

  // When a doc 404s, suggest the top matching documentation pages from Algolia.
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
          // Fall back to the local docs list when Algolia has no match.
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


  // Give every heading a stable id, then scroll to the hash target once the
  // markdown has rendered (docs links carry anchors like "#cloud_specific_example").
  useEffect(() => {
    if (loading || !content) return;
    const root = containerRef.current;
    if (!root) return;

    const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
    headings.forEach((heading) => {
      const key = anchorKey(heading.textContent || '');
      if (key) {
        heading.id = key;
        heading.style.scrollMarginTop = '80px';
      }
    });

    scrollToDocAnchor(hash);
  }, [content, loading, hash, scrollToDocAnchor]);


  const handleResetCache = async () => {
    setResetting(true);
    try {
      await loadContent(true);
    } finally {
      setResetting(false);
    }
  };

  const actionButtons = (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
      {isSupport && (
        <Button
          variant="outlined"
          size="small"
          onClick={handleResetCache}
          disabled={resetting || loading}
          startIcon={<RefreshCwIcon size={14} />}
          sx={{
            textTransform: 'none',
            height: 36,
            borderColor: 'hsl(var(--border))',
            color: 'text.primary',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
          }}
        >
          {resetting ? 'Resetting…' : 'Reset Cache'}
        </Button>
      )}
      <PrintDocsDialog slug={slug} currentMarkdown={content} disabled={loading || resetting} />
    </Stack>
  );

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Box sx={{ py: 6, maxWidth: 640, mx: 'auto' }}>
          <Typography sx={{ color: 'text.primary', fontSize: '1.25rem', fontWeight: 600, mb: 1 }}>
            This documentation page does not exist
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            We could not find a document for "{slug}". It may have been renamed or moved.
          </Typography>

          {(suggestLoading || suggestions.length > 0) && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                {suggestLoading ? 'Looking for related documentation…' : 'Related documentation'}
              </Typography>

              {suggestLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={18} />
                </Box>
              ) : (
                <Stack spacing={1}>
                  {suggestions.map((s) => (
                    <Box
                      key={s.path}
                      component={Link}
                      to={s.path}
                      sx={{
                        display: 'block',
                        p: 1.5,
                        borderRadius: 1,
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        textDecoration: 'none',
                        '&:hover': { borderColor: 'primary.main' },
                      }}
                    >
                      <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.9rem' }}>
                        {s.label}
                      </Typography>
                      {s.snippet && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {s.snippet}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Box>
      </Box>
    );
  }



  return (
    <Box
      ref={containerRef}
      className="prose prose-invert max-w-none"

      sx={{
        '& h1': {
          color: 'text.primary',
          fontSize: '2.25rem',
          fontWeight: 700,
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
          mb: 4,
        },
        '& h2': {
          color: 'text.primary',
          fontSize: '1.5rem',
          fontWeight: 600,
          mt: 6,
          mb: 3,
        },
        '& h3': {
          color: 'text.primary',
          fontSize: '1.25rem',
          fontWeight: 600,
          mt: 4,
          mb: 2,
        },
        '& p': {
          color: 'text.secondary',
          lineHeight: 1.8,
          mb: 2,
        },
        '& a': {
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
        '& code': {
          backgroundColor: 'rgba(255, 102, 0, 0.1)',
          color: 'primary.main',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          fontSize: '0.875rem',
          fontFamily: 'JetBrains Mono, monospace',
        },
        '& pre': {
          backgroundColor: (t) => t.palette.mode === 'dark' ? '#0D0D0D' : '#f5f5f5',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 3,
          overflow: 'auto',
          '& code': {
            backgroundColor: 'transparent',
            p: 0,
            color: 'text.primary',
          },
        },
        '& ul, & ol': {
          color: 'text.secondary',
          pl: 3,
          mb: 3,
        },
        '& li': {
          mb: 1,
        },
        '& table': {
          width: '100%',
          borderCollapse: 'collapse',
          mb: 4,
        },
        '& th': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderBottom: '2px solid',
          borderColor: 'divider',
          p: 2,
          textAlign: 'left',
          fontWeight: 600,
          color: 'text.primary',
        },
        '& td': {
          borderBottom: '1px solid',
          borderColor: 'divider',
          p: 2,
          color: 'text.secondary',
        },
        '& blockquote': {
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          pl: 3,
          ml: 0,
          fontStyle: 'italic',
          color: 'text.secondary',
        },
        '& hr': {
          border: 'none',
          borderTop: '1px solid',
          borderColor: 'divider',
          my: 6,
        },
      }}
    >
      {(
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          flexWrap="wrap"
          sx={{
            mb: 4,
            pb: 3,
            borderBottom: '1px solid',
            borderColor: 'divider',
            rowGap: 1,
          }}
        >
          {meta?.read_time ? (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
              <ClockIcon size={14} />
              <Typography variant="caption">{meta.read_time} min read</Typography>
            </Stack>
          ) : null}

          {meta?.contributors && meta.contributors.length > 0 && (
            <AvatarGroup max={6} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.7rem', border: '1px solid', borderColor: 'divider' } }}>
              {meta.contributors.map((c, i) => {
                const handle = c.url?.split('/').filter(Boolean).pop() || c.name || 'contributor';
                const avatar = (
                  <Avatar key={c.url || i} src={c.image} alt={handle}>
                    {handle.charAt(0).toUpperCase()}
                  </Avatar>
                );
                return (
                  <Tooltip key={c.url || i} title={handle} arrow>
                    {c.url ? (
                      <MuiLink href={c.url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex' }}>
                        {avatar}
                      </MuiLink>
                    ) : avatar}
                  </Tooltip>
                );
              })}
            </AvatarGroup>
          )}

          {meta?.link && (
            <MuiLink
              href={meta.link}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main' },
              }}
            >
              <GithubIcon size={14} />
              Edit on GitHub
            </MuiLink>
          )}

          {actionButtons}
        </Stack>
      )}

      <ShuffleMarkdown
        disableBreaks
        sx={{ '& p': { mb: 2 } }}
        components={{
          a: ({ href, children }) => {
            // In-page anchors update the URL as well as scrolling. Explicitly
            // scroll too, because selecting the same hash twice does not cause
            // React Router's location state to change.
            if (href?.startsWith('#')) {
              return (
                <a
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`${location.pathname}${location.search}${href}`);
                    scrollToDocAnchor(href);
                  }}
                >
                  {children}
                </a>
              );
            }

            // Reference docs contain a mix of `/docs/name`, `name.md`, and
            // relative `./name.md` links. Route all of those through the SPA
            // and preserve their heading hash.
            if (href) {
              // window.location is unavailable during SSR — use the canonical
              // origin so same-origin/doc links still resolve server-side.
              const baseUrl =
                typeof window !== 'undefined' && window.location?.origin
                  ? window.location.href
                  : 'https://shuffle.security/docs';
              const parsed = new URL(href, baseUrl);
              const isSameOrigin =
                parsed.origin === new URL(baseUrl).origin;
              const isRelativeDoc = !/^[a-z][a-z\d+.-]*:/i.test(href) && /(?:^|\/)\.?\.?\/?[^/#?]+\.md(?:$|[?#])/i.test(href);
              const isDocsPath = /^\/docs(?:\/|$)/i.test(parsed.pathname);
              if ((isSameOrigin && isDocsPath) || isRelativeDoc) {
                const relativeName = parsed.pathname.split('/').filter(Boolean).pop()?.replace(/\.md$/i, '');
                const path = isRelativeDoc && !isDocsPath && relativeName
                  ? `${basePath}/${docSlug(relativeName)}`
                  : normalizeDocPath(parsed.pathname, basePath);
                return <Link to={`${path}${parsed.search}${parsed.hash}`}>{children}</Link>;
              }
              if (href.startsWith('/') && isSameOrigin) {
                return <Link to={`${parsed.pathname}${parsed.search}${parsed.hash}`}>{children}</Link>;
              }
            }

            // External links
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ShuffleMarkdown>
    </Box>
  );
};
