/**
 * ShuffleMarkdown — the ONE markdown renderer for the platform.
 *
 * Every place that renders user/AI/remote markdown should use this component
 * (or `InlineMarkdown` for single-line strings) instead of importing
 * `react-markdown` directly, so plugins, link safety and typography stay
 * identical everywhere.
 *
 * Defaults:
 *  - remark-gfm (tables, strikethrough, task lists, autolinks)
 *  - remark-breaks (single newline = <br>, matches how LLM/agent output reads)
 *  - rehype-sanitize (defense in depth; raw HTML is never enabled)
 *  - external links open in a new tab with noopener/noreferrer
 *  - shared code / table / blockquote styling based on HSL design tokens
 */
import React, { useMemo } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize from 'rehype-sanitize';
import { VideoEmbed, resolveVideoUrl } from './VideoEmbed';

export interface ShuffleMarkdownProps {
  /** The markdown source. */
  children?: string | null;
  /** Component overrides merged on top of the shared defaults. */
  components?: Components;
  /** Extra remark plugins appended to the defaults. */
  remarkPlugins?: any[];
  /** Disable remark-breaks (for prose docs where blank lines separate paragraphs). */
  disableBreaks?: boolean;
  /** Styling applied to the wrapping Box. */
  sx?: SxProps<Theme>;
  className?: string;
}

const baseSx: SxProps<Theme> = {
  color: 'inherit',
  fontSize: 'inherit',
  lineHeight: 1.6,
  wordBreak: 'break-word',
  '& > *:first-of-type': { mt: 0 },
  '& > *:last-child': { mb: 0 },
  '& p': { m: 0, mb: 1 },
  '& ul, & ol': { m: 0, mb: 1, pl: 2.5 },
  '& li': { mb: 0.25 },
  '& a': { color: 'hsl(var(--primary))', textDecoration: 'underline' },
  '& code': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.92em',
    padding: '0 4px',
    borderRadius: '3px',
    backgroundColor: 'hsl(var(--muted))',
  },
  '& pre': {
    m: 0,
    mb: 1,
    p: 1.5,
    borderRadius: 1,
    overflow: 'auto',
    backgroundColor: 'hsl(var(--muted))',
    border: '1px solid hsl(var(--border))',
    '& code': { p: 0, backgroundColor: 'transparent' },
  },
  '& blockquote': {
    m: 0,
    mb: 1,
    pl: 1.5,
    borderLeft: '3px solid hsl(var(--border))',
    color: 'hsl(var(--muted-foreground))',
  },
  '& table': { width: '100%', borderCollapse: 'collapse', mb: 1 },
  '& th, & td': {
    border: '1px solid hsl(var(--border))',
    p: 0.75,
    textAlign: 'left',
  },
  '& th': { backgroundColor: 'hsl(var(--muted))', fontWeight: 600 },
  '& hr': { border: 0, borderTop: '1px solid hsl(var(--border))', my: 1.5 },
  '& img': { maxWidth: '100%', borderRadius: 4 },
};

const defaultComponents: Components = {
  a: ({ href, children, ...props }: any) => {
    const isInternal = typeof href === 'string' && href.startsWith('/');
    const video = isInternal ? null : resolveVideoUrl(href);
    if (video) {
      const label = typeof children === 'string' ? children : undefined;
      return <VideoEmbed video={video} title={label} />;
    }
    return (
      <a
        href={href}
        {...(isInternal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt, ...props }: any) => {
    const video = resolveVideoUrl(src);
    if (video) return <VideoEmbed video={video} title={alt} />;
    return <img src={src} alt={alt ?? ''} loading="lazy" {...props} />;
  },
};

export const ShuffleMarkdown: React.FC<ShuffleMarkdownProps> = ({
  children,
  components,
  remarkPlugins,
  disableBreaks = false,
  sx,
  className,
}) => {
  const plugins = useMemo(
    () => [remarkGfm, ...(disableBreaks ? [] : [remarkBreaks]), ...(remarkPlugins ?? [])],
    [disableBreaks, remarkPlugins],
  );
  const merged = useMemo(
    () => ({ ...defaultComponents, ...(components ?? {}) }) as Components,
    [components],
  );

  return (
    <Box className={className} sx={{ ...(baseSx as object), ...(sx as object) }}>
      <ReactMarkdown remarkPlugins={plugins} rehypePlugins={[rehypeSanitize]} components={merged}>
        {children ?? ''}
      </ReactMarkdown>
    </Box>
  );
};

export default ShuffleMarkdown;
