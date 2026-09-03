import React from 'react';
import { OAuthAuthorizeView as CoreOAuthAuthorizeView, type OAuthAuthorizeViewProps } from '@/Shuffle-Core/components/oauth/OAuthAuthorizeView';
import { useAuth } from '@/context/AuthContext';

export const OAuthAuthorizeView: React.FC<Partial<OAuthAuthorizeViewProps>> = (props) => {
  const { userInfo, setActiveOrg, isLoading } = useAuth();
  const resolvedUserInfo = props.userInfo !== undefined ? props.userInfo : userInfo;

  return (
    <CoreOAuthAuthorizeView
      {...props}
      userInfo={(isLoading && !resolvedUserInfo ? undefined : resolvedUserInfo) as OAuthAuthorizeViewProps['userInfo']}
      activeOrg={(props.activeOrg || userInfo?.active_org) as OAuthAuthorizeViewProps['activeOrg']}
      onOrgChange={props.onOrgChange || setActiveOrg}
      isSupport={props.isSupport ?? userInfo?.support}
    />
  );
};

export default OAuthAuthorizeView;
