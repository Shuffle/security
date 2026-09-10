import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AgentUI from "@/Shuffle-MCPs/components/AgentUI";
import AppMcpChat from "@/Shuffle-MCPs/views/AppMcpChat";
import { useAppLookup } from "@/Shuffle-MCPs/useAppLookup";
import AgentIcon from "@/Shuffle-MCPs/components/AgentIcon";
import {
  ArrowRight as ArrowRightIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import { openAgentDrawer } from "@/lib/agentDrawer";
import { fetchAuthenticatedApps } from "@/Shuffle-MCPs/authenticatedApps";
import { resolveActiveLLMProvider } from "@/Shuffle-MCPs/llmProviderDetect";

export interface ContentSegment {
  type: "markdown" | "component";
  content?: string;
  componentName?: string;
  props?: Record<string, string>;
}

const COMPONENT_DIRECTIVE_REGEX =
  /<!--\s*component:([a-zA-Z0-9_-]+)(?:\s+([^>]*?))?\s*-->/g;

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
    const val = match[2] ?? match[3] ?? match[4] ?? "true";
    attrs[key] = val;
  }
  return attrs;
};

/**
 * Split raw markdown into sequential markdown chunks and component directives.
 */
export const parseMarkdownSegments = (
  rawMarkdown: string,
): ContentSegment[] => {
  if (!rawMarkdown) return [];

  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  COMPONENT_DIRECTIVE_REGEX.lastIndex = 0;

  while ((match = COMPONENT_DIRECTIVE_REGEX.exec(rawMarkdown)) !== null) {
    const textBefore = rawMarkdown.slice(lastIndex, match.index);
    if (textBefore) {
      segments.push({ type: "markdown", content: textBefore });
    }

    const componentName = match[1].toLowerCase();
    const rawAttrs = match[2] || "";
    const props = parseAttributes(rawAttrs);

    segments.push({
      type: "component",
      componentName,
      props,
    });

    lastIndex = match.index + match[0].length;
  }

  const remainingText = rawMarkdown.slice(lastIndex);
  if (remainingText) {
    segments.push({ type: "markdown", content: remainingText });
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
  const isCompact = compact === true || compact === "true";

  const defaultApps = React.useMemo(() => {
    if (apps) {
      return apps.split(",").map((name) => ({ name: name.trim() }));
    }
    return [{ name: "Shuffle_tools", id: "3e2bdf9d5069fe3f4746c29d68785a6a" }];
  }, [apps]);

  return (
    <Box sx={{ my: 3 }}>
      {title && (
        <Typography
          sx={{
            fontSize: "1.05rem",
            fontWeight: 600,
            color: "hsl(var(--foreground))",
            mb: 0.5,
          }}
        >
          {title}
        </Typography>
      )}
      {subtitle && (
        <Typography
          sx={{
            fontSize: "0.875rem",
            color: "hsl(var(--muted-foreground))",
            mb: 1.5,
          }}
        >
          {subtitle}
        </Typography>
      )}
      <AgentUI
        compact={isCompact}
        hideHeroIcon={true}
        title={undefined}
        subtitle={undefined}
        placeholder={
          placeholder ||
          'What do you want the agent to do? e.g. "Check if 1.1.1.1 is malicious"'
        }
        defaultApps={defaultApps}
        readUrlParams={false}
      />
    </Box>
  );
};

interface DocTryMcpProps {
  app?: string;
  appname?: string;
  appid?: string;
  title?: string;
  subtitle?: string;
}

export const DocTryMcp: React.FC<DocTryMcpProps> = ({
  app,
  appname,
  appid,
  title,
  subtitle,
}) => {
  const resolvedAppName = app || appname || "Shuffle Tools";
  const lookup = useAppLookup(resolvedAppName);

  const finalAppId =
    appid ||
    lookup.algoliaId ||
    (resolvedAppName.toLowerCase().includes("shuffle")
      ? "3e2bdf9d5069fe3f4746c29d68785a6a"
      : resolvedAppName);

  const finalAppIcon =
    lookup.image ||
    (resolvedAppName.toLowerCase().includes("shuffle")
      ? "/images/logos/orange_logo.png"
      : undefined);

  if (lookup.loading) {
    return (
      <Box sx={{ my: 3 }}>
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ my: 3 }}>
      {title && (
        <Typography
          sx={{
            fontSize: "1.05rem",
            fontWeight: 600,
            color: "hsl(var(--foreground))",
            mb: 0.5,
          }}
        >
          {title}
        </Typography>
      )}
      {subtitle && (
        <Typography
          sx={{
            fontSize: "0.875rem",
            color: "hsl(var(--muted-foreground))",
            mb: 1.5,
          }}
        >
          {subtitle}
        </Typography>
      )}
      <AppMcpChat
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
  label = "Open AI Agent Sidebar",
  input,
}) => {
  const handleOpen = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("agent-drawer-open", {
        detail: {
          tab: "run",
          source: "docs",
          defaultInput: input,
        },
      }),
    );
  };

  return (
    <Box
      sx={{
        my: 2.5,
        p: 2,
        borderRadius: 2,
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--card))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "hsl(var(--primary) / 0.1)",
            color: "hsl(var(--primary))",
          }}
        >
          <AgentIcon size={20} />
        </Box>
        <Box>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "0.9rem",
              color: "hsl(var(--foreground))",
            }}
          >
            Interactive AI Agent
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "hsl(var(--muted-foreground))" }}
          >
            Open the live AI side-panel to run tasks alongside the
            documentation.
          </Typography>
        </Box>
      </Stack>
      <Button
        variant="contained"
        size="small"
        onClick={handleOpen}
        endIcon={<ArrowRightIcon size={14} />}
        sx={{
          textTransform: "none",
          fontWeight: 500,
          borderRadius: 1.5,
        }}
      >
        {label}
      </Button>
    </Box>
  );
};

interface DocShuffleAIProps {
  label?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  compact?: string | boolean;
  pill?: string | boolean;
}

export const DocShuffleAI: React.FC<DocShuffleAIProps> = ({
  label,
  title,
  subtitle,
  description,
  compact = false,
  pill = true,
}) => {
  const isCompact = compact === true || String(compact) === "true";
  const isPill =
    pill === undefined ? true : pill === true || String(pill) === "true";

  const [activeLLM, setActiveLLM] = useState<{
    label: string;
    url: string;
    logo: string;
  }>({
    label: "Shuffle AI",
    url: "",
    logo: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetchAuthenticatedApps()
      .then((apps) => {
        if (!cancelled && apps) {
          setActiveLLM(resolveActiveLLMProvider(apps));
        }
      })
      .catch(() => {
        // Fall back silently to default Shuffle AI
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = () => {
    openAgentDrawer("localLLM");
  };

  const effectiveLabel = label || activeLLM.label || "Shuffle AI";
  const helperText = subtitle || description;

  return (
    <Box sx={{ my: 2.5 }}>
      {title && (
        <Typography
          sx={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "hsl(var(--foreground))",
            mb: 1,
          }}
        >
          {title}
        </Typography>
      )}
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        <Tooltip title="Configure or swap LLM provider (Shuffle AI, OpenAI, Gemini, Ollama...)">
          <Button
            variant="outlined"
            size="small"
            onClick={handleOpen}
            startIcon={
              activeLLM.logo ? (
                <Box
                  component="img"
                  src={activeLLM.logo}
                  alt=""
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: "3px",
                    objectFit: "contain",
                    display: "block",
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              ) : (
                <AgentIcon size={16} />
              )
            }
            endIcon={<SettingsIcon size={13} style={{ opacity: 0.65 }} />}
            sx={{
              textTransform: "none",
              fontWeight: 500,
              fontSize: "0.85rem",
              borderRadius: isPill ? 999 : 2,
              px: 1.75,
              py: 0.6,
              color: "hsl(var(--foreground))",
              borderColor: "hsl(var(--border))",
              backgroundColor: "hsl(var(--card))",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              transition: "all 0.15s ease",
              "&:hover": {
                borderColor: "hsl(var(--primary))",
                backgroundColor: "hsl(var(--muted) / 0.5)",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.08)",
              },
            }}
          >
            {effectiveLabel}
          </Button>
        </Tooltip>
        {!isCompact && (
          <Typography
            variant="body2"
            sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.825rem" }}
          >
            {helperText ||
              "Click to configure or swap the model provider in the sidebar."}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

interface DocDynamicComponentProps {
  name: string;
  props: Record<string, string>;
}

export const DocDynamicComponent: React.FC<DocDynamicComponentProps> = ({
  name,
  props,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Box sx={{ my: 3 }}>
        <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  switch (name.toLowerCase()) {
    case "agent-ui":
    case "agent":
    case "ai-agent":
      return <DocAgentUI {...props} />;

    case "try-mcp":
    case "mcp":
    case "app-mcp":
      return <DocTryMcp {...props} />;

    case "agent-sidebar":
    case "agent-drawer":
    case "ask-ai":
      return <DocAgentSidebarButton {...props} />;

    case "shuffle-ai":
    case "shuffleai":
    case "swap-llm":
    case "choose-llm":
    case "llm":
    case "local-llm":
    case "localllm":
      return <DocShuffleAI {...props} />;

    default:
      return null;
  }
};
