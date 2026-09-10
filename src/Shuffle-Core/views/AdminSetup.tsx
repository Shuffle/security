import React from 'react';
import { LoginPage, LoginPageProps } from './LoginPage';

export interface AdminSetupProps extends Omit<LoginPageProps, 'mode'> {
  globalUrl?: string;
  loginPath?: string;
  onSuccess?: () => void;
}

export const AdminSetup: React.FC<AdminSetupProps> = ({
  globalUrl,
  loginPath,
  onSuccess,
  ...rest
}) => {
  return (
    <LoginPage
      {...rest}
      mode="adminsetup"
      defaultDestination={loginPath}
      onLoginSuccess={onSuccess ? () => onSuccess() : undefined}
    />
  );
};

export default AdminSetup;
