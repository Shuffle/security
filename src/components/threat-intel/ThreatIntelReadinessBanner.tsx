/**
 * ThreatIntelReadinessBanner — the threat intelligence twin of the
 * Automation Readiness banner used on /incidents and /vulnerabilities.
 *
 * Uses the exact same singular `AutomationReadinessCard` component with
 * threat intel specific checks (feed ingestion, realtime extraction,
 * incident enrichment, and default IOC/feed catalogs).
 */
import React, { useState } from 'react';
import {
  useThreatIntelAutomationStatus,
  ThreatIntelAutomationStatus,
  ThreatIntelCheck,
} from '@/hooks/useThreatIntelAutomationStatus';
import { AutomationReadinessCard, ReadinessItem } from '@/components/common/AutomationReadinessCard';
import { UsecaseDrawer } from '@/Shuffle-Core';
import { API_CONFIG } from '@/Shuffle-MCPs/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export interface ThreatIntelReadinessBannerProps {
  status?: ThreatIntelAutomationStatus;
  onOpenUsecase?: (usecaseId: string) => void;
  atTop?: boolean;
}

export const ThreatIntelReadinessBanner: React.FC<ThreatIntelReadinessBannerProps> = ({
  status: external,
  onOpenUsecase,
  atTop,
}) => {
  const internal = useThreatIntelAutomationStatus();
  const status = external ?? internal;
  const { userInfo } = useAuth();
  const { resolvedTheme } = useTheme();
  const [internalDrawerId, setInternalDrawerId] = useState<string | null>(null);

  const handleOpenUsecase = (flowId: string) => {
    if (onOpenUsecase) {
      onOpenUsecase(flowId);
    } else {
      setInternalDrawerId(flowId);
    }
  };

  const items: ReadinessItem[] = status.checks.map((check: ThreatIntelCheck) => ({
    id: check.key,
    label: check.label,
    active: check.active,
    loading: status.isLoading,
    busy: check.busy,
    tooltip: check.tooltip,
    checks: check.parts,
    onEnable: check.enable,
    onDisable: check.disable,
    onOpenUsecase: check.usecaseId ? () => handleOpenUsecase(check.usecaseId!) : undefined,
  }));

  return (
    <>
      <AutomationReadinessCard
        title="Automation Readiness"
        items={items}
        allActive={status.allActive}
        isLoading={status.isLoading}
        isEnablingAll={status.isEnablingAll}
        onEnableAll={status.enableAll}
        enableAllLabel="Enable all"
        atTop={atTop}
      />
      <UsecaseDrawer
        open={!!internalDrawerId}
        onClose={() => setInternalDrawerId(null)}
        flowId={internalDrawerId}
        globalUrl={API_CONFIG.baseUrl}
        userdata={userInfo as any}
        isLoaded={true}
        isLoggedIn={!!userInfo}
        theme={resolvedTheme}
      />
    </>
  );
};

export default ThreatIntelReadinessBanner;
