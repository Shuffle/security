import { useMemo } from 'react';
import { useWorkflows } from './useWorkflows';
import { CategoryConfig } from '@/services/datastore';
import { DATASTORE_CATEGORIES } from '@/services/datastore';

export interface EnrichmentStatusCheck {
  label: string;
  active: boolean;
}

export interface EnrichmentStatus {
  /** Overall: all three conditions are met */
  active: boolean;
  /** Individual check results */
  checks: EnrichmentStatusCheck[];
  /** Whether data is still loading (workflows) */
  isLoading: boolean;
}

const THREAT_FEEDS_WORKFLOW = 'Enable Threat feeds';
const IOC_EXTRACTION_WORKFLOW = 'Realtime IOC extraction';

/**
 * Check if automatic enrichment is fully active.
 *
 * Three conditions must ALL be true:
 * 1. A background_processing workflow named "Enable Threat feeds" exists
 * 2. A background_processing workflow named "Realtime IOC extraction" exists
 * 3. The "shuffle-security_incidents" category has the "Enrich" automation enabled
 *
 * @param categoryConfig - The CategoryConfig for shuffle-security_incidents (from useDatastore)
 */
export const useEnrichmentStatus = (
  categoryConfig: CategoryConfig | null | undefined,
): EnrichmentStatus => {
  const { data: workflows, isLoading } = useWorkflows();

  return useMemo(() => {
    const hasThreatFeeds = !!workflows?.some(
      (w) => w.name === THREAT_FEEDS_WORKFLOW && w.background_processing === true,
    );

    const hasIOCExtraction = !!workflows?.some(
      (w) => w.name === IOC_EXTRACTION_WORKFLOW && w.background_processing === true,
    );

    const automations = categoryConfig?.automations || [];
    const enrichAutomation = automations.find(
      (a) => a.type === 'enrich' || a.name === 'Enrich',
    );
    const hasEnrichEnabled = !!enrichAutomation?.enabled;

    const checks: EnrichmentStatusCheck[] = [
      { label: 'Threat feeds', active: hasThreatFeeds },
      { label: 'IOC extraction', active: hasIOCExtraction },
      { label: 'Enrich automation', active: hasEnrichEnabled },
    ];

    return {
      active: hasThreatFeeds && hasIOCExtraction && hasEnrichEnabled,
      checks,
      isLoading,
    };
  }, [workflows, categoryConfig, isLoading]);
};

/**
 * Standalone (non-hook) helper to check enrichment status from raw data.
 * Useful in contexts where hooks can't be called.
 */
export const checkEnrichmentStatus = (
  workflows: Array<{ name: string; background_processing?: boolean }>,
  categoryConfig: CategoryConfig | null | undefined,
): { active: boolean; checks: EnrichmentStatusCheck[] } => {
  const hasThreatFeeds = workflows.some(
    (w) => w.name === THREAT_FEEDS_WORKFLOW && w.background_processing === true,
  );
  const hasIOCExtraction = workflows.some(
    (w) => w.name === IOC_EXTRACTION_WORKFLOW && w.background_processing === true,
  );
  const automations = categoryConfig?.automations || [];
  const enrichAutomation = automations.find(
    (a) => a.type === 'enrich' || a.name === 'Enrich',
  );
  const hasEnrichEnabled = !!enrichAutomation?.enabled;

  const checks: EnrichmentStatusCheck[] = [
    { label: 'Threat feeds', active: hasThreatFeeds },
    { label: 'IOC extraction', active: hasIOCExtraction },
    { label: 'Enrich automation', active: hasEnrichEnabled },
  ];

  return {
    active: hasThreatFeeds && hasIOCExtraction && hasEnrichEnabled,
    checks,
  };
};
