/**
 * GlobalAgentDrawer — single instance of the Agent drawer mounted in the
 * dashboard layout so any page can open it via `openAgentDrawer(tab)`.
 *
 * Also handles the legacy `?openPermissions=1` query param for backwards
 * compatibility with existing deep links.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@/lib/router-compat';
import {
  AskAiWidget,
  API_CONFIG,
  isAgentRoute,
  type AgentRunDrawerTab,
  type AgentUIProps,
} from '@/Shuffle-MCPs';
import PermissionsPanel from '@/components/agent/PermissionsPanel';
import LocalLLMConfig from '@/components/agent/LocalLLMConfig';
import { useTheme } from '@/context/ThemeContext';
import {
  AGENT_DRAWER_OPEN_EVENT,
  type AgentDrawerOpenDetail,
} from '@/lib/agentDrawer';
import { useScheduleAgentRun } from '@/hooks/useScheduleAgentRun';
import { useIsSupport } from '@/hooks/useIsSupport';

const GlobalAgentDrawer = () => {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<AgentRunDrawerTab>('run');
  const location = useLocation();
  const navigate = useNavigate();
  const scheduleAgentRun = useScheduleAgentRun();
  const isSupport = useIsSupport();
  // Pass the already-resolved theme ('light' | 'dark') rather than 'system'.
  // The MCP library's 'auto' mode re-detects via DOM ancestors and can pick
  // up an unrelated scope, which made the Choose LLM drawer render light.
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme;

  const handleSchedule = useCallback<NonNullable<AgentUIProps['onSchedule']>>(
    async (info) => {
      await scheduleAgentRun(info);
    },
    [scheduleAgentRun],
  );

  const isAgentDisabled = isAgentRoute(location.pathname);

  useEffect(() => {
    const handler = (e: Event) => {
      if (isAgentDisabled) return;
      const detail = (e as CustomEvent<AgentDrawerOpenDetail>).detail;
      setInitialTab((detail?.tab ?? 'run') as AgentRunDrawerTab);
      setOpen(true);
    };
    window.addEventListener(AGENT_DRAWER_OPEN_EVENT, handler);
    return () => window.removeEventListener(AGENT_DRAWER_OPEN_EVENT, handler);
  }, [isAgentDisabled]);

  // Auto-close if user navigates to /agents or /agent
  useEffect(() => {
    if (isAgentDisabled && open) {
      setOpen(false);
    }
  }, [isAgentDisabled, open]);

  // Legacy: ?openPermissions=1 still works from any non-agent page.
  useEffect(() => {
    if (isAgentDisabled) return;
    const params = new URLSearchParams(location.search);
    if (params.get('openPermissions') === '1') {
      setInitialTab('permissions');
      setOpen(true);
      params.delete('openPermissions');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params}` : '' },
        { replace: true },
      );
    }
  }, [isAgentDisabled, location.search, location.pathname, navigate]);

  return (
    <AskAiWidget
      open={open}
      onOpenChange={setOpen}
      isSupport={isSupport}
      requireSupport={true}
      initialTab={initialTab}
      pathname={location.pathname}
      search={location.search}
      globalUrl={API_CONFIG.baseUrl}
      theme={theme}
      permissionsSlot={open ? <PermissionsPanel compact /> : undefined}
      localLLMSlot={open ? <LocalLLMConfig globalUrl={API_CONFIG.baseUrl} /> : undefined}
      agentUIProps={{ onSchedule: handleSchedule, apiBaseUrl: API_CONFIG.baseUrl, theme }}
    />
  );
};

export default GlobalAgentDrawer;
