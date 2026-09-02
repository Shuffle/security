import React from 'react';
import { OAuthAuthorizeView as CoreOAuthAuthorizeView, type OAuthAuthorizeViewProps } from '@/Shuffle-Core/components/oauth/OAuthAuthorizeView';
import { useAuth } from '@/context/AuthContext';

export const OAuthAuthorizeView: React.FC<Partial<OAuthAuthorizeViewProps>> = (props) => {
  const { userInfo, setActiveOrg } = useAuth();

  return (
    <CoreOAuthAuthorizeView
      userInfo={props.userInfo || userInfo}
      activeOrg={props.activeOrg || userInfo?.active_org}
      onOrgChange={props.onOrgChange || setActiveOrg}
      isSupport={props.isSupport ?? userInfo?.support}
      {...props}
    />
  );
};

export default OAuthAuthorizeView;
