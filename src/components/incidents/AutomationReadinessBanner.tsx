import { CheckCircle2 as CheckCircleIcon, Circle as RadioButtonUncheckedIcon, XCircle as XCircleIcon, Zap as BoltIcon, Power as PowerSettingsNewIcon, Rocket as RocketLaunchIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';
import { useAssignEscalateStatus } from '@/hooks/useAssignEscalateStatus';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getDatastoreByCategory, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import { seedDefaultIOCTypes } from '@/hooks/useIOCTypes';
import { seedDefaultThreatFeeds } from '@/hooks/useThreatFeeds';
import { toast } from '@/lib/toast';
import { UsecaseDrawer } from '@/Shuffle-Core';
import { API_CONFIG } from '@/Shuffle-MCPs/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

/**
 * Compact automation readiness panel — sits underneath the trend charts in the
 * right-hand column on /incidents. Each row shows status and inline
 * Enable/Disable actions; "Enable all" wires up everything in one click.
 */
interface RowCheck {
  label: string;
  active: boolean;
  detail?: string;
}

interface RowProps {
  label: string;
  active: boolean;
  loading?: boolean;
  busy?: boolean;
  tooltip?: string;
  /** Sub-parts required for this row, surfaced in the tooltip. */
  checks?: RowCheck[];
  onEnable?: () => void;
  onDisable?: () => void;
  /** When set, clicking the label opens the matching usecase drawer. */
  onOpenUsecase?: () => void;
}

const Row = ({ label, active, loading, busy, tooltip, checks, onEnable, onDisable, onOpenUsecase }: RowProps) => {
  const icon = loading ? (
    <CircularProgress size={12} sx={{ color: 'hsl(var(--muted-foreground))' }} />
  ) : active ? (
    <CheckCircleIcon size={14} style={{ color: 'hsl(var(--severity-low))' }} />
  ) : (
    <RadioButtonUncheckedIcon size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
  );

  const missingCount = (checks || []).filter((c) => !c.active).length;

  const tooltipContent = (tooltip || checks?.length || onOpenUsecase) ? (
    <Box sx={{ py: 0.25 }}>
      {tooltip && (
        <Typography sx={{ fontSize: '0.72rem', color: 'inherit' }}>{tooltip}</Typography>
      )}
      {!loading && !!checks?.length && (
        <Box sx={{ mt: tooltip ? 0.75 : 0 }}>
          <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.75 }}>
            {missingCount > 0 ? `${missingCount} of ${checks.length} parts missing` : 'All parts configured'}
          </Typography>
          {checks.map((c) => (
            <Box key={c.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 0.4 }}>
              {c.active ? (
                <CheckCircleIcon size={12} style={{ color: 'hsl(var(--severity-low))', marginTop: 2, flexShrink: 0 }} />
              ) : (
                <XCircleIcon size={12} style={{ color: 'hsl(var(--destructive))', marginTop: 2, flexShrink: 0 }} />
              )}
              <Box>
                <Typography sx={{ fontSize: '0.72rem', color: 'inherit', opacity: c.active ? 0.8 : 1, fontWeight: c.active ? 400 : 600 }}>
                  {c.label}
                </Typography>
                {!c.active && c.detail && (
                  <Typography sx={{ fontSize: '0.66rem', opacity: 0.75, mt: 0.1 }}>{c.detail}</Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {onOpenUsecase && (
        <Typography sx={{ fontSize: '0.66rem', opacity: 0.7, mt: 0.75 }}>Click to open usecase</Typography>
      )}
    </Box>
  ) : '';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      {icon}
      <Tooltip
        title={tooltipContent}
        arrow
        placement="left"
        disableHoverListener={!tooltipContent}
        componentsProps={{ tooltip: { sx: { maxWidth: 340 } } }}
      >

        <Typography
          variant="body2"
          onClick={onOpenUsecase}
          sx={{
            flex: 1,
            fontSize: '0.78rem',
            color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
            cursor: onOpenUsecase ? 'pointer' : 'default',
            '&:hover': onOpenUsecase ? { color: 'hsl(var(--primary))', textDecoration: 'underline' } : undefined,
          }}
        >
          {label}
        </Typography>
      </Tooltip>

      {!loading && active && onDisable && (
        <Tooltip title={`Disable ${label}`} arrow>
          <span>
            <IconButton
              size="small"
              disabled={busy}
              onClick={onDisable}
              sx={{
                width: 22,
                height: 22,
                color: 'hsl(var(--muted-foreground))',
                '&:hover': { bgcolor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' },
              }}
            >
              {busy ? <CircularProgress size={12} /> : <PowerSettingsNewIcon size={14} />}
            </IconButton>
          </span>
        </Tooltip>
      )}
      {!loading && !active && onEnable && (
        <Tooltip title={`Enable ${label}`} arrow>
          <span>
            <IconButton
              size="small"
              disabled={busy}
              onClick={onEnable}
              sx={{
                width: 22,
                height: 22,
                color: 'hsl(var(--primary))',
                '&:hover': { bgcolor: 'hsl(var(--primary) / 0.1)' },
              }}
            >
              {busy ? <CircularProgress size={12} /> : <BoltIcon size={14} />}
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
};

interface AutomationReadinessBannerProps {
  /** Notifies the parent when nothing at all is configured yet (0/4 active). */
  onEmptyChange?: (empty: boolean) => void;
  /** Rendered at the top of the column as a focus item instead of inline. */
  atTop?: boolean;
}

export const AutomationReadinessBanner = ({ onEmptyChange, atTop }: AutomationReadinessBannerProps = {}) => {
  const isAdmin = useIsAdmin();
  const webhook = useWebhookStatus();
  const enrichment = useEnrichmentStatus();
  const assign = useAssignEscalateStatus();
  const { userInfo } = useAuth();
  const { resolvedTheme } = useTheme();
  const [usecaseId, setUsecaseId] = useState<string | null>(null);


  const [defaultsReady, setDefaultsReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [enablingAll, setEnablingAll] = useState(false);

  const checkDefaults = useCallback(async () => {
    try {
      const [iocs, feeds] = await Promise.all([
        getDatastoreByCategory(DATASTORE_CATEGORIES.IOCS),
        getDatastoreByCategory(DATASTORE_CATEGORIES.THREAT_FEEDS),
      ]);
      const ok = !!(iocs.success && (iocs.data?.length || 0) > 0
        && feeds.success && (feeds.data?.length || 0) > 0);
      setDefaultsReady(ok);
    } catch {
      setDefaultsReady(null);
    }
  }, []);

  useEffect(() => { if (isAdmin) checkDefaults(); }, [isAdmin, checkDefaults]);

  const allActive = useMemo(() =>
    webhook.enabled && enrichment.active && assign.active && defaultsReady === true,
  [webhook.enabled, enrichment.active, assign.active, defaultsReady]);

  const isLoading = webhook.isLoading || enrichment.isLoading || assign.isLoading || defaultsReady === null;

  // "Empty" = nothing configured at all, once every check has resolved.
  const isEmpty = !isLoading
    && !webhook.enabled && !enrichment.active && !assign.active && defaultsReady !== true;

  // Only report once every check has resolved, so the parent never latches a
  // position based on a still-loading state.
  useEffect(() => {
    if (isLoading) return;
    onEmptyChange?.(isAdmin && isEmpty);
  }, [onEmptyChange, isAdmin, isEmpty, isLoading]);

  const wrap = useCallback(async (key: string, fn: () => Promise<unknown>, verb: 'Enabled' | 'Disabled') => {
    setBusy(key);
    try {
      await fn();
      toast.success(`${verb}: ${key}`);
    } catch (err) {
      console.error('[automation-readiness]', verb.toLowerCase(), 'failed', key, err);
      toast.error(`Failed to ${verb.toLowerCase().replace(/d$/, '')} ${key}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const handleEnableAll = useCallback(async () => {
    setEnablingAll(true);
    try {
      const tasks: Promise<unknown>[] = [];
      if (defaultsReady !== true) {
        tasks.push(seedDefaultIOCTypes());
        tasks.push(seedDefaultThreatFeeds());
      }
      if (!enrichment.active) tasks.push(enrichment.enable());
      if (!assign.active) tasks.push(assign.enable());
      if (!webhook.enabled) tasks.push(webhook.enable());
      await Promise.allSettled(tasks);
      await checkDefaults();
      toast.success('All critical automations enabled');
    } catch (err) {
      console.error('[automation-readiness] enable all failed', err);
      toast.error('Failed to enable some automations');
    } finally {
      setEnablingAll(false);
    }
  }, [defaultsReady, enrichment, assign, webhook, checkDefaults]);

  if (!isAdmin) return null;

  const enabledCount =
    (webhook.enabled ? 1 : 0) +
    (enrichment.active ? 1 : 0) +
    (assign.active ? 1 : 0) +
    (defaultsReady === true ? 1 : 0);

  return (
    <Box
      sx={{
        mt: atTop ? 0 : 2,
        mb: atTop ? 2 : 0,
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'transparent',
        border: '1px solid',
        borderColor: atTop ? 'hsl(var(--primary) / 0.5)' : 'hsl(var(--border))',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem' }}>
          Automation Readiness
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: allActive ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))' }}>
          {enabledCount}/4 active
        </Typography>
      </Box>
      <Row
        label="Ingestion"
        active={webhook.enabled}
        loading={webhook.isLoading}
        busy={busy === 'Ingestion'}
        tooltip="Pushes alerts directly into incidents via webhook URL"
        onEnable={() => wrap('Ingestion', () => webhook.enable(), 'Enabled')}
        onDisable={() => wrap('Ingestion', () => webhook.disable(), 'Disabled')}
        onOpenUsecase={() => setUsecaseId('siem_case_management_1')}
      />
      <Row
        label="Enrichment"
        active={enrichment.active}
        loading={enrichment.isLoading}
        busy={busy === 'Enrichment'}
        tooltip="Threat feeds + IOC extraction + Enrich automation"
        onEnable={() => wrap('Enrichment', () => enrichment.enable(), 'Enabled')}
        onDisable={() => wrap('Enrichment', () => enrichment.disable(), 'Disabled')}
        onOpenUsecase={() => setUsecaseId('threat_intel_case_management_1')}
      />
      <Row
        label="Assign & Escalate"
        active={assign.active}
        loading={assign.isLoading}
        busy={busy === 'Assign & Escalate'}
        tooltip="Routes incidents to the on-call analyst and escalates"
        onEnable={() => wrap('Assign & Escalate', () => assign.enable(), 'Enabled')}
        onDisable={() => wrap('Assign & Escalate', () => assign.disable(), 'Disabled')}
        onOpenUsecase={() => setUsecaseId('case_management_assign_escalate_1')}
      />

      <Row
        label="Default config"
        active={defaultsReady === true}
        loading={defaultsReady === null}
        busy={busy === 'Default config'}
        tooltip="Default IOC types and threat feeds seeded in datastore"
        onEnable={() => wrap('Default config', async () => {
          await Promise.allSettled([seedDefaultIOCTypes(), seedDefaultThreatFeeds()]);
          await checkDefaults();
        }, 'Enabled')}
      />
      {!allActive && (
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={enablingAll ? <CircularProgress size={12} color="inherit" /> : <RocketLaunchIcon size={14} />}
          disabled={enablingAll || isLoading}
          onClick={handleEnableAll}
          sx={{
            mt: 1,
            height: 28,
            textTransform: 'none',
            fontSize: '0.72rem',
            fontWeight: 600,
            borderColor: 'hsl(var(--primary) / 0.5)',
            color: 'hsl(var(--primary))',
            '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.08)' },
          }}
        >
          {enablingAll ? 'Enabling…' : 'Enable all'}
        </Button>
      )}
      <UsecaseDrawer
        open={!!usecaseId}
        onClose={() => setUsecaseId(null)}
        flowId={usecaseId}
        globalUrl={API_CONFIG.baseUrl}
        userdata={userInfo as any}
        isLoaded={true}
        isLoggedIn={!!userInfo}
        theme={resolvedTheme}
      />
    </Box>

  );
};

export default AutomationReadinessBanner;
