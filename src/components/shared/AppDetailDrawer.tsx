import AppDetailDrawer from '@/Shuffle-MCPs/views/AppDetailDrawer';
import { useAppDetail } from '@/Shuffle-MCPs/AppDetailContext';

export const GlobalAppDetailDrawer = () => {
  const { currentAppName, isOpen, closeApp } = useAppDetail();
  return (
    <AppDetailDrawer
      open={isOpen}
      onClose={closeApp}
      appName={currentAppName}
    />
  );
};

export default AppDetailDrawer;
