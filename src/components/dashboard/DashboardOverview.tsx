/**
 * Host wrapper around the Shuffle-Core DashboardOverview — forwards the
 * host's resolved color scheme so the charts honor light/dark mode instead
 * of falling back to the library default ("dark").
 */
import type { ComponentProps } from 'react';
import { API_CONFIG, DashboardOverview as CoreDashboardOverview } from '@/Shuffle-Core';
import { useTheme } from '@/context/ThemeContext';

type Props = ComponentProps<typeof CoreDashboardOverview>;

export const DashboardOverview = (props: Props) => {
  const { resolvedTheme } = useTheme();
  return <CoreDashboardOverview globalUrl={API_CONFIG.baseUrl} theme={resolvedTheme} {...props} />;
};

export default DashboardOverview;
