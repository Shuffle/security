import { useCallback, useEffect, useRef } from 'react';
import ShuffleMarkdown from '@/Shuffle-MCPs/components/Markdown';
import { Link, useLocation, useNavigate } from '@/lib/router-compat';
import {
  Box,
  CircularProgress,
  Avatar,
  AvatarGroup,
  Tooltip,
  Stack,
  Typography,
  Link as MuiLink,
  Button,
  Divider,
} from '@mui/material';
import {
  Clock as ClockIcon,
  Github as GithubIcon,
  Pencil,
  RefreshCw as RefreshCwIcon,
} from 'lucide-react';
import { docSlug } from '@/components/docs/remoteDocs';
import { useIsSupport } from '@/hooks/useIsSupport';
import PrintDocsDialog from '@/components/docs/PrintDocsDialog';
import { anchorKey, isTocHeading, stripMarkdownInline } from './tocUtils';
import {
  useDocContent,
  type RemoteDocMeta,
  type Contributor,
  type DocSuggestion,
} from './useDocContent';

export type { RemoteDocMeta, Contributor, DocSuggestion };

export interface MarkdownRendererProps {
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
  /** Controlled doc content (from useDocContent) */
  content?: string;
  meta?: RemoteDocMeta | null;
  loading?: boolean;
  resetting?: boolean;
  error?: string | null;
  suggestions?: DocSuggestion[];
  suggestLoading?: boolean;
  onResetCache?: () => Promise<void>;
  hideDesktopActionButtons?: boolean;
}

const normalizeDocPath = (pathname: string, basePath = '/docs') => {
  const match = pathname.match(/(?:^|\/)docs\/([^/]+)$/i);
  if (!match) return pathname;
  const name = match[1].replace(/\.md$/i, '');
  return `${basePath}/${docSlug(name)}`;
};

export const MarkdownRenderer = ({
  slug = 'index',
  folder,
  basePath = '/docs',
  initialContent = null,
  initialMeta = null,
  hideMeta = false,
  content: propContent,
  meta: propMeta,
  loading: propLoading,
  resetting: propResetting,
  error: propError,
  suggestions: propSuggestions,
  suggestLoading: propSuggestLoading,
  onResetCache: propOnResetCache,
  hideDesktopActionButtons = false,
}: MarkdownRendererProps) => {
  const isControlled = propContent !== undefined;

  const hookDoc = useDocContent(
    isControlled
      ? { slug: '', initialContent: '' }
      : { slug, folder, basePath, initialContent, initialMeta },
  );

  const content = isControlled ? propContent : hookDoc.content;
  const meta = isControlled ? (propMeta ?? null) : hookDoc.meta;
  const loading = isControlled ? Boolean(propLoading) : hookDoc.loading;
  const resetting = isControlled ? Boolean(propResetting) : hookDoc.resetting;
  const error = isControlled ? (propError ?? null) : hookDoc.error;
  const suggestions = isControlled ? (propSuggestions ?? []) : hookDoc.suggestions;
  const suggestLoading = isControlled ? Boolean(propSuggestLoading) : hookDoc.suggestLoading;
  const handleResetCache = propOnResetCache || hookDoc.handleResetCache;

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
    const match = headings.find(
      (heading) =>
        anchorKey(heading.id || '') === target || anchorKey(heading.textContent || '') === target,
    );
    if (!match) return false;
    requestAnimationFrame(() => match.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return true;
  }, []);

  // Give every heading a stable id, then scroll to the hash target once the
  // markdown has rendered (docs links carry anchors like "#cloud_specific_example").
  useEffect(() => {
    if (loading || !content) return;
    const root = containerRef.current;
    if (!root) return;

    const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
    const seenKeys = new Map<string, number>();

    headings.forEach((heading) => {
      const clean = stripMarkdownInline(heading.textContent || '');
      // If this heading is a TOC heading ("Table of Contents"), hide it completely!
      if (isTocHeading(clean)) {
        heading.style.display = 'none';
        return;
      }
      const baseKey = anchorKey(clean);
      if (baseKey) {
        const count = seenKeys.get(baseKey) || 0;
        seenKeys.set(baseKey, count + 1);
        const key = count === 0 ? baseKey : `${baseKey}_${count}`;
        heading.id = key;
        heading.style.scrollMarginTop = '80px';
      }
    });

    scrollToDocAnchor(hash);
  }, [content, loading, hash, scrollToDocAnchor]);

  const actionButtons = (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        ml: 'auto',
        display: hideDesktopActionButtons ? { xs: 'flex', lg: 'none' } : 'flex',
      }}
    >
      {isSupport && (
        <Button
          variant="outlined"
          size="small"
          onClick={handleResetCache}
          disabled={resetting || loading}
          startIcon={<RefreshCwIcon size={14} className={resetting ? 'animate-spin' : ''} />}
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
            pb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            rowGap: 1.5,
          }}
        >
          {/* Metadata pill container matching screenshot */}
          {!hideMeta && (meta?.link || meta?.read_time || (meta?.contributors && meta.contributors.length > 0)) && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1.5,
                p: '6px 14px',
                borderRadius: 2,
                backgroundColor: (t) =>
                  t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {meta?.link && (
                <Button
                  component="a"
                  href={meta.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  size="small"
                  startIcon={<Pencil size={12} />}
                  sx={{
                    textTransform: 'none',
                    height: 28,
                    px: 1.25,
                    fontSize: '0.8125rem',
                    borderRadius: 1,
                    borderColor: 'hsl(var(--border))',
                    color: 'text.primary',
                    '&:hover': {
                      borderColor: 'primary.main',
                      color: 'primary.main',
                    },
                  }}
                >
                  Edit
                </Button>
              )}

              {meta?.link && meta?.read_time ? (
                <Divider orientation="vertical" flexItem sx={{ height: 16, my: 'auto' }} />
              ) : null}

              {meta?.read_time ? (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
                  <ClockIcon size={14} />
                  <Typography variant="caption" sx={{ fontSize: '0.8125rem' }}>
                    {meta.read_time} minutes to read
                  </Typography>
                </Stack>
              ) : null}

              {meta?.contributors && meta.contributors.length > 0 && (
                <AvatarGroup
                  max={6}
                  sx={{
                    '& .MuiAvatar-root': {
                      width: 24,
                      height: 24,
                      fontSize: '0.7rem',
                      border: '1px solid',
                      borderColor: 'divider',
                    },
                  }}
                >
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
                          <MuiLink
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: 'inline-flex' }}
                          >
                            {avatar}
                          </MuiLink>
                        ) : (
                          avatar
                        )}
                      </Tooltip>
                    );
                  })}
                </AvatarGroup>
              )}
            </Box>
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
