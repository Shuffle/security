import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Divider,
  Chip,
  CircularProgress,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  IconButton,
  Tooltip,
  Collapse,
  Checkbox,
} from '@mui/material';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Bot,
  Terminal,
  Cpu,
  Layers,
  Lock,
  Zap,
  Building2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Bug,
  Key,
  RefreshCw,
  Globe,
  HelpCircle,
  LogIn,
  Sliders,
  Code2,
  UserCheck,
} from 'lucide-react';
import { getApiUrl, getAuthHeader } from '../../api';
import { toast } from '../../toast';

export interface OrganizationLike {
  id: string;
  name: string;
  image?: string;
  role?: string;
  creator_org?: string;
  region_url?: string;
  [key: string]: unknown;
}

export interface UserInfoLike {
  id?: string;
  username?: string;
  email?: string;
  support?: boolean;
  role?: string;
  active_org?: OrganizationLike;
  orgs?: OrganizationLike[];
  [key: string]: unknown;
}

export interface OAuthAuthorizeViewProps {
  userInfo?: UserInfoLike | null;
  activeOrg?: OrganizationLike | null;
  isSupport?: boolean;
  onAuthSuccess?: (code: string, redirectUrl?: string) => void;
  onAuthDeny?: (redirectUrl?: string) => void;
  onOrgChange?: (orgId: string) => Promise<void> | void;
  globalUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}

export interface OAuthScopeDetail {
  id: string;
  category: 'general' | 'app' | 'workflow' | 'incident' | 'mcp' | 'system';
  title: string;
  description: string;
  badge?: string;
}

// Predefined catalog of OAuth 2.0 / 2.1 scopes for Shuffle Applications and Integrations
const PREDEFINED_SCOPES: Record<string, OAuthScopeDetail> = {
  // Identity & Account Scopes
  'openid': {
    id: 'openid',
    category: 'general',
    title: 'Verify Identity (OpenID)',
    description: 'Verify your identity and unique user identifier in Shuffle.',
    badge: 'OpenID',
  },
  'profile': {
    id: 'profile',
    category: 'general',
    title: 'Access Basic Profile',
    description: 'Read your username, name, and active organization membership.',
    badge: 'Profile',
  },
  'email': {
    id: 'email',
    category: 'general',
    title: 'Read Email Address',
    description: 'Access the primary email address associated with your Shuffle user account.',
    badge: 'Email',
  },
  'offline_access': {
    id: 'offline_access',
    category: 'general',
    title: 'Maintain Offline Access',
    description: 'Maintain persistent access via refresh tokens while you are offline.',
    badge: 'Offline',
  },
  'read': {
    id: 'read',
    category: 'general',
    title: 'Read Platform Resources',
    description: 'Read configurations, assets, and platform resources in your organization.',
    badge: 'Read',
  },
  'write': {
    id: 'write',
    category: 'general',
    title: 'Modify Platform Resources',
    description: 'Create and update configurations, assets, and settings in your organization.',
    badge: 'Write',
  },
  'api:read': {
    id: 'api:read',
    category: 'general',
    title: 'API Read Access',
    description: 'Query Shuffle REST API endpoints and data stores on your behalf.',
    badge: 'API Read',
  },
  'api:write': {
    id: 'api:write',
    category: 'general',
    title: 'API Write Access',
    description: 'Perform mutations and submit data through Shuffle REST API endpoints.',
    badge: 'API Write',
  },

  // App & Integration Scopes
  'apps:read': {
    id: 'apps:read',
    category: 'app',
    title: 'Read App Integrations & Schemas',
    description: 'View connected third-party apps, OpenAPI specifications, and available action definitions.',
    badge: 'Apps Read',
  },
  'app:read': {
    id: 'app:read',
    category: 'app',
    title: 'Read App Integrations & Schemas',
    description: 'View connected third-party apps, OpenAPI specifications, and available action definitions.',
    badge: 'Apps Read',
  },
  'apps:execute': {
    id: 'apps:execute',
    category: 'app',
    title: 'Run Third-Party App Actions',
    description: 'Trigger authenticated actions across connected services (e.g., Jira, Slack, GitHub, Splunk, CrowdStrike).',
    badge: 'Apps Execute',
  },
  'app:execute': {
    id: 'app:execute',
    category: 'app',
    title: 'Run Third-Party App Actions',
    description: 'Trigger authenticated actions across connected services (e.g., Jira, Slack, GitHub, Splunk, CrowdStrike).',
    badge: 'Apps Execute',
  },
  'actions:run': {
    id: 'actions:run',
    category: 'app',
    title: 'Execute Integration Actions',
    description: 'Perform real-time actions and data queries against authorized third-party APIs.',
    badge: 'Actions Run',
  },

  // Workflow Scopes
  'workflows:read': {
    id: 'workflows:read',
    category: 'workflow',
    title: 'View Workflows & Automations',
    description: 'Access workflow structures, active triggers, and historical execution results.',
    badge: 'Workflows Read',
  },
  'workflow:read': {
    id: 'workflow:read',
    category: 'workflow',
    title: 'View Workflows & Automations',
    description: 'Access workflow structures, active triggers, and historical execution results.',
    badge: 'Workflows Read',
  },
  'workflows:run': {
    id: 'workflows:run',
    category: 'workflow',
    title: 'Trigger Autonomous Workflows',
    description: 'Execute and pass runtime arguments to Shuffle security workflows and playbooks.',
    badge: 'Workflows Run',
  },
  'workflows:execute': {
    id: 'workflows:execute',
    category: 'workflow',
    title: 'Trigger Autonomous Workflows',
    description: 'Execute and pass runtime arguments to Shuffle security workflows and playbooks.',
    badge: 'Workflows Run',
  },

  // Security Incident Scopes
  'incidents:read': {
    id: 'incidents:read',
    category: 'incident',
    title: 'Read Alerts & Incidents',
    description: 'Query security alerts, cases, observables, and threat intelligence context.',
    badge: 'Incidents Read',
  },
  'alerts:read': {
    id: 'alerts:read',
    category: 'incident',
    title: 'Read Security Alerts',
    description: 'View incoming security notifications, alert queues, and threat triage status.',
    badge: 'Alerts Read',
  },
  'incidents:write': {
    id: 'incidents:write',
    category: 'incident',
    title: 'Manage Incidents & Cases',
    description: 'Update case statuses, add analyst investigation notes, and attach IOC observables.',
    badge: 'Incidents Write',
  },

  // Model Context Protocol (MCP) Scopes
  'mcps:read': {
    id: 'mcps:read',
    category: 'mcp',
    title: 'Inspect MCP Tools & Prompts',
    description: 'Discover and inspect available Model Context Protocol (MCP) servers, tool definitions, and prompts.',
    badge: 'MCP Read',
  },
  'mcp:read': {
    id: 'mcp:read',
    category: 'mcp',
    title: 'Inspect MCP Tools & Prompts',
    description: 'Discover and inspect available Model Context Protocol (MCP) servers, tool definitions, and prompts.',
    badge: 'MCP Read',
  },
  'mcps:execute': {
    id: 'mcps:execute',
    category: 'mcp',
    title: 'Execute MCP Tools & Functions',
    description: 'Call and execute MCP tools, autonomous actions, and model context queries on your behalf.',
    badge: 'MCP Execute',
  },
  'mcp:execute': {
    id: 'mcp:execute',
    category: 'mcp',
    title: 'Execute MCP Tools & Functions',
    description: 'Call and execute MCP tools, autonomous actions, and model context queries on your behalf.',
    badge: 'MCP Execute',
  },
  'tools:call': {
    id: 'tools:call',
    category: 'mcp',
    title: 'Invoke Connected Tools',
    description: 'Run tool calls and function executions triggered by connected client applications.',
    badge: 'Tools Call',
  },
  'mcps:manage': {
    id: 'mcps:manage',
    category: 'mcp',
    title: 'Manage MCP Servers',
    description: 'Register, edit, or remove MCP server endpoints and configurations in your organization.',
    badge: 'MCP Admin',
  },
};

const DEFAULT_SCOPES = ['apps:read', 'workflows:read', 'incidents:read'];

// Dynamic scope parser for custom per-server/per-app tokens
const parseDynamicScope = (rawScope: string): OAuthScopeDetail => {
  const normalized = rawScope.trim().toLowerCase();
  if (PREDEFINED_SCOPES[normalized]) {
    return PREDEFINED_SCOPES[normalized];
  }

  if (normalized.startsWith('mcp:')) {
    const parts = normalized.split(':');
    const target = parts[1] ? parts[1].toUpperCase() : 'Custom';
    const action = parts[2] ? ` (${parts[2]})` : '';
    return {
      id: rawScope,
      category: 'mcp',
      title: `Access MCP: ${target}${action}`,
      description: `Use and execute tools provided by the ${target} MCP server connection.`,
      badge: `MCP: ${target}`,
    };
  }

  if (normalized.startsWith('app:')) {
    const parts = normalized.split(':');
    const target = parts[1] ? parts[1].toUpperCase() : 'App';
    const action = parts[2] ? parts[2] : 'execute';
    return {
      id: rawScope,
      category: 'app',
      title: `${action.toUpperCase()} on App: ${target}`,
      description: `Perform ${action} actions and API calls for the connected ${target} integration.`,
      badge: `App: ${target}`,
    };
  }

  const cleanTitle = rawScope
    .replace(/[:_\-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    id: rawScope,
    category: 'system',
    title: cleanTitle,
    description: `Grants the requesting application permission to "${rawScope}".`,
    badge: rawScope,
  };
};

interface ClientProfile {
  name: string;
  vendor: string;
  iconBg: string;
  iconColor: string;
  description: string;
}

/**
 * Client IDs like `shuffle_client_f9ffacb6-ce10-489e-ad7d-635de96932dd` are far
 * too long (and unidentifiable) to render as a title. Shorten to a readable label.
 */
const shortenClientId = (clientId?: string): string => {
  if (!clientId) return '';
  const stripped = clientId.replace(/^shuffle[_-]client[_-]/i, '');
  const uuidMatch = stripped.match(/^[0-9a-f]{8}/i);
  if (uuidMatch && stripped.length > 12) return `Application ${uuidMatch[0]}`;
  if (stripped.length > 24) return `${stripped.slice(0, 24)}…`;
  return stripped;
};

const getClientProfile = (clientId?: string, clientName?: string): ClientProfile => {
  const id = (clientId || '').toLowerCase();
  const name = (clientName || '').toLowerCase();

  if (id.includes('chatgpt') || name.includes('chatgpt') || id.includes('openai') || name.includes('openai')) {
    return {
      name: clientName || 'ChatGPT',
      vendor: 'OpenAI',
      iconBg: '#10A37F',
      iconColor: '#FFFFFF',
      description: 'OpenAI custom assistant & platform integration',
    };
  }

  if (id.includes('claude') || name.includes('claude') || id.includes('anthropic') || name.includes('anthropic')) {
    return {
      name: clientName || 'Claude',
      vendor: 'Anthropic',
      iconBg: '#D97706',
      iconColor: '#FFFFFF',
      description: 'Anthropic Claude assistant integration',
    };
  }

  if (id.includes('cursor') || name.includes('cursor')) {
    return {
      name: clientName || 'Cursor',
      vendor: 'Anysphere',
      iconBg: '#000000',
      iconColor: '#FFFFFF',
      description: 'Cursor IDE tool & context runner',
    };
  }

  if (id.includes('copilot') || name.includes('copilot') || id.includes('github') || name.includes('github')) {
    return {
      name: clientName || 'GitHub Copilot',
      vendor: 'GitHub / Microsoft',
      iconBg: '#24292F',
      iconColor: '#FFFFFF',
      description: 'GitHub Copilot Workspace integration',
    };
  }

  if (id.includes('vscode') || name.includes('vscode')) {
    return {
      name: clientName || 'VS Code Extension',
      vendor: 'Microsoft',
      iconBg: '#007ACC',
      iconColor: '#FFFFFF',
      description: 'Visual Studio Code extension integration',
    };
  }

  return {
    name: clientName || shortenClientId(clientId) || 'External Application',
    vendor: 'Third-Party Developer',
    iconBg: '#3B82F6',
    iconColor: '#FFFFFF',
    description: 'External application requesting permission to access your Shuffle organization.',
  };
};

/** Region flag/code from a region URL (mirrors the sidebar tenant selector). */
const getRegionFlag = (regionUrl?: string): { flag: string; code: string } => {
  if (!regionUrl) return { flag: '🇬🇧', code: 'UK' };
  const url = regionUrl.toLowerCase();
  if (url.includes('california') || url.includes('us.') || url.includes('us-')) return { flag: '🇺🇸', code: 'US' };
  if (url.includes('frankfurt') || url.includes('de.') || url.includes('de-')) return { flag: '🇪🇺', code: 'EU' };
  if (url.includes('eu-2') || url.includes('eu2')) return { flag: '🇪🇺', code: 'EU-2' };
  if (url.includes('eu.') || url.includes('eu-')) return { flag: '🇪🇺', code: 'EU' };
  if (url.includes('ca.') || url.includes('canada')) return { flag: '🇨🇦', code: 'CA' };
  if (url.includes('au.') || url.includes('aus') || url.includes('australia')) return { flag: '🇦🇺', code: 'AUS' };
  if (url.includes('uk.') || url.includes('uk-') || url.includes('london')) return { flag: '🇬🇧', code: 'UK' };
  return { flag: '🇬🇧', code: 'UK' };
};

/** Sort organizations into a parent → child hierarchy (mirrors the sidebar). */
const sortOrgsWithHierarchy = (orgs: OrganizationLike[]): Array<{ org: OrganizationLike; level: number }> => {
  const orgMap = new Map(orgs.map((org) => [org.id, org]));
  const result: Array<{ org: OrganizationLike; level: number }> = [];
  const processed = new Set<string>();

  const addOrgWithChildren = (org: OrganizationLike, level: number) => {
    if (processed.has(org.id)) return;
    processed.add(org.id);
    result.push({ org, level });
    const children = orgs.filter((o) => o.creator_org === org.id);
    children.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    children.forEach((child) => addOrgWithChildren(child, level + 1));
  };

  const rootOrgs = orgs.filter((org) => !org.creator_org || !orgMap.has(org.creator_org));
  rootOrgs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  rootOrgs.forEach((org) => addOrgWithChildren(org, 0));

  orgs.forEach((org) => {
    if (!processed.has(org.id)) result.push({ org, level: 1 });
  });

  return result;
};

const ShuffleVectorBadge = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none" style={{ display: 'inline-block', flexShrink: 0 }}>
    <path d="M14 14h28v6H20v16h16v-10h-8v-6h14v22H14V14z" fill="#FF6600" />
  </svg>
);

export const OAuthAuthorizeView: React.FC<OAuthAuthorizeViewProps> = ({
  userInfo: propUserInfo,
  activeOrg: propActiveOrg,
  isSupport: propIsSupport,
  onAuthSuccess,
  onAuthDeny,
  onOrgChange,
  className,
  style,
}) => {
  // Resolve local user info from localStorage if not provided via props
  const resolvedUserInfo = useMemo<UserInfoLike | null>(() => {
    if (propUserInfo !== undefined) return propUserInfo;
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('shuffle_user_info');
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  }, [propUserInfo]);

  // Read query parameters
  const queryParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const clientId = queryParams.get('client_id') || 'external-app';
  const clientNameParam = queryParams.get('client_name') || queryParams.get('app_name') || '';
  const redirectUri = queryParams.get('redirect_uri') || '';
  const scopeParam = queryParams.get('scope') || queryParams.get('scopes') || '';
  const state = queryParams.get('state') || '';
  const responseType = queryParams.get('response_type') || 'code';
  const codeChallenge = queryParams.get('code_challenge') || '';
  const codeChallengeMethod = queryParams.get('code_challenge_method') || 'S256';
  const prompt = queryParams.get('prompt') || '';
  const requestedOrgId = queryParams.get('org_id') || queryParams.get('org') || '';

  const clientProfile = useMemo(
    () => getClientProfile(clientId, clientNameParam),
    [clientId, clientNameParam],
  );

  // Parse scopes dynamically
  const scopes = useMemo<OAuthScopeDetail[]>(() => {
    const rawTokens = scopeParam
      ? scopeParam.split(/[\s,+]+/).map((s) => s.trim()).filter(Boolean)
      : DEFAULT_SCOPES;
    const uniqueTokens = Array.from(new Set(rawTokens));
    return uniqueTokens.map(parseDynamicScope);
  }, [scopeParam]);

  // Organization resolution
  const activeOrg = propActiveOrg || resolvedUserInfo?.active_org;
  const userOrgs = resolvedUserInfo?.orgs || (activeOrg ? [activeOrg] : []);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    requestedOrgId || activeOrg?.id || userOrgs[0]?.id || '',
  );

  useEffect(() => {
    if (requestedOrgId && userOrgs.some((o) => o.id === requestedOrgId)) {
      setSelectedOrgId(requestedOrgId);
    } else if (activeOrg?.id) {
      setSelectedOrgId(activeOrg.id);
    } else if (userOrgs[0]?.id) {
      setSelectedOrgId(userOrgs[0].id);
    }
  }, [activeOrg?.id, requestedOrgId, userOrgs]);

  // Support Mode detection
  const isSupportUser = Boolean(
    propIsSupport ||
    resolvedUserInfo?.support === true ||
    resolvedUserInfo?.role === 'admin' ||
    queryParams.get('debug') === 'true'
  );

  // Permissions selection state: All requested permissions are selected by default.
  // The user can hook off (uncheck) any permissions they do not wish to grant.
  const [selectedScopeIds, setSelectedScopeIds] = useState<Set<string>>(
    () => new Set(scopes.map((s) => s.id)),
  );

  // Re-sync default selection if scopes change
  useEffect(() => {
    setSelectedScopeIds(new Set(scopes.map((s) => s.id)));
  }, [scopes]);

  const handleToggleScope = useCallback((scopeId: string) => {
    setSelectedScopeIds((prev) => {
      const next = new Set(prev);
      if (next.has(scopeId)) {
        next.delete(scopeId);
      } else {
        next.add(scopeId);
      }
      return next;
    });
  }, []);

  const handleToggleAllScopes = useCallback(() => {
    setSelectedScopeIds((prev) => {
      if (prev.size === scopes.length) {
        return new Set();
      }
      return new Set(scopes.map((s) => s.id));
    });
  }, [scopes]);

  // States
  const [showDebug, setShowDebug] = useState<boolean>(queryParams.get('debug') === 'true');
  const [authorizing, setAuthorizing] = useState(false);
  const [denying, setDenying] = useState(false);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedDebug, setCopiedDebug] = useState(false);
  const [copiedSimulatedUrl, setCopiedSimulatedUrl] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Group scopes
  const groupedScopes = useMemo(() => {
    const groups: Record<string, { label: string; icon: React.ReactNode; items: OAuthScopeDetail[] }> = {
      general: { label: 'Account & Identity', icon: <UserCheck size={16} />, items: [] },
      app: { label: 'Applications & Integrations', icon: <Layers size={16} />, items: [] },
      workflow: { label: 'Workflows & Automation', icon: <Cpu size={16} />, items: [] },
      incident: { label: 'Security & Incidents', icon: <ShieldCheck size={16} />, items: [] },
      mcp: { label: 'Model Context Protocol (MCP)', icon: <Bot size={16} />, items: [] },
      system: { label: 'General Permissions', icon: <Lock size={16} />, items: [] },
    };

    scopes.forEach((scope) => {
      const cat = groups[scope.category] ? scope.category : 'system';
      groups[cat].items.push(scope);
    });

    return Object.values(groups).filter((g) => g.items.length > 0);
  }, [scopes]);

  // Extract redirect host
  const redirectHost = useMemo(() => {
    if (!redirectUri) return null;
    try {
      const parsed = new URL(redirectUri);
      return parsed.host || parsed.hostname;
    } catch {
      return redirectUri;
    }
  }, [redirectUri]);

  // In-place Org Switch Handler with URL sync
  const handleOrgSwitch = useCallback(
    async (newOrgId: string) => {
      setSelectedOrgId(newOrgId);
      if (onOrgChange) {
        try {
          await onOrgChange(newOrgId);
        } catch {}
      }

      // Update URL query parameter org_id while preserving all OAuth params
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('org_id', newOrgId);
        window.history.replaceState({}, '', url.toString());
      }
    },
    [onOrgChange],
  );

  // Save return target for unauthenticated users
  useEffect(() => {
    if (!resolvedUserInfo && typeof window !== 'undefined') {
      try {
        const currentPathAndQuery = window.location.pathname + window.location.search;
        sessionStorage.setItem('shuffle_redirect_after_login', currentPathAndQuery);
      } catch {}
    }
  }, [resolvedUserInfo]);

  // Unauthenticated Sign-in redirect
  const handleSignInRedirect = useCallback(() => {
    if (typeof window === 'undefined') return;
    const currentPathAndQuery = window.location.pathname + window.location.search;
    try {
      sessionStorage.setItem('shuffle_redirect_after_login', currentPathAndQuery);
    } catch {}
    window.location.href = `/login?redirect=${encodeURIComponent(currentPathAndQuery)}`;
  }, []);

  // Handle Approve Action
  const handleAuthorize = async () => {
    setErrorMsg(null);

    if (selectedScopeIds.size === 0) {
      setErrorMsg('Please select at least one permission to authorize.');
      return;
    }

    setAuthorizing(true);

    try {
      const generatedCode = `shf_auth_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(36) + Math.random().toString(36).substring(2)}`;
      const approvedScopeString = Array.from(selectedScopeIds).join(' ');

      // Backend authorization sync
      let response: Response;
      try {
        response = await fetch(getApiUrl('/api/v1/oauth2/authorize'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(selectedOrgId),
          },
          body: JSON.stringify({
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: approvedScopeString,
            state,
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
            org_id: selectedOrgId,
            decision: 'approved',
            auth_code: generatedCode,
          }),
        });
      } catch (networkErr: unknown) {
        const msg = networkErr instanceof Error ? networkErr.message : 'Server could not be reached';
        setErrorMsg(`Authorization failed: ${msg}. The backend authorization server could not be reached.`);
        setAuthorizing(false);
        return;
      }

      if (!response.ok) {
        let errMessage = '';
        try {
          const errData = await response.json();
          errMessage = errData?.message || errData?.error || errData?.reason || '';
        } catch {}

        if (!errMessage) {
          if (response.status === 404) {
            errMessage = 'OAuth authorization backend endpoint is not yet available (HTTP 404). Authorization cannot be completed.';
          } else if (response.status === 401 || response.status === 403) {
            errMessage = 'Authorization denied: Your current session does not have permission to approve this request.';
          } else {
            errMessage = `Authorization failed with status ${response.status} (${response.statusText || 'Server Error'}).`;
          }
        }

        setErrorMsg(errMessage);
        setAuthorizing(false);
        return;
      }

      let backendCode = generatedCode;
      try {
        const resData = await response.json();
        if (resData?.code || resData?.auth_code) {
          backendCode = resData.code || resData.auth_code;
        }
      } catch {}

      if (onAuthSuccess) {
        onAuthSuccess(backendCode, redirectUri);
      }

      if (redirectUri) {
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('code', backendCode);
        if (state) {
          callbackUrl.searchParams.set('state', state);
        }
        window.location.href = callbackUrl.toString();
        return;
      }

      setAuthCode(backendCode);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred during authorization');
    } finally {
      setAuthorizing(false);
    }
  };

  // Handle Deny / Cancel Action
  const handleDeny = () => {
    setDenying(true);
    if (onAuthDeny) {
      onAuthDeny(redirectUri);
    }

    if (redirectUri) {
      try {
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('error', 'access_denied');
        callbackUrl.searchParams.set(
          'error_description',
          'The user denied the authorization request',
        );
        if (state) {
          callbackUrl.searchParams.set('state', state);
        }
        window.location.href = callbackUrl.toString();
        return;
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  // Debug payload export
  const debugPayload = useMemo(() => {
    return {
      timestamp: new Date().toISOString(),
      oauth_protocol: 'OAuth 2.0 / 2.1',
      client: {
        id: clientId,
        name: clientProfile.name,
        vendor: clientProfile.vendor,
      },
      redirect_uri: redirectUri,
      parsed_redirect: redirectHost,
      response_type: responseType,
      state: state || '(none)',
      pkce: {
        code_challenge: codeChallenge || '(none - OAuth 2.1 recommended)',
        code_challenge_method: codeChallengeMethod,
        is_pkce_present: Boolean(codeChallenge),
      },
      prompt: prompt || '(default)',
      requested_org_id: requestedOrgId || '(none)',
      active_org_id: selectedOrgId,
      user: {
        username: resolvedUserInfo?.username,
        id: resolvedUserInfo?.id,
        role: resolvedUserInfo?.role,
        is_support: isSupportUser,
      },
      scopes: scopes.map((s) => ({
        scope: s.id,
        category: s.category,
        title: s.title,
      })),
      approved_scopes: Array.from(selectedScopeIds),
      raw_query_string: typeof window !== 'undefined' ? window.location.search : '',
    };
  }, [
    clientId,
    clientProfile,
    redirectUri,
    redirectHost,
    responseType,
    state,
    codeChallenge,
    codeChallengeMethod,
    prompt,
    requestedOrgId,
    selectedOrgId,
    resolvedUserInfo,
    isSupportUser,
    scopes,
    selectedScopeIds,
  ]);

  const simulatedCallbackUrl = useMemo(() => {
    if (!redirectUri) return '';
    try {
      const url = new URL(redirectUri);
      url.searchParams.set('code', 'shf_auth_simulated_debug_code_123');
      if (state) url.searchParams.set('state', state);
      return url.toString();
    } catch {
      return '';
    }
  }, [redirectUri, state]);

  const handleCopySimulatedUrl = useCallback(() => {
    if (!simulatedCallbackUrl) return;
    navigator.clipboard.writeText(simulatedCallbackUrl);
    setCopiedSimulatedUrl(true);
    setTimeout(() => setCopiedSimulatedUrl(false), 2000);
  }, [simulatedCallbackUrl]);

  const handleSimulateOAuthFlow = useCallback(() => {
    if (!simulatedCallbackUrl) return;
    window.open(simulatedCallbackUrl, '_blank', 'noopener,noreferrer');
  }, [simulatedCallbackUrl]);

  // 1. Unauthenticated State
  if (!resolvedUserInfo) {
    return (
      <Box
        className={className}
        style={style}
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'hsl(var(--background))',
          p: { xs: 2, sm: 3 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 480,
            p: 4,
            borderRadius: 4,
            border: '1px solid hsl(var(--border))',
            bgcolor: 'hsl(var(--card))',
            textAlign: 'center',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'hsl(var(--muted))',
              border: '1px solid hsl(var(--border))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <ShuffleVectorBadge size={32} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', mb: 1 }}>
            Sign In Required
          </Typography>

          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3 }}>
            <strong>{clientProfile.name}</strong> is requesting permission to access your Shuffle organization and resources. Please sign in to review and authorize.
          </Typography>

          <Button
            variant="contained"
            fullWidth
            startIcon={<LogIn size={18} />}
            onClick={handleSignInRedirect}
            sx={{
              py: 1.25,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              bgcolor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
            }}
          >
            Sign In to Continue
          </Button>
        </Paper>
      </Box>
    );
  }

  // 2. Success / Manual Code Display (if no redirect URI)
  if (authCode) {
    return (
      <Box
        className={className}
        style={style}
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'hsl(var(--background))',
          p: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 520,
            p: 4,
            borderRadius: 4,
            border: '1px solid hsl(var(--border))',
            bgcolor: 'hsl(var(--card))',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'rgba(34, 197, 94, 0.12)',
              color: '#22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <CheckCircle2 size={32} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', mb: 1 }}>
            Authorization Granted
          </Typography>

          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3 }}>
            <strong>{clientProfile.name}</strong> has been authorized to access your requested Shuffle resources.
          </Typography>

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'hsl(var(--muted))',
              border: '1px solid hsl(var(--border))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 3,
              textAlign: 'left',
            }}
          >
            <Box sx={{ overflow: 'hidden', mr: 1 }}>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                OAuth 2.1 Authorization Code
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                  wordBreak: 'break-all',
                }}
              >
                {authCode}
              </Typography>
            </Box>
            <IconButton
              onClick={() => {
                navigator.clipboard.writeText(authCode);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              size="small"
              sx={{ color: 'hsl(var(--foreground))' }}
            >
              {copiedCode ? <Check size={18} color="#22C55E" /> : <Copy size={18} />}
            </IconButton>
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              if (typeof window !== 'undefined') window.location.href = '/dashboard';
            }}
            sx={{
              py: 1.25,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
            }}
          >
            Return to Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  // 3. Main GitHub-Style Authorization Consent Screen
  return (
    <Box
      className={className}
      style={style}
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'hsl(var(--background))',
        p: { xs: 2, sm: 3 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 560,
          borderRadius: 4,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          overflow: 'hidden',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)',
        }}
      >
        {/* Top Visual Header: Client <-> Shuffle */}
        <Box
          sx={{
            p: 3,
            pb: 2.5,
            borderBottom: '1px solid hsl(var(--border))',
            bgcolor: 'hsl(var(--muted) / 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Support / Debug Toggle Pill */}
          {isSupportUser && (
            <Button
              size="small"
              variant={showDebug ? 'contained' : 'outlined'}
              startIcon={<Bug size={14} />}
              onClick={() => setShowDebug((prev) => !prev)}
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                fontSize: '0.75rem',
                textTransform: 'none',
                height: 26,
                px: 1.5,
                borderRadius: 999,
                ...(showDebug
                  ? { bgcolor: '#8B5CF6', color: '#FFFFFF', '&:hover': { bgcolor: '#7C3AED' } }
                  : { borderColor: '#8B5CF6', color: '#8B5CF6', '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)' } }),
              }}
            >
              Support Debug
            </Button>
          )}

          {/* Identity Bridge / Avatars */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 2 }}>
            <Avatar
              sx={{
                width: 52,
                height: 52,
                bgcolor: clientProfile.iconBg,
                color: clientProfile.iconColor,
                fontWeight: 700,
                fontSize: '1.2rem',
                border: '2px solid hsl(var(--border))',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {clientProfile.name.charAt(0).toUpperCase()}
            </Avatar>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              <Box sx={{ width: 16, height: 2, bgcolor: 'hsl(var(--border))' }} />
              <Box
                sx={{
                  p: 0.75,
                  borderRadius: '50%',
                  bgcolor: 'rgba(34, 197, 94, 0.15)',
                  color: '#22C55E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={14} />
              </Box>
              <Box sx={{ width: 16, height: 2, bgcolor: 'hsl(var(--border))' }} />
            </Box>

            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                bgcolor: 'hsl(var(--background))',
                border: '2px solid hsl(var(--border))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <ShuffleVectorBadge size={28} />
            </Box>
          </Box>

          <Typography variant="h6" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', mb: 0.5 }}>
            Authorize {clientProfile.name}
          </Typography>

          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
            <strong>{clientProfile.name}</strong> by <em>{clientProfile.vendor}</em> wants to access your Shuffle Security tools.
          </Typography>
        </Box>

        {/* Support Inspector Panel */}
        {isSupportUser && (
          <Collapse in={showDebug}>
            <Box
              sx={{
                p: 2.5,
                bgcolor: 'rgba(139, 92, 246, 0.05)',
                borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Terminal size={16} color="#8B5CF6" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
                    OAuth 2.0 / 2.1 Inspector (Support Mode)
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={copiedDebug ? <Check size={12} color="#22C55E" /> : <Copy size={12} />}
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2));
                      setCopiedDebug(true);
                      setTimeout(() => setCopiedDebug(false), 2000);
                    }}
                    sx={{
                      fontSize: '0.7rem',
                      height: 24,
                      textTransform: 'none',
                      borderColor: 'rgba(139, 92, 246, 0.4)',
                      color: '#8B5CF6',
                    }}
                  >
                    Copy JSON
                  </Button>
                  {simulatedCallbackUrl && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={copiedSimulatedUrl ? <Check size={12} color="#22C55E" /> : <ExternalLink size={12} />}
                      onClick={() => {
                        navigator.clipboard.writeText(simulatedCallbackUrl);
                        setCopiedSimulatedUrl(true);
                        setTimeout(() => setCopiedSimulatedUrl(false), 2000);
                      }}
                      sx={{
                        fontSize: '0.7rem',
                        height: 24,
                        textTransform: 'none',
                        borderColor: 'rgba(139, 92, 246, 0.4)',
                        color: '#8B5CF6',
                      }}
                    >
                      Copy Callback URL
                    </Button>
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
                <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                    Client ID / Name
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {clientId} ({clientProfile.name})
                  </Typography>
                </Box>

                <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                    Response Type
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {responseType}
                  </Typography>
                </Box>

                <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                    Redirect URI
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      wordBreak: 'break-all',
                      color: redirectUri ? 'hsl(var(--foreground))' : '#EF4444',
                    }}
                  >
                    {redirectUri || '(None provided - code will be displayed on screen)'}
                  </Typography>
                </Box>

                <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                    PKCE Code Challenge
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      wordBreak: 'break-all',
                      color: codeChallenge ? '#22C55E' : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {codeChallenge ? `${codeChallengeMethod}: ${codeChallenge.substring(0, 16)}...` : 'Not provided (Optional for web)'}
                  </Typography>
                </Box>
              </Box>

              {redirectUri && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>
                      Simulated Authorization Redirect URL
                    </Typography>
                    <Tooltip title={copiedSimulatedUrl ? 'Copied URL!' : 'Copy simulated redirect'}>
                      <IconButton size="small" onClick={handleCopySimulatedUrl}>
                        {copiedSimulatedUrl ? <Check size={14} color="#22C55E" /> : <Copy size={14} />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      display: 'block',
                      color: 'hsl(var(--muted-foreground))',
                      fontSize: '0.7rem',
                    }}
                  >
                    {simulatedCallbackUrl}
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSimulateOAuthFlow}
                  startIcon={<ExternalLink size={14} />}
                  sx={{
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    borderColor: '#8B5CF6',
                    color: '#8B5CF6',
                    '&:hover': { borderColor: '#7C3AED', bgcolor: 'rgba(139, 92, 246, 0.08)' },
                  }}
                >
                  Simulate Grant Flow
                </Button>
              </Box>
            </Box>
          </Collapse>
        )}

        {/* Content Body */}
        <Box sx={{ p: 3 }}>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.85rem' }}>
              {errorMsg}
            </Alert>
          )}

          {/* User Account & Organization Selection */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2.5,
              bgcolor: 'hsl(var(--muted) / 0.4)',
              border: '1px solid hsl(var(--border))',
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: userOrgs.length > 1 ? 1.5 : 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: '0.8rem',
                    bgcolor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                  }}
                >
                  {resolvedUserInfo?.username?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.2 }}>
                    {resolvedUserInfo?.username || 'Signed In User'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    {resolvedUserInfo?.email || 'Active Account'}
                  </Typography>
                </Box>
              </Box>

              <Chip
                size="small"
                icon={<Building2 size={12} />}
                label={userOrgs.find((o) => o.id === selectedOrgId)?.name || activeOrg?.name || 'Current Organization'}
                sx={{
                  bgcolor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              />
            </Box>

            {/* In-Place Organization Switcher */}
            {userOrgs.length > 1 && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid hsl(var(--border))' }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="core-org-select-label" sx={{ fontSize: '0.8rem' }}>
                    Authorize for Organization
                  </InputLabel>
                  <Select
                    labelId="core-org-select-label"
                    value={selectedOrgId}
                    label="Authorize for Organization"
                    onChange={(e) => handleOrgSwitch(e.target.value)}
                    sx={{ fontSize: '0.85rem' }}
                  >
                    {userOrgs.map((org) => (
                      <MenuItem key={org.id} value={org.id} sx={{ fontSize: '0.85rem' }}>
                        {org.name} {org.id === activeOrg?.id ? '(Active)' : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>

          {/* Requested Permissions (Interactive Scope Selection) */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography
                variant="caption"
                sx={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                  color: 'hsl(var(--muted-foreground))',
                }}
              >
                Requested Permissions ({selectedScopeIds.size} of {scopes.length} selected)
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={handleToggleAllScopes}
                sx={{
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  p: 0,
                  minWidth: 'auto',
                  color: 'hsl(var(--primary))',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                }}
              >
                {selectedScopeIds.size === scopes.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {groupedScopes.map((group) => (
                <Box key={group.label}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'hsl(var(--muted-foreground))' }}>
                    {group.icon}
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      {group.label}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      borderRadius: 2,
                      border: '1px solid hsl(var(--border))',
                      bgcolor: 'hsl(var(--background))',
                      overflow: 'hidden',
                    }}
                  >
                    {group.items.map((item, idx) => {
                      const isSelected = selectedScopeIds.has(item.id);
                      return (
                        <Box
                          key={item.id}
                          onClick={() => handleToggleScope(item.id)}
                          sx={{
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.5,
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'background-color 0.15s ease, opacity 0.15s ease',
                            borderBottom:
                              idx < group.items.length - 1 ? '1px solid hsl(var(--border))' : 'none',
                            bgcolor: isSelected ? 'transparent' : 'hsl(var(--muted) / 0.15)',
                            '&:hover': {
                              bgcolor: 'hsl(var(--muted) / 0.35)',
                            },
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggleScope(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            size="small"
                            sx={{
                              p: 0,
                              mt: 0.25,
                              color: 'hsl(var(--muted-foreground))',
                              '&.Mui-checked': {
                                color: 'hsl(var(--primary))',
                              },
                            }}
                          />
                          <Box sx={{ flexGrow: 1, minWidth: 0, opacity: isSelected ? 1 : 0.6 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.25 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 600,
                                  color: isSelected ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                                  textDecoration: isSelected ? 'none' : 'line-through',
                                }}
                              >
                                {item.title}
                              </Typography>
                              {item.badge && (
                                <Chip
                                  size="small"
                                  label={item.badge}
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    bgcolor: isSelected ? 'hsl(var(--muted))' : 'hsl(var(--muted) / 0.5)',
                                    color: 'hsl(var(--muted-foreground))',
                                  }}
                                />
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', lineHeight: 1.35 }}>
                              {item.description}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Security & Redirect Notice */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'hsl(var(--muted) / 0.3)',
              border: '1px solid hsl(var(--border))',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 3,
            }}
          >
            <ShieldCheck size={16} color="hsl(var(--primary))" />
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', flexGrow: 1 }}>
              {redirectHost ? (
                <>
                  Authorizing will redirect to <strong>{redirectHost}</strong>.
                </>
              ) : (
                'Standard OAuth 2.0 / 2.1 authorization request.'
              )}
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleDeny}
              disabled={authorizing || denying}
              sx={{
                py: 1.25,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                borderRadius: 2,
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--muted-foreground))',
                '&:hover': {
                  borderColor: '#EF4444',
                  color: '#EF4444',
                  bgcolor: 'rgba(239, 68, 68, 0.06)',
                },
              }}
            >
              {denying ? 'Canceling...' : 'Cancel'}
            </Button>

            <Button
              variant="contained"
              fullWidth
              onClick={handleAuthorize}
              disabled={authorizing || denying || selectedScopeIds.size === 0}
              sx={{
                py: 1.25,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                borderRadius: 2,
                bgcolor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
              }}
            >
              {authorizing ? (
                <CircularProgress size={20} sx={{ color: 'hsl(var(--primary-foreground))' }} />
              ) : selectedScopeIds.size === 0 ? (
                'Select permissions to authorize'
              ) : (
                `Authorize ${clientProfile.name}`
              )}
            </Button>
          </Box>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            py: 1.5,
            px: 3,
            bgcolor: 'hsl(var(--muted) / 0.2)',
            borderTop: '1px solid hsl(var(--border))',
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
            You can revoke access to this application at any time in your{' '}
            <strong>Shuffle Security Settings</strong>.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default OAuthAuthorizeView;
