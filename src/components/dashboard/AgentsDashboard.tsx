/**
 * Host wrapper around the Shuffle-Core AgentsDashboard — supplies
 * `orgId` from the host AuthContext (overridable via props), forwards
 * the host's resolved color scheme so charts follow light/dark mode,
 * and passes through all other dashboard props.
 */
import type { ComponentProps } from 'react';
import { API_CONFIG, AgentsDashboard as CoreAgentsDashboard } from '@/Shuffle-Core';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

type Props = ComponentProps<typeof CoreAgentsDashboard>;

export const AgentsDashboard = (props: Props) => {
  const { userInfo } = useAuth();
  const { resolvedTheme } = useTheme();
  return (
    <CoreAgentsDashboard
      orgId={userInfo?.active_org?.id}
      globalUrl={API_CONFIG.baseUrl}
      theme={resolvedTheme}
      {...props}
    />
  );
};

export default AgentsDashboard;
