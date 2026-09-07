/**
 * Host wrapper around the Shuffle-Core VulnerabilitiesDashboard — supplies
 * `orgId` from the host AuthContext (overridable via props), forwards
 * the host's resolved color scheme so charts follow light/dark mode,
 * and passes through all other dashboard props.
 */
import type { ComponentProps } from 'react';
import { API_CONFIG, VulnerabilitiesDashboard as CoreVulnerabilitiesDashboard } from '@/Shuffle-Core';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

type Props = ComponentProps<typeof CoreVulnerabilitiesDashboard>;

export const VulnerabilitiesDashboard = (props: Props) => {
  const { userInfo } = useAuth();
  const { resolvedTheme } = useTheme();
  return (
    <CoreVulnerabilitiesDashboard
      orgId={userInfo?.active_org?.id}
      globalUrl={API_CONFIG.baseUrl}
      theme={resolvedTheme}
      {...props}
    />
  );
};

export default VulnerabilitiesDashboard;
