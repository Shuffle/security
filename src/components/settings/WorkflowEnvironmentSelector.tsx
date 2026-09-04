import { useState, useMemo } from "react";
import {
  Autocomplete,
  Box,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { getApiUrl, getAuthHeader } from "@/Shuffle-MCPs/api";
import { toast } from "@/lib/toast";
import { WorkflowSummary } from "@/hooks/useWorkflows";
import {
  EnvironmentItem,
  isRunning,
  TypeIcon,
  RunningChip,
} from "./DefaultEnvironmentSelector";

export interface WorkflowEnvironmentSelectorProps {
  workflow: WorkflowSummary;
  environments: EnvironmentItem[];
  defaultEnvironment?: EnvironmentItem | null;
  onUpdated?: (updatedWorkflow: WorkflowSummary, newEnvName: string) => void;
  disabled?: boolean;
  minWidth?: number | string;
}

export const WorkflowEnvironmentSelector = ({
  workflow,
  environments,
  defaultEnvironment,
  onUpdated,
  disabled = false,
  minWidth = 220,
}: WorkflowEnvironmentSelectorProps) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [localEnvName, setLocalEnvName] = useState<string | null>(null);

  // Discover explicit environment on the workflow object, actions, or triggers
  const explicitEnvName = useMemo(() => {
    if (localEnvName) return localEnvName;
    if (workflow.environment && typeof workflow.environment === "string") {
      return workflow.environment;
    }
    const actionEnv = workflow.actions?.find(
      (a: { environment?: string }) => a?.environment,
    )?.environment;
    if (actionEnv && typeof actionEnv === "string") return actionEnv;
    const triggerEnv = workflow.triggers?.find(
      (t: { environment?: string }) => t?.environment,
    )?.environment;
    if (triggerEnv && typeof triggerEnv === "string") return triggerEnv;
    return null;
  }, [workflow, localEnvName]);

  // Selected EnvironmentItem from environments list
  const selectedEnv = useMemo<EnvironmentItem | undefined>(() => {
    if (explicitEnvName) {
      const match = environments.find(
        (e) =>
          e.Name.toLowerCase() === explicitEnvName.toLowerCase() ||
          e.id === explicitEnvName,
      );
      if (match) return match;
    }
    // If no explicit environment, fall back to default runtime location
    return defaultEnvironment || environments.find((e) => e.default);
  }, [explicitEnvName, environments, defaultEnvironment]);

  const isInherited = !explicitEnvName;

  const handleSelect = async (next: EnvironmentItem | null) => {
    if (!next || next.id === selectedEnv?.id) return;
    setSaving(true);

    try {
      // 1. Fetch full workflow to ensure all branches, nodes, triggers are preserved
      let fullWorkflow: Record<string, unknown> = workflow as unknown as Record<
        string,
        unknown
      >;
      try {
        const getRes = await fetch(
          getApiUrl(`/api/v1/workflows/${workflow.id}`),
          {
            credentials: "include",
            headers: { ...getAuthHeader() },
          },
        );
        if (getRes.ok) {
          const fetched = (await getRes.json()) as Record<string, unknown>;
          if (fetched?.id === workflow.id) {
            fullWorkflow = fetched;
          }
        }
      } catch {
        // Fall back to existing workflow object
      }

      // 2. Update environment at workflow level, actions level, and triggers level
      const updatedWorkflow: Record<string, unknown> = {
        ...fullWorkflow,
        environment: next.Name,
        actions: Array.isArray(fullWorkflow.actions)
          ? fullWorkflow.actions.map((act: Record<string, unknown>) => ({
              ...act,
              environment: next.Name,
            }))
          : fullWorkflow.actions,
        triggers: Array.isArray(fullWorkflow.triggers)
          ? fullWorkflow.triggers.map((trig: Record<string, unknown>) => ({
              ...trig,
              environment:
                next.Name.toLowerCase() === "cloud" &&
                (trig.environment === "cloud" ||
                  trig.trigger_type === "SCHEDULE")
                  ? "cloud"
                  : next.Name,
            }))
          : fullWorkflow.triggers,
      };

      // 3. Persist update
      const putRes = await fetch(
        getApiUrl(`/api/v1/workflows/${workflow.id}`),
        {
          method: "PUT",
          credentials: "include",
          headers: {
            ...getAuthHeader(),
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(updatedWorkflow),
        },
      );

      if (!putRes.ok) {
        throw new Error(`Server returned HTTP ${putRes.status}`);
      }

      const resJson = (await putRes.json().catch(() => null)) as {
        success?: boolean;
        reason?: string;
      } | null;
      if (resJson && resJson.success === false) {
        throw new Error(
          resJson.reason || "Failed to update workflow environment",
        );
      }

      setLocalEnvName(next.Name);
      toast.success(
        `Runtime location for "${workflow.name || "Workflow"}" updated to ${next.Name}`,
      );

      // Invalidate react-query cache for workflows so all views stay in sync
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      onUpdated?.(updatedWorkflow as unknown as WorkflowSummary, next.Name);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update runtime location for workflow",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ minWidth, maxWidth: 320 }}>
      <Autocomplete
        key={selectedEnv?.id ?? "none"}
        value={selectedEnv}
        loading={saving}
        disabled={disabled || saving}
        onChange={(_, newValue) => handleSelect(newValue)}
        options={environments}
        getOptionLabel={(option) => option?.Name || ""}
        getOptionDisabled={(option) =>
          option.archived === true || option.sensor_group === true
        }
        isOptionEqualToValue={(option, value) => option?.id === value?.id}
        size="small"
        disableClearable
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Select runtime location"
            slotProps={{
              input: {
                ...params.InputProps,
                startAdornment: selectedEnv ? (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      ml: 0.5,
                      mr: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    <TypeIcon env={selectedEnv} />
                    <RunningChip running={isRunning(selectedEnv)} />
                  </Box>
                ) : null,
                endAdornment: (
                  <>
                    {saving ? (
                      <CircularProgress
                        size={14}
                        sx={{ color: "hsl(var(--primary))" }}
                      />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "hsl(var(--card))",
                borderRadius: 1.5,
                fontSize: "0.8125rem",
                py: 0.25,
                "& fieldset": { borderColor: "hsl(var(--border))" },
                "&:hover fieldset": { borderColor: "hsl(var(--primary))" },
                "&.Mui-focused fieldset": {
                  borderColor: "hsl(var(--primary))",
                },
              },
              "& .MuiInputBase-input": {
                color: "hsl(var(--foreground))",
                fontWeight: 500,
                fontSize: "0.8125rem",
              },
            }}
          />
        )}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 1.5,
              mt: 0.5,
              minWidth: 280,
              maxHeight: 280,
              overflow: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              "& .MuiAutocomplete-listbox": { padding: 0, maxHeight: "none" },
            },
          },
        }}
        renderOption={(props, option) => {
          const { key, ...restProps } = props;
          const isCurrent = option.id === selectedEnv?.id;
          const isOrgDefault = !!option.default;
          return (
            <Box
              component="li"
              key={option.id}
              {...restProps}
              sx={{
                fontSize: "0.8125rem",
                color: isCurrent
                  ? "hsl(var(--primary))"
                  : "hsl(var(--foreground))",
                backgroundColor: isCurrent
                  ? "rgba(255, 102, 0, 0.1)"
                  : "hsl(var(--card))",
                py: 0.75,
                borderLeft: isCurrent
                  ? "2px solid hsl(var(--primary))"
                  : "2px solid transparent",
                "&:hover": {
                  backgroundColor: isCurrent
                    ? "rgba(255, 102, 0, 0.15) !important"
                    : "hsl(var(--muted)) !important",
                },
                "&.Mui-focused": {
                  backgroundColor: isCurrent
                    ? "rgba(255, 102, 0, 0.15) !important"
                    : "hsl(var(--muted)) !important",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  width: "100%",
                }}
              >
                <RunningChip running={isRunning(option)} />
                <TypeIcon env={option} />
                <Typography
                  noWrap
                  sx={{ fontSize: "0.8125rem", color: "inherit", flex: 1 }}
                >
                  {option.Name}
                </Typography>
                {isOrgDefault && (
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      color: "hsl(var(--muted-foreground))",
                      bgcolor: "hsl(var(--muted))",
                      px: 0.75,
                      py: 0.2,
                      borderRadius: 1,
                    }}
                  >
                    Default
                  </Typography>
                )}
                {(option.archived || option.sensor_group) && (
                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {option.archived ? "Archived" : "Sensor group"}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        }}
      />
      {isInherited && (
        <Typography
          variant="caption"
          sx={{
            fontSize: "0.6875rem",
            color: "hsl(var(--muted-foreground))",
            mt: 0.35,
            display: "block",
            pl: 0.5,
          }}
        >
          Inheriting tenant default ({selectedEnv?.Name || "Cloud"})
        </Typography>
      )}
    </Box>
  );
};

export default WorkflowEnvironmentSelector;
