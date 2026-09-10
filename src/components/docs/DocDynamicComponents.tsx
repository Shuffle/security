import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  InputBase,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AgentUI from "@/Shuffle-MCPs/components/AgentUI";
import AppMcpChat from "@/Shuffle-MCPs/views/AppMcpChat";
import { useAppLookup } from "@/Shuffle-MCPs/useAppLookup";
import AgentIcon from "@/Shuffle-MCPs/components/AgentIcon";
import { openAgentDrawer } from "@/lib/agentDrawer";
import { fetchAuthenticatedApps } from "@/Shuffle-MCPs/authenticatedApps";
import { resolveActiveLLMProvider } from "@/Shuffle-MCPs/llmProviderDetect";
import { IngestionSourcesRow } from "@/components/ingestion/IngestionSourcesRow";
import { useNavigate } from "@/lib/router-compat";
import { useDatastore } from "@/hooks/useDatastore";
import { DATASTORE_CATEGORIES } from "@/Shuffle-MCPs/datastore";
import { useVulnerabilities } from "@/hooks/useVulnerabilities";
import { useHostMonitorCount } from "@/hooks/useHostMonitorCount";
import { getApiUrl, getAuthHeader } from "@/Shuffle-MCPs/api";
import { ComponentErrorBoundary } from "@/components/common/ComponentErrorBoundary";
import { UsecaseDrawer } from "@/Shuffle-Core";
import { API_CONFIG } from "@/Shuffle-MCPs/api";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { AutomationReadinessBanner } from "@/components/incidents/AutomationReadinessBanner";
import { VulnerabilityReadinessBanner } from "@/components/vulnerabilities/VulnerabilityReadinessBanner";

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
      const cleanMarkdown = textBefore.replace(/<!--[\s\S]*?-->/g, "");
      if (cleanMarkdown.trim()) {
        segments.push({ type: "markdown", content: cleanMarkdown });
      }
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
    const cleanMarkdown = remainingText.replace(/<!--[\s\S]*?-->/g, "");
    if (cleanMarkdown.trim()) {
      segments.push({ type: "markdown", content: cleanMarkdown });
    }
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
    if (!apps || apps === "none" || apps === '""' || apps === "''") {
      return [];
    }
    return apps
      .split(",")
      .map((name) => name.trim())
      .filter((name) => Boolean(name) && name !== "none")
      .map((name) => ({ name }));
  }, [apps]);

  const effectiveTitle = title !== undefined ? title : "Try the AI Agent";

  return (
    <Box className="not-prose" sx={{ my: 3 }}>
      <AgentUI
        compact={isCompact}
        hideHeroIcon={true}
        title={effectiveTitle}
        subtitle={subtitle}
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

interface DocIngestProps {
  workflow?: string;
  category?: string;
  title?: string;
  subtitle?: string;
}

export const DocIngest: React.FC<DocIngestProps> = ({
  workflow = "Ingest Tickets",
  category = "cases",
  title = "Interactive Alert Ingest Pipeline",
  subtitle = "Configure webhooks and connected tools that feed into your incident queue in real time.",
}) => {
  return (
    <Box
      sx={{
        my: 3,
        p: 2.5,
        borderRadius: 2.5,
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <Box sx={{ mb: 2 }}>
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
        {subtitle && (
          <Typography
            sx={{
              fontSize: "0.85rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      <IngestionSourcesRow
        workflowLabel={workflow}
        category={category}
        webhookLabel={`${workflow}_webhook`}
        webhookWorkflowName="Ingestion Webhook"
      />
    </Box>
  );
};

interface DocUsecasesProps {
  title?: string;
  subtitle?: string;
  category?: string;
}

const USECASES_BY_CATEGORY: Record<
  string,
  {
    title: string;
    subtitle: string;
    items: Array<{ title: string; desc: string; flowId?: string }>;
  }
> = {
  vulnerabilities: {
    title: "Vulnerability & Patch Automation Use Cases",
    subtitle:
      "Turn scanner findings into automated patch playbooks, code reviews, and risk escalations.",
    items: [
      {
        title: "Automated Patch Orchestration",
        desc: "Ingest CVEs with high EPSS or CISA KEV tags, verify available packages, and trigger Ansible or AWS SSM patching.",
        flowId: "asset_management_case_management_vuln_response_1",
      },
      {
        title: "CI/CD Dependency Gate",
        desc: "Scan npm, pip, and cargo dependencies in PRs; alert engineering in Slack and create Jira tickets for critical flaws.",
        flowId: "asset_management_case_management_vuln_1",
      },
      {
        title: "Emergency Zero-Day Fleet Audit",
        desc: "When a zero-day drops, instantly query all Host Monitors and cloud assets to identify vulnerable package versions.",
        flowId: "vulnerability_ingestion_1",
      },
      {
        title: "Auto-Ticketing & SLA Escalation",
        desc: "Automatically sync critical findings to Jira or ServiceNow, and escalate overdue remediations into Incidents.",
        flowId: "case_management_cases_forward_1",
      },
    ],
  },
  monitors: {
    title: "Host Monitoring & Endpoint Compliance Use Cases",
    subtitle:
      "Continuous posture verification, live endpoint forensics, and automated containment.",
    items: [
      {
        title: "Non-Compliant Laptop Quarantine",
        desc: "Detect disabled FileVault or BitLocker on endpoints, notify the user, and auto-revoke access if uncorrected.",
        flowId: "case_management_asset_management_monitors_1",
      },
      {
        title: "Live Incident Forensics",
        desc: "Directly from an active incident, trigger host actions to dump process trees, open ports, and recent file changes.",
        flowId: "case_management_asset_management_monitors_1",
      },
      {
        title: "Fleet-Wide Threat Hunting",
        desc: "Run one-click inspection scripts via the remote web terminal across thousands of endpoints to identify compromised hashes.",
        flowId: "case_management_asset_management_monitors_1",
      },
      {
        title: "Developer Dependency Audit",
        desc: "Use the local Code Package Scanner to catch risky open-source packages before code is pushed to production.",
        flowId: "asset_management_case_management_vuln_1",
      },
    ],
  },
  cases: {
    title: "Pre-Built Incident & SOC Use Cases",
    subtitle:
      "Shuffle bridges ingestion, analysis, and containment into reusable multi-phase pipelines.",
    items: [
      {
        title: "Phishing Triage & Auto-Purge",
        desc: "Parse headers (SPF/DKIM/DMARC), sandbox attachments, extract IOCs, and purge malicious emails across the entire tenant.",
        flowId: "email_case_management_1",
      },
      {
        title: "EDR Detection & Host Isolation",
        desc: "Ingest alerts from CrowdStrike or SentinelOne, correlate with threat feeds, and trigger one-click host isolation.",
        flowId: "edr_case_management_1",
      },
      {
        title: "Cloud Identity & Impossible Travel",
        desc: "Detect suspicious Okta or Azure AD logins, prompt user via Slack/Teams, and auto-revoke sessions upon anomaly confirmation.",
        flowId: "case_management_iam_1",
      },
      {
        title: "IOC Enrichment & Firewall Block",
        desc: "Extract IPs and domains from SIEM alerts, check reputation in VirusTotal / AbuseIPDB, and push block rules to firewalls.",
        flowId: "threat_intel_case_management_1",
      },
    ],
  },
  architecture: {
    title: "Deployment & Architecture Patterns",
    subtitle:
      "Engineered for high availability, air-gapped security, and distributed hybrid orchestration.",
    items: [
      {
        title: "Single Server / Docker Compose",
        desc: "All-in-one standalone deployment running frontend, backend, OpenSearch, and Orborus on a single host.",
        flowId: "siem_case_management_1",
      },
      {
        title: "Distributed Swarm Clustering",
        desc: "Separate backend API from execution runtime across dedicated worker nodes with overlay networking.",
        flowId: "edr_case_management_1",
      },
      {
        title: "Cloud Hybrid Orchestration",
        desc: "Manage workflows from Shuffle Cloud while Orborus executes actions on-premise inside your private network.",
        flowId: "case_management_cloud_1",
      },
      {
        title: "Kubernetes Cloud-Native",
        desc: "Scale workers dynamically as ephemeral Kubernetes pods with native namespace isolation and RBAC.",
        flowId: "cloud_siem_1",
      },
    ],
  },
};

export const DocUsecases: React.FC<DocUsecasesProps> = ({
  title,
  subtitle,
  category = "cases",
}) => {
  const navigate = useNavigate();
  const { userInfo } = useAuth();
  const { resolvedTheme } = useTheme();
  const [activeDrawerFlowId, setActiveDrawerFlowId] = useState<string | null>(null);

  const normalizedCategory = category.toLowerCase().includes("vuln")
    ? "vulnerabilities"
    : category.toLowerCase().includes("mon") || category.toLowerCase().includes("host")
    ? "monitors"
    : category.toLowerCase().includes("arch")
    ? "architecture"
    : "cases";

  const config =
    USECASES_BY_CATEGORY[normalizedCategory] || USECASES_BY_CATEGORY.cases;
  const displayTitle = title || config.title;
  const displaySubtitle = subtitle || config.subtitle;
  const usecases = config.items;

  return (
    <>
      <Box
        sx={{
          my: 3,
          p: 2.5,
          borderRadius: 2.5,
          border: "1px solid hsl(var(--border))",
          backgroundColor: "hsl(var(--card))",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: "1.05rem",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                mb: 0.5,
              }}
            >
              {displayTitle}
            </Typography>
            {displaySubtitle && (
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {displaySubtitle}
              </Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/usecases")}
            sx={{
              textTransform: "none",
              fontWeight: 500,
              borderRadius: 1.5,
            }}
          >
            View all use cases
          </Button>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1.5,
          }}
        >
          {usecases.map((uc, i) => (
            <Box
              key={i}
              onClick={() => {
                if (uc.flowId) {
                  setActiveDrawerFlowId(uc.flowId);
                } else {
                  navigate("/usecases");
                }
              }}
              sx={{
                p: 1.75,
                borderRadius: 2,
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--background))",
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:hover": {
                  borderColor: "hsl(var(--primary))",
                  transform: "translateY(-1px)",
                },
              }}
            >
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "hsl(var(--foreground))",
                  mb: 0.5,
                }}
              >
                {uc.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.8rem", lineHeight: 1.4 }}
              >
                {uc.desc}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <UsecaseDrawer
        open={!!activeDrawerFlowId}
        onClose={() => setActiveDrawerFlowId(null)}
        flowId={activeDrawerFlowId}
        globalUrl={API_CONFIG.baseUrl}
        userdata={userInfo as any}
        isLoaded={true}
        isLoggedIn={!!userInfo}
        theme={resolvedTheme}
      />
    </>
  );
};

interface DocAutomationReadinessProps {
  type?: string;
  category?: string;
}

export const DocAutomationReadiness: React.FC<DocAutomationReadinessProps> = ({
  type,
  category,
}) => {
  const target = (type || category || "incidents").toLowerCase();
  const isVuln = target.includes("vuln");

  return (
    <Box sx={{ my: 3 }}>
      {isVuln ? (
        <VulnerabilityReadinessBanner />
      ) : (
        <AutomationReadinessBanner />
      )}
    </Box>
  );
};

// ==========================================
// 1. Live Incident Status & Queue Telemetry
// ==========================================
interface DocIncidentStatusProps {
  title?: string;
  subtitle?: string;
}

export const DocIncidentStatus: React.FC<DocIncidentStatusProps> = ({
  title = "Live Incident Queue & Health",
  subtitle = "Real-time queue metrics and telemetry from your active Shuffle incident pipeline.",
}) => {
  const navigate = useNavigate();
  const { items, isLoading, fetchItems } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
  });

  const counts = useMemo(() => {
    let open = 0;
    let newCount = 0;
    let inProgress = 0;
    let critical = 0;
    let resolved = 0;

    for (const item of items) {
      try {
        const val =
          typeof item?.value === "string" ? JSON.parse(item.value) : item?.value;
        const status = String(val?.status || val?.status_id || "").toLowerCase();
        const sev = String(val?.severity || val?.severity_id || "").toLowerCase();

        if (status === "resolved" || status === "closed") {
          resolved++;
        } else {
          open++;
          if (status === "in_progress" || status === "in progress") inProgress++;
          else newCount++;
        }

        if (sev === "critical" || sev === "high" || sev === "1" || sev === "2") {
          critical++;
        }
      } catch {
        // ignore parse error
      }
    }

    return { total: items.length, open, newCount, inProgress, critical, resolved };
  }, [items]);

  return (
    <Box
      sx={{
        my: 3,
        p: 2.5,
        borderRadius: 2.5,
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "#22c55e",
                boxShadow: "0 0 8px #22c55e",
              }}
            />
            <Typography
              sx={{
                fontSize: "1.05rem",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: "rgba(34, 197, 94, 0.12)",
                color: "#22c55e",
                fontWeight: 600,
                fontSize: "0.72rem",
              }}
            >
              Live Telemetry
            </Typography>
          </Box>
          {subtitle && (
            <Typography
              sx={{
                fontSize: "0.85rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => fetchItems()}
            disabled={isLoading}
            sx={{
              textTransform: "none",
              fontWeight: 500,
              borderRadius: 1.5,
            }}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate("/incidents")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 1.5,
            }}
          >
            Open Incidents
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
          gap: 1.5,
        }}
      >
        <Box
          onClick={() => navigate("/incidents?status=new")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:hover": { borderColor: "hsl(var(--primary))", transform: "translateY(-1px)" },
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 500, mb: 0.5 }}>
            New Detections
          </Typography>
          <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: "hsl(var(--foreground))" }}>
            {isLoading ? <Skeleton width={40} height={32} /> : counts.newCount}
          </Typography>
        </Box>

        <Box
          onClick={() => navigate("/incidents?status=in_progress")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:hover": { borderColor: "hsl(var(--primary))", transform: "translateY(-1px)" },
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 500, mb: 0.5 }}>
            In Progress
          </Typography>
          <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: "hsl(var(--foreground))" }}>
            {isLoading ? <Skeleton width={40} height={32} /> : counts.inProgress}
          </Typography>
        </Box>

        <Box
          onClick={() => navigate("/incidents?severity=critical")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid rgba(239, 68, 68, 0.25)",
            bgcolor: "rgba(239, 68, 68, 0.04)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:hover": { borderColor: "#ef4444", transform: "translateY(-1px)" },
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 600, mb: 0.5 }}>
            Critical / High
          </Typography>
          <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: "#ef4444" }}>
            {isLoading ? <Skeleton width={40} height={32} /> : counts.critical}
          </Typography>
        </Box>

        <Box
          onClick={() => navigate("/incidents?status=resolved")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:hover": { borderColor: "hsl(var(--primary))", transform: "translateY(-1px)" },
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 500, mb: 0.5 }}>
            Resolved
          </Typography>
          <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: "#22c55e" }}>
            {isLoading ? <Skeleton width={40} height={32} /> : counts.resolved}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ==========================================
// 2. Live Vulnerability Backlog & Risk Stats
// ==========================================
interface DocVulnStatusProps {
  title?: string;
  subtitle?: string;
}

export const DocVulnStatus: React.FC<DocVulnStatusProps> = ({
  title = "Live Vulnerability Backlog & Risk",
  subtitle = "Active CVEs, package findings, and exploit likelihood tracked in your environment.",
}) => {
  const navigate = useNavigate();
  const { allVulnerabilities, severityCounts, isLoading, refresh } =
    useVulnerabilities();

  return (
    <Box
      sx={{
        my: 3,
        p: 2.5,
        borderRadius: 2.5,
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Typography
              sx={{
                fontSize: "1.05rem",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: "hsl(var(--primary) / 0.12)",
                color: "hsl(var(--primary))",
                fontWeight: 600,
                fontSize: "0.72rem",
              }}
            >
              CISA KEV + EPSS
            </Typography>
          </Box>
          {subtitle && (
            <Typography
              sx={{
                fontSize: "0.85rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => refresh()}
            disabled={isLoading}
            sx={{
              textTransform: "none",
              fontWeight: 500,
              borderRadius: 1.5,
            }}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate("/vulnerabilities")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 1.5,
            }}
          >
            Open Vulnerabilities
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
          gap: 1.5,
        }}
      >
        <Box
          onClick={() => navigate("/vulnerabilities")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid rgba(239, 68, 68, 0.25)",
            bgcolor: "rgba(239, 68, 68, 0.04)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:hover": { borderColor: "#ef4444", transform: "translateY(-1px)" },
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 600, mb: 0.5 }}>
            Critical (KEV / High EPSS)
          </Typography>
          <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: "#ef4444" }}>
            {isLoading ? <Skeleton width={40} height={32} /> : severityCounts.critical}
          </Typography>
        </Box>

        <Box
          onClick={() => navigate("/vulnerabilities")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid rgba(249, 115, 22, 0.25)",
            bgcolor: "rgba(249, 115, 22, 0.04)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:hover": { borderColor: "#f97316", transform: "translateY(-1px)" },
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "#f97316", fontWeight: 600, mb: 0.5 }}>
            High Severity
          </Typography>
          <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: "#f97316" }}>
            {isLoading ? <Skeleton width={40} height={32} /> : severityCounts.high}
          </Typography>
        </Box>

        <Box
          onClick={() => navigate("/vulnerabilities")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:hover": { borderColor: "hsl(var(--primary))", transform: "translateY(-1px)" },
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 500, mb: 0.5 }}>
            Medium / Low
          </Typography>
          <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: "hsl(var(--foreground))" }}>
            {isLoading ? (
              <Skeleton width={40} height={32} />
            ) : (
              severityCounts.medium + severityCounts.low
            )}
          </Typography>
        </Box>

        <Box
          onClick={() => navigate("/vulnerabilities")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:hover": { borderColor: "hsl(var(--primary))", transform: "translateY(-1px)" },
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 500, mb: 0.5 }}>
            Total Findings
          </Typography>
          <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: "hsl(var(--foreground))" }}>
            {isLoading ? <Skeleton width={40} height={32} /> : allVulnerabilities.length}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ==========================================
// 3. Interactive Live CVE & Advisory Lookup
// ==========================================
interface DocCveLookupProps {
  title?: string;
  placeholder?: string;
}

export const DocCveLookup: React.FC<DocCveLookupProps> = ({
  title = "Live CVE & Exploit Intelligence Lookup",
  placeholder = "e.g. CVE-2024-3094, CVE-2023-38606, or GHSA-xxxx",
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = (cveId?: string) => {
    const target = (cveId || query).trim();
    if (!target) return;
    navigate(`/vulnerabilities/${encodeURIComponent(target)}`);
  };

  const sampleCves = [
    { id: "CVE-2024-3094", label: "XZ Backdoor (Critical)" },
    { id: "CVE-2023-38606", label: "Triangulation (CISA KEV)" },
    { id: "CVE-2021-44228", label: "Log4Shell (EPSS 97%)" },
  ];

  return (
    <Box
      sx={{
        my: 3,
        p: 2.5,
        borderRadius: 2.5,
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: "1.05rem",
              fontWeight: 600,
              color: "hsl(var(--foreground))",
            }}
          >
            {title}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: "0.85rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Test any advisory against OSV.dev, real-world CISA KEV exploitation, and live EPSS scores.
        </Typography>
      </Box>

      <Box
        component="form"
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          handleSearch();
        }}
        sx={{
          display: "flex",
          gap: 1,
          mb: 1.5,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 1.5,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
          }}
        >
          <InputBase
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            sx={{
              flex: 1,
              fontSize: "0.88rem",
              fontFamily: "monospace",
              color: "hsl(var(--foreground))",
            }}
          />
        </Box>
        <Button
          type="submit"
          variant="contained"
          disabled={!query.trim()}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 1.5,
            px: 2,
          }}
        >
          Check Advisory
        </Button>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography
          variant="caption"
          sx={{ color: "hsl(var(--muted-foreground))", fontWeight: 500 }}
        >
          Quick samples:
        </Typography>
        {sampleCves.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            size="small"
            clickable
            onClick={() => handleSearch(c.id)}
            sx={{
              fontSize: "0.75rem",
              borderRadius: 1.5,
              borderColor: "hsl(var(--border))",
              bgcolor: "hsl(var(--background))",
              "&:hover": { borderColor: "hsl(var(--primary))" },
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

// ==========================================
// 4. Fleet Posture & Compliance Status
// ==========================================
interface DocHostStatusProps {
  title?: string;
  subtitle?: string;
}

export const DocHostStatus: React.FC<DocHostStatusProps> = ({
  title = "Fleet Posture & Compliance Status",
  subtitle = "Real-time endpoint compliance, disk encryption, and software inventory across registered hosts.",
}) => {
  const navigate = useNavigate();
  const hostCount = useHostMonitorCount();

  return (
    <Box
      sx={{
        my: 3,
        p: 2.5,
        borderRadius: 2.5,
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Typography
              sx={{
                fontSize: "1.05rem",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor:
                  hostCount && hostCount > 0
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(100, 116, 139, 0.12)",
                color: hostCount && hostCount > 0 ? "#22c55e" : "hsl(var(--muted-foreground))",
                fontWeight: 600,
                fontSize: "0.72rem",
              }}
            >
              {hostCount === null
                ? "Connecting..."
                : `${hostCount} Host${hostCount === 1 ? "" : "s"} Monitored`}
            </Typography>
          </Box>
          {subtitle && (
            <Typography
              sx={{
                fontSize: "0.85rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/monitors")}
            sx={{
              textTransform: "none",
              fontWeight: 500,
              borderRadius: 1.5,
              borderColor: "hsl(var(--border))",
            }}
          >
            View Fleet Table
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate("/monitors")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 1.5,
            }}
          >
            Manage Monitors
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
          gap: 1.5,
        }}
      >
        <Box
          onClick={() => navigate("/monitors")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
            cursor: "pointer",
            "&:hover": { borderColor: "hsl(var(--primary))" },
          }}
        >
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "hsl(var(--foreground))", mb: 0.5 }}>
            Disk Encryption
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))" }}>
            FileVault, BitLocker, & LUKS verification
          </Typography>
        </Box>

        <Box
          onClick={() => navigate("/monitors")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
            cursor: "pointer",
            "&:hover": { borderColor: "hsl(var(--primary))" },
          }}
        >
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "hsl(var(--foreground))", mb: 0.5 }}>
            Screen Lock
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))" }}>
            Max 15-min idle timeout compliance
          </Typography>
        </Box>

        <Box
          onClick={() => navigate("/monitors")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
            cursor: "pointer",
            "&:hover": { borderColor: "hsl(var(--primary))" },
          }}
        >
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "hsl(var(--foreground))", mb: 0.5 }}>
            Software Catalog
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))" }}>
            Installed apps and package versions
          </Typography>
        </Box>

        <Box
          onClick={() => navigate("/monitors")}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: "1px solid hsl(var(--border))",
            bgcolor: "hsl(var(--background))",
            cursor: "pointer",
            "&:hover": { borderColor: "hsl(var(--primary))" },
          }}
        >
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "hsl(var(--foreground))", mb: 0.5 }}>
            Code Scanner
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))" }}>
            npm, pip, cargo, and go.mod audits
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ==========================================
// 5. Interactive One-Liner Host Daemon Deployer
// ==========================================
interface DocAddHostProps {
  title?: string;
  os?: string;
}

export const DocAddHost: React.FC<DocAddHostProps> = ({
  title = "Deploy Shuffle Host Monitor Daemon",
  os: initialOs = "macos",
}) => {
  const navigate = useNavigate();
  const [selectedOs, setSelectedOs] = useState<"macos" | "linux" | "windows">(
    initialOs.toLowerCase().includes("win")
      ? "windows"
      : initialOs.toLowerCase().includes("lin")
      ? "linux"
      : "macos",
  );
  const [copied, setCopied] = useState(false);

  const commands: Record<"macos" | "linux" | "windows", string> = {
    macos:
      "curl -sSL https://shuffle.security/api/v1/monitors/install.sh | sudo bash",
    linux:
      "curl -sSL https://shuffle.security/api/v1/monitors/install.sh | sudo bash",
    windows: "irm https://shuffle.security/api/v1/monitors/install.ps1 | iex",
  };

  const currentCommand = commands[selectedOs];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        my: 3,
        p: 2.5,
        borderRadius: 2.5,
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box>
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
          <Typography
            sx={{
              fontSize: "0.85rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Lightweight, low-overhead daemon for continuous compliance, package scanning, and remote containment.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={() => navigate("/monitors")}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            borderRadius: 1.5,
          }}
        >
          Open Registration Modal
        </Button>
      </Box>

      {/* OS Selector Tabs */}
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        {(["macos", "linux", "windows"] as const).map((osKey) => (
          <Button
            key={osKey}
            size="small"
            variant={selectedOs === osKey ? "contained" : "outlined"}
            onClick={() => setSelectedOs(osKey)}
            sx={{
              textTransform: "capitalize",
              fontSize: "0.8rem",
              borderRadius: 1.5,
              fontWeight: 600,
            }}
          >
            {osKey === "macos" ? "macOS" : osKey === "linux" ? "Linux" : "Windows"}
          </Button>
        ))}
      </Stack>

      {/* Code Snippet Box */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          p: 1.5,
          borderRadius: 2,
          border: "1px solid hsl(var(--border))",
          bgcolor: "hsl(var(--background))",
        }}
      >
        <Typography
          component="code"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.82rem",
            color: "hsl(var(--foreground))",
            overflowX: "auto",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {currentCommand}
        </Typography>
        <Button
          size="small"
          onClick={handleCopy}
          sx={{
            minWidth: 70,
            textTransform: "none",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: copied ? "#22c55e" : "hsl(var(--foreground))",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </Box>
    </Box>
  );
};

// ==========================================
// 6. Live Architecture & Service Status
// ==========================================
interface DocSystemHealthProps {
  title?: string;
}

export const DocSystemHealth: React.FC<DocSystemHealthProps> = ({
  title = "Live Architecture & Service Status",
}) => {
  const navigate = useNavigate();
  const [latency, setLatency] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    const start = performance.now();
    try {
      const res = await fetch(getApiUrl("/api/v1/health"), {
        credentials: "include",
        headers: { ...getAuthHeader() },
      });
      const end = performance.now();
      setLatency(Math.round(end - start));
      setApiOnline(res.ok || res.status < 500);
    } catch {
      // fallback test on version
      try {
        const res2 = await fetch(getApiUrl("/api/v1/version"), {
          credentials: "include",
          headers: { ...getAuthHeader() },
        });
        const end = performance.now();
        setLatency(Math.round(end - start));
        setApiOnline(res2.ok || res2.status < 500);
      } catch {
        setApiOnline(false);
        setLatency(null);
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const services = [
    {
      name: "Shuffle Web UI",
      desc: "React frontends on port :3001 / :3002",
      status: "Connected",
      isHealthy: true,
    },
    {
      name: "Backend API (Go)",
      desc: "Core REST server on port :5001",
      status: apiOnline === false ? "Degraded" : "Healthy",
      isHealthy: apiOnline !== false,
    },
    {
      name: "Datastore Cluster",
      desc: "OpenSearch document store",
      status: "Operational",
      isHealthy: true,
    },
    {
      name: "Orborus Runtime",
      desc: "Docker Swarm & K8s worker engine",
      status: "Listening",
      isHealthy: true,
    },
  ];

  return (
    <Box
      sx={{
        my: 3,
        p: 2.5,
        borderRadius: 2.5,
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Typography
              sx={{
                fontSize: "1.05rem",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
              }}
            >
              {title}
            </Typography>
            {latency !== null && (
              <Typography
                variant="caption"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: "rgba(34, 197, 94, 0.12)",
                  color: "#22c55e",
                  fontWeight: 600,
                  fontSize: "0.72rem",
                }}
              >
                {latency}ms API Ping
              </Typography>
            )}
          </Box>
          <Typography
            sx={{
              fontSize: "0.85rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Live connectivity across Server (Frontend, Backend, OpenSearch) and Runtime (Orborus, Workers).
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={checkHealth}
            disabled={isChecking}
            sx={{
              textTransform: "none",
              fontWeight: 500,
              borderRadius: 1.5,
            }}
          >
            {isChecking ? "Pinging..." : "Refresh"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/admin/locations")}
            sx={{
              textTransform: "none",
              fontWeight: 500,
              borderRadius: 1.5,
            }}
          >
            Environments
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 1.5,
        }}
      >
        {services.map((svc, i) => (
          <Box
            key={i}
            sx={{
              p: 1.75,
              borderRadius: 2,
              border: "1px solid hsl(var(--border))",
              bgcolor: "hsl(var(--background))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: "0.88rem", color: "hsl(var(--foreground))" }}>
                {svc.name}
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
                {svc.desc}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: svc.isHealthy ? "#22c55e" : "#eab308",
                  boxShadow: svc.isHealthy ? "0 0 6px #22c55e" : "none",
                }}
              />
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: svc.isHealthy ? "#22c55e" : "#eab308",
                }}
              >
                {svc.status}
              </Typography>
            </Box>
          </Box>
        ))}
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

  const renderInner = () => {
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

      case "ingest":
      case "ingestion":
      case "ingest-sources":
        return <DocIngest {...props} />;

      case "usecases":
      case "usecase":
      case "soc-usecases":
        return <DocUsecases {...props} />;

      case "incident-status":
      case "incident-stats":
      case "incidents-status":
      case "incidents-stats":
        return <DocIncidentStatus {...props} />;

      case "vuln-status":
      case "vuln-stats":
      case "vulnerabilities-status":
      case "vulnerabilities-stats":
        return <DocVulnStatus {...props} />;

      case "cve-lookup":
      case "vuln-lookup":
      case "cve":
        return <DocCveLookup {...props} />;

      case "host-status":
      case "host-stats":
      case "fleet-status":
      case "fleet-stats":
      case "monitors-status":
      case "monitors-stats":
        return <DocHostStatus {...props} />;

      case "add-host":
      case "install-daemon":
      case "install-agent":
      case "install-monitor":
        return <DocAddHost {...props} />;

      case "system-health":
      case "architecture-status":
      case "architecture-health":
      case "cluster-status":
        return <DocSystemHealth {...props} />;

      case "automation-readiness":
      case "readiness":
      case "readiness-banner":
      case "automation-readiness-banner":
        return <DocAutomationReadiness {...props} />;

      case "incident-readiness":
      case "incidents-readiness":
        return <DocAutomationReadiness {...props} type="incidents" />;

      case "vuln-readiness":
      case "vulnerability-readiness":
      case "vulnerabilities-readiness":
        return <DocAutomationReadiness {...props} type="vulnerabilities" />;

      default:
        return null;
    }
  };

  const rendered = renderInner();
  if (!rendered) return null;
  return (
    <Box className="not-prose">
      <ComponentErrorBoundary name={`DocComponent-${name}`} fallback={null}>
        {rendered}
      </ComponentErrorBoundary>
    </Box>
  );
};
