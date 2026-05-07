import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';
import { useAssignEscalateStatus } from '@/hooks/useAssignEscalateStatus';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getDatastoreByCategory, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import { seedDefaultIOCTypes } from '@/hooks/useIOCTypes';
import { seedDefaultThreatFeeds } from '@/hooks/useThreatFeeds';
import { toast } from '@/lib/toast';

/**
 * Top-of-page status banner for /incidents that highlights whether the
 * critical automations are wired up:
 *  - Automatic Ingestion (webhook trigger)
 *  - Automatic Enrichment (threat feeds + IOC extraction + Enrich automation)
 *  - Assign & Escalate (background scheduler workflow)
 *  - Default config (IOC types + Threat feeds seeded in datastore)
 *
 * If any of these are missing, an "Enable all" button mirrors what the
 * onboarding/demo bootstrap does so the operator can fix everything in
 * one click. Admin-only.
 */
const STATUS_DISMISS_KEY = 'shuffle:automation-readiness-banner:dismissed-active';

interface StatusChipProps {
  label: string;
  active: boolean;
  loading?: boolean;
  tooltip?: string;
}

const StatusChip = ({ label, active, loading, tooltip }: StatusChipProps) => {
  const chip = (
    <Chip
      size="small"
      icon={
        loading ? (
          <CircularProgress size={12} sx={{ color: 'inherit !important', ml: '6px' }} />
        ) : active ? (
          <CheckCircleIcon sx={{ fontSize: 14, color: 'hsl(var(--severity-low)) !important' }} />
        ) : (
          <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: 'hsl(var(--muted-foreground)) !important' }} />
        )
      }
      label={label}
      sx={{
        height: 24,
        fontSize: '0.72rem',
        fontWeight: 500,
        bgcolor: active ? 'hsl(var(--severity-low) / 0.12)' : 'hsl(var(--muted))',
        color: active ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))',
        border: '1px solid',
        borderColor: active ? 'hsl(var(--severity-low) / 0.3)' : 'hsl(var(--border))',
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
  return tooltip ? <Tooltip title={tooltip} arrow>{chip}</Tooltip> : chip;
};

export const AutomationReadinessBanner = () => {
  const isAdmin = useIsAdmin();
  const webhook = useWebhookStatus();
  const enrichment = useEnrichmentStatus();
  const assign = useAssignEscalateStatus();

  const [defaultsReady, setDefaultsReady] = useState<boolean | null>(null);
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

  // Auto-hide once everything is active (sticky dismissed flag avoids flicker).
  if (allActive) {
    try { sessionStorage.setItem(STATUS_DISMISS_KEY, '1'); } catch { /* ignore */ }
    return null;
  }

  return (
    <Alert
      severity="warning"
      icon={false}
      sx={{
        mb: 2,
        py: 1,
        bgcolor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        color: 'hsl(var(--foreground))',
        '& .MuiAlert-message': { width: '100%', p: 0 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mr: 0.5 }}>
          Automation Readiness
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <StatusChip
            label="Ingestion Webhook"
            active={webhook.enabled}
            loading={webhook.isLoading}
            tooltip="Pushes alerts directly into incidents via webhook URL"
          />
          <StatusChip
            label="Automatic Enrichment"
            active={enrichment.active}
            loading={enrichment.isLoading}
            tooltip="Threat feeds + IOC extraction + Enrich automation"
          />
          <StatusChip
            label="Assign & Escalate"
            active={assign.active}
            loading={assign.isLoading}
            tooltip="Routes incidents to the on-call analyst and escalates"
          />
          <StatusChip
            label="Default config"
            active={defaultsReady === true}
            loading={defaultsReady === null}
            tooltip="Default IOC types and threat feeds seeded in datastore"
          />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          startIcon={enablingAll ? <CircularProgress size={14} color="inherit" /> : <RocketLaunchIcon sx={{ fontSize: 16 }} />}
          disabled={enablingAll || isLoading}
          onClick={handleEnableAll}
          sx={{
            height: 30,
            textTransform: 'none',
            fontSize: '0.78rem',
            fontWeight: 600,
            bgcolor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
          }}
        >
          {enablingAll ? 'Enabling…' : 'Enable all'}
        </Button>
      </Box>
    </Alert>
  );
};

export default AutomationReadinessBanner;
