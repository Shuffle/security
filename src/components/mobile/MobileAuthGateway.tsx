import React from 'react';
import { LoginPage } from '@/Shuffle-Core';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

export interface MobileAuthGatewayProps {
  mode?: 'login' | 'register' | 'adminsetup';
  adminSetupPath?: string;
  defaultDestination?: string;
  onLoginSuccess?: (token: string, userInfo?: any) => void | Promise<void>;
  onAdminSetupRedirect?: (path: string) => void;
}

export const MobileAuthGateway: React.FC<MobileAuthGatewayProps> = ({
  mode = 'login',
  adminSetupPath = '/adminsetup',
  defaultDestination,
  onLoginSuccess,
  onAdminSetupRedirect,
}) => {
  return (
    <LoginPage
      product="security"
      productName="Shuffle Security"
      productSubtitle="Open Source Incident Response & Automation"
      mode={mode}
      adminSetupPath={adminSetupPath}
      defaultDestination={defaultDestination}
      onLoginSuccess={onLoginSuccess}
      onAdminSetupRedirect={onAdminSetupRedirect}
      header={<LandingNavbar />}
    />
  );
};

export default MobileAuthGateway;
