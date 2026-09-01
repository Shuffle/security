/**
 * Host wrapper around the Shuffle-Core notification settings surface.
 * The component itself (and its sub-components/services) now lives in
 * src/Shuffle-Core/components/notifications/PagerNotificationSettings.tsx
 * so other products can embed it.
 */
import { PagerNotificationSettings as CorePagerNotificationSettings } from '@/Shuffle-Core/components/notifications/PagerNotificationSettings';
import { useAuth } from '@/context/AuthContext';

export const PagerNotificationSettings = () => {
  const { userInfo } = useAuth();
  return <CorePagerNotificationSettings userInfo={userInfo} />;
};

export default PagerNotificationSettings;
