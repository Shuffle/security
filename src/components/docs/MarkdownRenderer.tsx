import { useCallback, useEffect, useRef, useState } from 'react';
import ShuffleMarkdown from '@/Shuffle-MCPs/components/Markdown';
import { Link, useLocation } from 'react-router-dom';

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
}

// Fetch a doc from the Shuffle Core /api/v1/docs/{name} endpoint.
// The API returns { success, reason: <markdown>, meta: {...} }.
const fetchRemoteDoc = async (
  slug: string,
  resetCache = false,
): Promise<{ markdown: string; meta: RemoteDocMeta | null } | null> => {
  // Names are case sensitive ("AI", "API") — resolve the exact name from /api/v1/docs.
  const exact = await resolveDocName(slug, resetCache);
  const candidates = Array.from(
    new Set([exact, slug, slug.replace(/-/g, '_')].filter(Boolean) as string[]),
  );
  for (const name of candidates) {
    try {
      const res = await fetch(
        getApiUrl(`/api/v1/docs/${encodeURIComponent(name)}${resetCache ? '?resetCache=true' : ''}`),
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.success && typeof data.reason === 'string' && data.reason.trim().length > 0) {
        return { markdown: data.reason, meta: (data.meta as RemoteDocMeta) ?? null };
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
};

export const MarkdownRenderer = ({ slug = 'index' }: MarkdownRendererProps) => {
  const [content, setContent] = useState<string>('');
  const [meta, setMeta] = useState<RemoteDocMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSupport = useIsSupport();

  const loadContent = useCallback(async (resetCache = false) => {
    setLoading(true);
    setError(null);
    setMeta(null);

    // Resolve the doc to load. `/docs` (index) falls back to the first remote doc.
    let target = slug;
    const list = await fetchDocsList(resetCache);
    if (!list.some((d) => docSlug(d.name) === slug.toLowerCase())) {
      const preferred =
        list.find((d) => docSlug(d.name) === 'index') ??
        list.find((d) => docSlug(d.name) === 'getting-started') ??
        list[0];
      if (slug === 'index' && preferred) target = docSlug(preferred.name);
    }

    const remote = await fetchRemoteDoc(target, resetCache);
    if (remote) {
      setContent(remote.markdown);
      setMeta(remote.meta);
    } else {
      setError(`Documentation not found: ${slug}`);
    }
    setLoading(false);

  }, [slug]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

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
        <Box sx={{ py: 4, textAlign: 'center', color: 'error.main' }}>
          {error}
        </Box>
      </Box>
    );
  }


  return (
    <Box
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
            // Handle internal links
            if (href?.startsWith('/')) {
              return <Link to={href}>{children}</Link>;
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
