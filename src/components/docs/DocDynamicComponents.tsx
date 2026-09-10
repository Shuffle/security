import React, { useEffect, useState } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import AgentUI from '@/Shuffle-MCPs/components/AgentUI';
import TryMcpSection from '@/Shuffle-MCPs/views/TryMcpSection';
import { useAppLookup } from '@/Shuffle-MCPs/useAppLookup';
import AgentIcon from '@/Shuffle-MCPs/components/AgentIcon';
import { ArrowRight as ArrowRightIcon } from 'lucide-react';

export interface ContentSegment {
  type: 'markdown' | 'component';
  content?: string;
  componentName?: string;
  props?: Record<string, string>;
}

const COMPONENT_DIRECTIVE_REGEX = /<!--\s*component:([a-zA-Z0-9_-]+)(?:\s+([^>]*?))?\s*-->/g;

/**
 * Parse key="value" or key='value' or key=value attributes from an HTML comment.
 */
export const parseAttributes = (raw?: string): Record<string, string> => {
  if (!raw) return {};
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(raw)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? 'true';
    attrs[key] = val;
  }
  return attrs;
};

/**
 * Split raw markdown into sequential markdown chunks and component directives.
 */
export const parseMarkdownSegments = (rawMarkdown: string): ContentSegment[] => {
  if (!rawMarkdown) return [];

  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  COMPONENT_DIRECTIVE_REGEX.lastIndex = 0;

  while ((match = COMPONENT_DIRECTIVE_REGEX.exec(rawMarkdown)) !== null) {
    const textBefore = rawMarkdown.slice(lastIndex, match.index);
    if (textBefore) {
      segments.push({ type: 'markdown', content: textBefore });
    }

    const componentName = match[1].toLowerCase();
    const rawAttrs = match[2] || '';
    const props = parseAttributes(rawAttrs);

    segments.push({
      type: 'component',
      componentName,
      props,
    });

    lastIndex = match.index + match[0].length;
  }

  const remainingText = rawMarkdown.slice(lastIndex);
  if (remainingText) {
    segments.push({ type: 'markdown', content: remainingText });
  }

  return segments;
};

interface DocAgentUIProps {
  title?: string;
  subtitle?: string;
  placeholder?: string;
  compact?: string | boolean;
  apps?: string;
}

export const DocAgentUI: React.FC<DocAgentUIProps> = ({
  title,
  subtitle,
  placeholder,
  compact = true,
  apps,
}) => {
  const isCompact = compact === true || compact === 'true';

  const defaultApps = React.useMemo(() => {
    if (apps) {
      return apps.split(',').map((name) => ({ name: name.trim() }));
    }
    return [
      { name: 'Shuffle_tools', id: '3e2bdf9d5069fe3f4746c29d68785a6a' },
    ];
  }, [apps]);

  return (
    <Box
      sx={{
        my: 3.5,
        p: { xs: 2, sm: 3 },
        borderRadius: 2.5,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--card))',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      <AgentUI
        compact={isCompact}
        hideHeroIcon={isCompact}
        title={title || 'Shuffle AI Agent'}
        subtitle={
          subtitle ||
          'Run an agent task using Shuffle Tools directly from this documentation page.'
        }
        placeholder={
          placeholder ||
          'What do you want the agent to do? e.g. "Check if 1.1.1.1 is malicious"'
        }
        defaultApps={defaultApps}
        disableAppsPersistence
      />
    </Box>
  );
};

interface DocTryMcpProps {
  app?: string;
  appname?: string;
  appid?: string;
}

export const DocTryMcp: React.FC<DocTryMcpProps> = ({ app, appname, appid }) => {
  const resolvedAppName = app || appname || 'Shuffle Tools';
  const lookup = useAppLookup(resolvedAppName);

  const finalAppId =
    appid ||
    lookup.algoliaId ||
    (resolvedAppName.toLowerCase().includes('shuffle')
      ? '3e2bdf9d5069fe3f4746c29d68785a6a'
      : resolvedAppName);

  const finalAppIcon =
    lookup.image ||
    (resolvedAppName.toLowerCase().includes('shuffle')
      ? '/images/logos/orange_logo.png'
      : undefined);

  if (lookup.loading) {
    return (
      <Box
        sx={{
          my: 3.5,
          p: { xs: 2, sm: 3 },
          borderRadius: 2.5,
          border: '1px solid hsl(var(--border))',
          backgroundColor: 'hsl(var(--card))',
        }}
      >
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        my: 3.5,
        p: { xs: 2, sm: 3 },
        borderRadius: 2.5,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--card))',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      <TryMcpSection
        appName={resolvedAppName}
        appIcon={finalAppIcon}
        appId={finalAppId}
        categories={lookup.categories}
      />
    </Box>
  );
};

interface DocAgentSidebarButtonProps {
  label?: string;
  input?: string;
}

export const DocAgentSidebarButton: React.FC<DocAgentSidebarButtonProps> = ({
  label = 'Open AI Agent Sidebar',
  input,
}) => {
  const handleOpen = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('agent-drawer-open', {
        detail: {
          tab: 'run',
          source: 'docs',
          defaultInput: input,
        },
      })
    );
  };

  return (
    <Box
      sx={{
        my: 2.5,
        p: 2,
        borderRadius: 2,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--card))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'hsl(var(--primary) / 0.1)',
            color: 'hsl(var(--primary))',
          }}
        >
          <AgentIcon size={20} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'hsl(var(--foreground))' }}>
            Interactive AI Agent
          </Typography>
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Open the live AI side-panel to run tasks alongside the documentation.
          </Typography>
        </Box>
      </Stack>
      <Button
        variant="contained"
        size="small"
        onClick={handleOpen}
        endIcon={<ArrowRightIcon size={14} />}
        sx={{
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 1.5,
        }}
      >
        {label}
      </Button>
    </Box>
  );
};

interface DocDynamicComponentProps {
  name: string;
  props: Record<string, string>;
}

export const DocDynamicComponent: React.FC<DocDynamicComponentProps> = ({ name, props }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Box
        sx={{
          my: 3.5,
          p: 3,
          borderRadius: 2.5,
          border: '1px solid hsl(var(--border))',
          backgroundColor: 'hsl(var(--card))',
        }}
      >
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  switch (name.toLowerCase()) {
    case 'agent-ui':
    case 'agent':
    case 'ai-agent':
      return <DocAgentUI {...props} />;

    case 'try-mcp':
    case 'mcp':
    case 'app-mcp':
      return <DocTryMcp {...props} />;

    case 'agent-sidebar':
    case 'agent-drawer':
    case 'ask-ai':
      return <DocAgentSidebarButton {...props} />;

    default:
      return null;
  }
};
