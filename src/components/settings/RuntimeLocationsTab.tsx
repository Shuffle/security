import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Skeleton,
  MenuItem,
  Select,
  FormControl,
} from "@mui/material";
import {
  Search,
  ExternalLink,
  RefreshCw,
  Server,
  Layers,
  Sparkles,
  Filter,
} from "lucide-react";
import { useWorkflows, WorkflowSummary } from "@/hooks/useWorkflows";
import { useUsecases } from "@/Shuffle-Core/hooks/useUsecases";
import { DEFAULT_USECASES, Usecase } from "@/Shuffle-Core/config/usecases";
import { getApiUrl, getAuthHeader } from "@/Shuffle-MCPs/api";
import {
  DefaultEnvironmentSelector,
  EnvironmentItem,
} from "./DefaultEnvironmentSelector";
import { WorkflowEnvironmentSelector } from "./WorkflowEnvironmentSelector";

interface EnrichedWorkflow {
  workflow: WorkflowSummary;
  matchedUsecases: Usecase[];
  isRelevant: boolean;
  environmentName: string;
}

export const RuntimeLocationsTab = () => {
  const {
    data: workflows = [],
    isLoading: workflowsLoading,
    refetch: refetchWorkflows,
  } = useWorkflows();
  const { usecases = DEFAULT_USECASES } = useUsecases();
  const [environments, setEnvironments] = useState<EnvironmentItem[]>([]);
  const [envsLoading, setEnvsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [filterMode, setFilterMode] = useState<"relevant" | "all">("relevant");
  const [searchQuery, setSearchQuery] = useState("");
  const [envFilter, setEnvFilter] = useState<string>("all");

  // Fetch environments list
  const fetchEnvironments = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/v1/getenvironments"), {
        credentials: "include",
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error("Failed to load environments");
      const data = await res.json();
      setEnvironments(Array.isArray(data) ? data : []);
    } catch {
      setEnvironments([]);
    } finally {
      setEnvsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const defaultEnvironment = useMemo(() => {
    return environments.find((e) => e.default) || null;
  }, [environments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([refetchWorkflows(), fetchEnvironments()]);
    setRefreshing(false);
  };

  // Correlate workflows with usecases and background_processing flag
  const enrichedWorkflows: EnrichedWorkflow[] = useMemo(() => {
    if (!Array.isArray(workflows)) return [];

    return workflows.map((wf) => {
      const wfName = (wf.name || "").toLowerCase();
      const wfTags = (wf.tags || []).map((t) => String(t).toLowerCase());

      // Match against platform usecases
      const matchedUsecases = usecases.filter((uc) => {
        if (!uc.automationLabel) return false;
        const lbl = uc.automationLabel.toLowerCase();
        const isIngestion = uc.automationArea === "automatic_ingestion";

        // Check name or tags
        const nameMatches = wfName === lbl || wfName.includes(lbl);
        const tagMatches =
          wfTags.includes(lbl) || wfTags.some((t) => t.includes(lbl));
        const webhookMatches =
          isIngestion &&
          (wfName === "ingestion webhook" ||
            wfName.includes("ingestion webhook") ||
            wfTags.includes("ingestion webhook"));

        // Threat feeds / IOC canonical matches
        const threatIntelMatches =
          uc.automationArea === "threat_intel" &&
          (wfName.includes("threat feed") ||
            wfName.includes("ioc extraction") ||
            wfTags.includes("threat feed") ||
            wfTags.includes("ioc"));

        // Forward Tickets canonical matches
        const forwardMatches =
          lbl === "forward tickets" &&
          (wfName === "forward tickets" || wfName.includes("forward tickets"));

        return (
          nameMatches ||
          tagMatches ||
          webhookMatches ||
          threatIntelMatches ||
          forwardMatches
        );
      });

      // A workflow is relevant if it has background_processing === true OR matches a platform usecase
      const isRelevant =
        wf.background_processing === true || matchedUsecases.length > 0;

      // Current resolved environment name
      const actionEnv = wf.actions?.find(
        (a: { environment?: string }) => a?.environment,
      )?.environment;
      const triggerEnv = wf.triggers?.find(
        (t: { environment?: string }) => t?.environment,
      )?.environment;
      const explicitEnv = wf.environment || actionEnv || triggerEnv;
      const environmentName =
        explicitEnv || defaultEnvironment?.Name || "Cloud";

      return {
        workflow: wf,
        matchedUsecases,
        isRelevant,
        environmentName,
      };
    });
  }, [workflows, usecases, defaultEnvironment]);

  // Filtered workflows based on search, filterMode, and environment
  const filteredWorkflows = useMemo(() => {
    return enrichedWorkflows.filter((item) => {
      // 1. Filter mode: relevant vs all
      if (filterMode === "relevant" && !item.isRelevant) {
        return false;
      }

      // 2. Environment filter
      if (envFilter !== "all") {
        if (item.environmentName.toLowerCase() !== envFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const nameMatch = (item.workflow.name || "")
          .toLowerCase()
          .includes(query);
        const descMatch = (item.workflow.description || "")
          .toLowerCase()
          .includes(query);
        const tagMatch = (item.workflow.tags || []).some((t) =>
          String(t).toLowerCase().includes(query),
        );
        const usecaseMatch = item.matchedUsecases.some(
          (u) =>
            u.label.toLowerCase().includes(query) ||
            (u.automationLabel &&
              u.automationLabel.toLowerCase().includes(query)),
        );
        return nameMatch || descMatch || tagMatch || usecaseMatch;
      }

      return true;
    });
  }, [enrichedWorkflows, filterMode, envFilter, searchQuery]);

  const relevantCount = useMemo(() => {
    return enrichedWorkflows.filter((w) => w.isRelevant).length;
  }, [enrichedWorkflows]);

  const isLoading = workflowsLoading || envsLoading;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Top Section: Default Runtime Location (mirrored from Preferences tab) */}
      <Paper
        sx={{
          p: 2.5,
          bgcolor: "transparent",
          backgroundImage: "none",
          backdropFilter: "blur(12px)",
          border: "1px solid hsl(var(--border))",
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, color: "hsl(var(--foreground))" }}
          >
            Default Runtime Location
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "hsl(var(--muted-foreground))" }}
          >
            Where workflows execute by default. Archived environments and sensor
            groups cannot be selected.
          </Typography>
        </Box>
        <DefaultEnvironmentSelector />
      </Paper>

      {/* Bottom Section: Relevant Workflows to Shuffle Security Usecases */}
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5 },
          bgcolor: "transparent",
          backgroundImage: "none",
          backdropFilter: "blur(12px)",
          border: "1px solid hsl(var(--border))",
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
      >
        {/* Header and Controls */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "center" },
            gap: 2,
          }}
        >
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Layers size={18} style={{ color: "hsl(var(--primary))" }} />
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, color: "hsl(var(--foreground))" }}
              >
                Usecase Workflows
              </Typography>
              <Chip
                label={`${filteredWorkflows.length} workflow${filteredWorkflows.length === 1 ? "" : "s"}`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  bgcolor: "hsl(var(--muted))",
                  color: "hsl(var(--foreground))",
                }}
              />
            </Box>
            <Typography
              variant="body2"
              sx={{ color: "hsl(var(--muted-foreground))", mt: 0.25 }}
            >
              Workflows powering Shuffle Security automated usecases and
              detections. Configure execution locations individually per
              workflow.
            </Typography>
          </Box>

          {/* Action buttons & mode toggle */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              flexWrap: "wrap",
            }}
          >
            {/* Filter mode chips */}
            <Box
              sx={{
                display: "inline-flex",
                bgcolor: "hsl(var(--muted))",
                p: 0.5,
                borderRadius: 1.5,
                border: "1px solid hsl(var(--border))",
              }}
            >
              <Chip
                label={`Relevant (${relevantCount})`}
                size="small"
                onClick={() => setFilterMode("relevant")}
                icon={<Sparkles size={12} />}
                sx={{
                  height: 24,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  bgcolor:
                    filterMode === "relevant"
                      ? "hsl(var(--card))"
                      : "transparent",
                  color:
                    filterMode === "relevant"
                      ? "hsl(var(--foreground))"
                      : "hsl(var(--muted-foreground))",
                  boxShadow:
                    filterMode === "relevant"
                      ? "0 1px 3px rgba(0,0,0,0.1)"
                      : "none",
                  "&:hover": {
                    bgcolor:
                      filterMode === "relevant"
                        ? "hsl(var(--card))"
                        : "rgba(255,255,255,0.05)",
                  },
                }}
              />
              <Chip
                label={`All Workflows (${enrichedWorkflows.length})`}
                size="small"
                onClick={() => setFilterMode("all")}
                sx={{
                  height: 24,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  bgcolor:
                    filterMode === "all" ? "hsl(var(--card))" : "transparent",
                  color:
                    filterMode === "all"
                      ? "hsl(var(--foreground))"
                      : "hsl(var(--muted-foreground))",
                  boxShadow:
                    filterMode === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  "&:hover": {
                    bgcolor:
                      filterMode === "all"
                        ? "hsl(var(--card))"
                        : "rgba(255,255,255,0.05)",
                  },
                }}
              />
            </Box>

            {/* Refresh button */}
            <Tooltip title="Refresh workflows and environments">
              <span>
                <IconButton
                  size="small"
                  onClick={handleRefresh}
                  disabled={refreshing || isLoading}
                  sx={{
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 1.5,
                    bgcolor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    p: 0.75,
                  }}
                >
                  <RefreshCw
                    size={14}
                    className={refreshing ? "animate-spin" : ""}
                  />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Filter / Search Bar */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.5,
            alignItems: "center",
          }}
        >
          <TextField
            size="small"
            placeholder="Search by workflow name, usecase, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search
                      size={15}
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "hsl(var(--card))",
                borderRadius: 1.5,
                fontSize: "0.8125rem",
                "& fieldset": { borderColor: "hsl(var(--border))" },
                "&:hover fieldset": { borderColor: "hsl(var(--primary))" },
                "&.Mui-focused fieldset": {
                  borderColor: "hsl(var(--primary))",
                },
              },
              "& .MuiInputBase-input": {
                color: "hsl(var(--foreground))",
                fontSize: "0.8125rem",
              },
            }}
          />

          {/* Environment Filter */}
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 200 } }}>
            <Select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              displayEmpty
              startAdornment={
                <Filter
                  size={14}
                  style={{
                    marginRight: 6,
                    color: "hsl(var(--muted-foreground))",
                    flexShrink: 0,
                  }}
                />
              }
              sx={{
                backgroundColor: "hsl(var(--card))",
                borderRadius: 1.5,
                fontSize: "0.8125rem",
                color: "hsl(var(--foreground))",
                "& fieldset": { borderColor: "hsl(var(--border))" },
                "&:hover fieldset": { borderColor: "hsl(var(--primary))" },
                "&.Mui-focused fieldset": {
                  borderColor: "hsl(var(--primary))",
                },
              }}
            >
              <MenuItem value="all" sx={{ fontSize: "0.8125rem" }}>
                All Locations
              </MenuItem>
              {environments.map((env) => (
                <MenuItem
                  key={env.id}
                  value={env.Name}
                  sx={{ fontSize: "0.8125rem" }}
                >
                  {env.Name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Workflows Table */}
        {isLoading ? (
          <Box
            sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 2 }}
          >
            <Skeleton
              variant="rectangular"
              height={45}
              sx={{ borderRadius: 1.5 }}
            />
            <Skeleton
              variant="rectangular"
              height={55}
              sx={{ borderRadius: 1.5 }}
            />
            <Skeleton
              variant="rectangular"
              height={55}
              sx={{ borderRadius: 1.5 }}
            />
            <Skeleton
              variant="rectangular"
              height={55}
              sx={{ borderRadius: 1.5 }}
            />
          </Box>
        ) : filteredWorkflows.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: "center",
              border: "1px dashed hsl(var(--border))",
              borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.01)",
            }}
          >
            <Server
              size={32}
              style={{
                color: "hsl(var(--muted-foreground))",
                margin: "0 auto 12px",
                opacity: 0.6,
              }}
            />
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, color: "hsl(var(--foreground))", mb: 0.5 }}
            >
              No workflows found
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "hsl(var(--muted-foreground))",
                maxWidth: 460,
                mx: "auto",
              }}
            >
              {searchQuery || envFilter !== "all"
                ? "Try adjusting your search query or filters to find workflows."
                : filterMode === "relevant"
                  ? 'No background processing workflows or usecase-matched workflows were found. Toggle to "All Workflows" to view all available workflows in this tenant.'
                  : "No workflows have been created in this tenant yet."}
            </Typography>
          </Box>
        ) : (
          <TableContainer
            sx={{
              border: "1px solid hsl(var(--border))",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Table size="small">
              <TableHead sx={{ bgcolor: "hsl(var(--muted))" }}>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      py: 1.25,
                    }}
                  >
                    Workflow
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      py: 1.25,
                    }}
                  >
                    Associated Usecase(s)
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      py: 1.25,
                    }}
                  >
                    Runtime Location
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredWorkflows.map(({ workflow, matchedUsecases }) => {
                  const hasBg = workflow.background_processing === true;
                  const actionsCount = Array.isArray(workflow.actions)
                    ? workflow.actions.length
                    : 0;
                  const triggersCount = Array.isArray(workflow.triggers)
                    ? workflow.triggers.length
                    : 0;

                  return (
                    <TableRow
                      key={workflow.id}
                      hover
                      sx={{
                        "&:hover": {
                          backgroundColor:
                            "rgba(255, 255, 255, 0.02) !important",
                        },
                      }}
                    >
                      {/* Workflow Name, Link, and Tags */}
                      <TableCell sx={{ py: 1.5, verticalAlign: "top" }}>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              flexWrap: "wrap",
                            }}
                          >
                            <Typography
                              component="a"
                              href={`/workflows/${workflow.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                fontWeight: 600,
                                fontSize: "0.84rem",
                                color: "hsl(var(--foreground))",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                "&:hover": {
                                  color: "hsl(var(--primary))",
                                  textDecoration: "underline",
                                },
                              }}
                            >
                              {workflow.name || "Untitled Workflow"}
                              <ExternalLink
                                size={12}
                                style={{
                                  color: "hsl(var(--muted-foreground))",
                                }}
                              />
                            </Typography>

                            {hasBg && (
                              <Chip
                                label="Background"
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: "0.625rem",
                                  fontWeight: 600,
                                  bgcolor: "rgba(139, 92, 246, 0.15)",
                                  color: "#a78bfa",
                                  border: "1px solid rgba(139, 92, 246, 0.3)",
                                  "& .MuiChip-label": { px: 0.75 },
                                }}
                              />
                            )}
                          </Box>

                          {workflow.description ? (
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: "0.75rem",
                                color: "hsl(var(--muted-foreground))",
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {workflow.description}
                            </Typography>
                          ) : null}

                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              mt: 0.25,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: "0.6875rem",
                                color: "hsl(var(--muted-foreground))",
                              }}
                            >
                              {actionsCount} node{actionsCount === 1 ? "" : "s"}{" "}
                              · {triggersCount} trigger
                              {triggersCount === 1 ? "" : "s"}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Associated Usecases */}
                      <TableCell sx={{ py: 1.5, verticalAlign: "top" }}>
                        {matchedUsecases.length > 0 ? (
                          <Box
                            sx={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 0.75,
                              maxWidth: 320,
                            }}
                          >
                            {matchedUsecases.map((uc) => (
                              <Chip
                                key={uc.id}
                                label={uc.label}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: "0.7rem",
                                  fontWeight: 500,
                                  bgcolor: "hsl(var(--muted))",
                                  color: "hsl(var(--foreground))",
                                  border: "1px solid hsl(var(--border))",
                                  "& .MuiChip-label": { px: 0.75 },
                                }}
                              />
                            ))}
                          </Box>
                        ) : hasBg ? (
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: "0.75rem",
                              color: "hsl(var(--muted-foreground))",
                              fontStyle: "italic",
                            }}
                          >
                            Platform background workflow
                          </Typography>
                        ) : (
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: "0.75rem",
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            —
                          </Typography>
                        )}
                      </TableCell>

                      {/* Runtime Location Dropdown */}
                      <TableCell
                        sx={{ py: 1.5, verticalAlign: "top", minWidth: 260 }}
                      >
                        <WorkflowEnvironmentSelector
                          workflow={workflow}
                          environments={environments}
                          defaultEnvironment={defaultEnvironment}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default RuntimeLocationsTab;
