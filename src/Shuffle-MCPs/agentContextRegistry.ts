/**
 * agentContextRegistry — Extensible context awareness engine for Shuffle-MCPs.
 *
 * Maps application routes / locations to the appropriate MCP apps, agent skills/presets,
 * and contextual prompt seeds. Also manages per-page user choice persistence so any
 * manual tool or preset customization is remembered for that specific page.
 *
 * Self-contained: No host-app `@/` imports.
 */

export interface AgentContextApp {
  name: string;
  id?: string;
  icon?: string;
}

export interface AgentContextRule {
  /** Unique identifier for the rule (e.g. 'incident-detail', 'incidents-list') */
  id: string;
  /**
   * Route pattern string with ':param' tokens (e.g. '/incidents/:id', '/vulnerabilities'),
   * a RegExp, or a custom matching function.
   */
  match:
    | string
    | RegExp
    | ((pathname: string, searchParams: URLSearchParams) => boolean | Record<string, string> | null);
  /** Default MCP apps to pre-select for this context */
  defaultApps: AgentContextApp[];
  /** Default skill/preset id (e.g. 'incident-response', 'vulnerability', 'build-workflows') */
  defaultPresetId?: string;
  /** Title shown on drawer header */
  title?: string | ((params: Record<string, string>, pathname: string) => string);
  /** Subtitle or context description shown under the drawer header */
  subtitle?: string | ((params: Record<string, string>, pathname: string) => string);
  /** Contextual prompt seed */
  defaultPrompt?: string | ((params: Record<string, string>, pathname: string) => string);
  /** Custom placeholder for the prompt input */
  placeholder?: string;
  /** Key used for localStorage persistence. Defaults to the rule id or parameterized key */
  getStorageKey?: (params: Record<string, string>, pathname: string) => string;
  /** Human-readable description of what this context provides */
  description?: string;
}

export interface AgentResolvedContext {
  ruleId: string;
  apps: AgentContextApp[];
  presetId?: string;
  title: string;
  subtitle: string;
  defaultPrompt: string;
  placeholder?: string;
  storageKey: string;
  params: Record<string, string>;
  pathname: string;
  /** True when the active apps or preset come from the user's saved overrides rather than rule defaults */
  isOverridden: boolean;
  /** The default apps before any user customization */
  originalDefaultApps: AgentContextApp[];
  /** The default preset before any user customization */
  originalDefaultPresetId?: string;
}

export interface PageContextChoice {
  apps?: AgentContextApp[];
  presetId?: string | null;
  updatedAt: number;
}

const STORAGE_PREFIX = 'shuffle_agent_context_choice_';

/** Match a URL pathname against a route pattern with `:param` segments */
export const matchRoutePattern = (pattern: string, pathname: string): Record<string, string> | null => {
  const normPattern = pattern.replace(/\/+$/, '') || '/';
  const normPath = pathname.replace(/\/+$/, '') || '/';

  // Exact match
  if (normPattern === normPath) return {};

  const patternSegments = normPattern.split('/');
  const pathSegments = normPath.split('/');

  if (patternSegments.length !== pathSegments.length) {
    // Check for wildcard /* at the end
    if (patternSegments[patternSegments.length - 1] === '*' && pathSegments.length >= patternSegments.length - 1) {
      const params: Record<string, string> = {};
      for (let i = 0; i < patternSegments.length - 1; i++) {
        if (patternSegments[i].startsWith(':')) {
          params[patternSegments[i].slice(1)] = decodeURIComponent(pathSegments[i]);
        } else if (patternSegments[i] !== pathSegments[i]) {
          return null;
        }
      }
      params['*'] = pathSegments.slice(patternSegments.length - 1).join('/');
      return params;
    }
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const pSeg = patternSegments[i];
    const uSeg = pathSegments[i];
    if (pSeg.startsWith(':')) {
      params[pSeg.slice(1)] = decodeURIComponent(uSeg);
    } else if (pSeg !== uSeg) {
      return null;
    }
  }

  return params;
};

/**
 * Built-in context rules for Shuffle.
 * Most specific rules are defined first.
 */
export const DEFAULT_AGENT_CONTEXT_RULES: AgentContextRule[] = [
  // 1. Specific Incident Detail
  {
    id: 'incident-detail',
    match: '/incidents/:id',
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: (params) => `Incident #${params.id}`,
    subtitle: () => 'Context aware: Shuffle Incidents MCP injected',
    defaultPrompt: (params) => `Investigate incident ${params.id} and recommend next steps: `,
    placeholder: 'Ask about this incident, triage observables, or correlate...',
    getStorageKey: (params) => `incident_${params.id}`,
    description: 'Focused on the currently viewed incident with Shuffle Incidents MCP',
  },
  // 1b. Simplified Incident Detail
  {
    id: 'incident-simple-detail',
    match: '/incidents-simple/:id',
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: (params) => `Incident #${params.id}`,
    subtitle: () => 'Context aware: Shuffle Incidents MCP injected',
    defaultPrompt: (params) => `Investigate incident ${params.id} and recommend next steps: `,
    placeholder: 'Ask about this incident, triage observables, or correlate...',
    getStorageKey: (params) => `incident_${params.id}`,
    description: 'Focused on the currently viewed incident with Shuffle Incidents MCP',
  },
  // 2. Incidents List
  {
    id: 'incidents-list',
    match: '/incidents',
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: 'Incidents Agent',
    subtitle: 'Context aware: Shuffle Incidents MCP injected',
    defaultPrompt: 'Investigate this incident and recommend next steps: ',
    placeholder: 'Triage incidents, correlate alerts, or search threat intelligence...',
    getStorageKey: () => 'incidents_list',
    description: 'Incidents overview with Shuffle Incidents MCP',
  },
  {
    id: 'incidents-simple-list',
    match: '/incidents-simple',
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: 'Incidents Agent',
    subtitle: 'Context aware: Shuffle Incidents MCP injected',
    defaultPrompt: 'Investigate this incident and recommend next steps: ',
    placeholder: 'Triage incidents, correlate alerts, or search threat intelligence...',
    getStorageKey: () => 'incidents_list',
    description: 'Incidents overview with Shuffle Incidents MCP',
  },
  // 3. Specific Vulnerability Detail
  {
    id: 'vulnerability-detail',
    match: '/vulnerabilities/:id',
    defaultApps: [{ name: 'vulnerabilities' }],
    defaultPresetId: 'vulnerability',
    title: (params) => `Vulnerability ${params.id}`,
    subtitle: () => 'Context aware: Vulnerabilities MCP injected',
    defaultPrompt: (params) => `Review vulnerability ${params.id} and draft remediation plan: `,
    placeholder: 'Analyze this CVE, check affected hosts, and draft remediation...',
    getStorageKey: (params) => `vulnerability_${params.id}`,
    description: 'Focused on the selected vulnerability with Vulnerabilities MCP',
  },
  // 4. Vulnerabilities List
  {
    id: 'vulnerabilities-list',
    match: '/vulnerabilities',
    defaultApps: [{ name: 'vulnerabilities' }],
    defaultPresetId: 'vulnerability',
    title: 'Vulnerability Agent',
    subtitle: 'Context aware: Vulnerabilities MCP injected',
    defaultPrompt: 'Review my current vulnerabilities and prioritize them by ',
    placeholder: 'Review CVEs, prioritize by exploitability, or draft patch workflows...',
    getStorageKey: () => 'vulnerabilities_list',
    description: 'Vulnerabilities overview with Vulnerabilities MCP',
  },
  // 5. Workflows / Automations
  {
    id: 'workflows-builder',
    match: (pathname) =>
      pathname.startsWith('/workflows') || pathname.startsWith('/usecases') || pathname.startsWith('/infrastructure/flows'),
    defaultApps: [{ name: 'shuffle_workflows_builder' }, { name: 'shuffle_apps' }],
    defaultPresetId: 'build-workflows',
    title: 'Workflow Agent',
    subtitle: 'Context aware: Workflow Builder MCP injected',
    defaultPrompt: 'Build a Shuffle workflow that ',
    placeholder: 'Describe the automation you want to build or edit...',
    getStorageKey: () => 'workflows_builder',
    description: 'Workflow builder with Workflow Builder & Shuffle Apps MCPs',
  },
  // 6. Computer Use / Host Monitors
  {
    id: 'host-monitors',
    match: (pathname) => pathname.startsWith('/monitors'),
    defaultApps: [{ name: 'shuffle_host_monitors' }],
    defaultPresetId: 'host-monitor-control',
    title: 'Computer Use Agent',
    subtitle: 'Context aware: Host Monitors MCP injected',
    defaultPrompt: 'Take control of this host and help me with: ',
    placeholder: 'Ask the agent to run terminal commands, inspect files, or remediate...',
    getStorageKey: () => 'host_monitors',
    description: 'Computer use and host monitors control',
  },
  // 7. Detection & Sigma
  {
    id: 'detection',
    match: (pathname) => pathname.startsWith('/detection'),
    defaultApps: [{ name: 'shuffle_detection' }],
    defaultPresetId: 'detection',
    title: 'Detection Agent',
    subtitle: 'Context aware: Detection MCP injected',
    defaultPrompt: 'Modify my detections to ',
    placeholder: 'Create Sigma rules, tune detection pipelines, or filter false positives...',
    getStorageKey: () => 'detection',
    description: 'Detection engineering with Shuffle Detection MCP',
  },
  // 8. Alerts & Notifications
  {
    id: 'alerts',
    match: (pathname) => pathname.startsWith('/alerts') || pathname.startsWith('/notifications'),
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'handle-notifications',
    title: 'Alerts Agent',
    subtitle: 'Context aware: Incident & Notification MCP injected',
    defaultPrompt: 'Automatically handle incoming incidents by ',
    placeholder: 'Define triage rules or correlate incoming security alerts...',
    getStorageKey: () => 'alerts',
    description: 'Alert and notification triage',
  },
  // 9. Default Fallback
  {
    id: 'default',
    match: () => true,
    defaultApps: [{ name: 'shuffle_tools' }],
    defaultPresetId: 'support',
    title: 'Support Agent',
    subtitle: 'Shuffle AI Platform Assistant',
    defaultPrompt: 'Help me with the following on the Shuffle platform: ',
    placeholder: 'Ask anything about Shuffle, integrations, workflows, or diagnostics...',
    getStorageKey: (params, pathname) => `page_${pathname.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    description: 'General support agent for the platform',
  },
];

// Runtime dynamic rule registry
const customRuleRegistry: AgentContextRule[] = [];

/** Register a custom context rule dynamically. Returns an unsubscribe function. */
export const registerAgentContextRule = (rule: AgentContextRule, prepend = true): (() => void) => {
  if (prepend) {
    customRuleRegistry.unshift(rule);
  } else {
    customRuleRegistry.push(rule);
  }
  return () => {
    const idx = customRuleRegistry.indexOf(rule);
    if (idx !== -1) customRuleRegistry.splice(idx, 1);
  };
};

/** Get all registered rules (custom rules first, then built-in defaults) */
export const getAgentContextRules = (customRules?: AgentContextRule[]): AgentContextRule[] => {
  return [...(customRules ?? []), ...customRuleRegistry, ...DEFAULT_AGENT_CONTEXT_RULES];
};

/** Read saved user choice for a specific page storage key */
export const getPageContextChoice = (storageKey: string): PageContextChoice | null => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as PageContextChoice;
  } catch {
    return null;
  }
};

/** Save user's customized apps and preset for a specific page storage key */
export const setPageContextChoice = (
  storageKey: string,
  choice: { apps?: AgentContextApp[]; presetId?: string | null },
): void => {
  try {
    const existing = getPageContextChoice(storageKey) || { updatedAt: Date.now() };
    const payload: PageContextChoice = {
      ...existing,
      ...choice,
      updatedAt: Date.now(),
    };
    localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(payload));
  } catch {
    /* ignore storage write failures */
  }
};

/** Clear saved user choice for a specific page, reverting it to defaults */
export const clearPageContextChoice = (storageKey: string): void => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
  } catch {
    /* ignore storage removal failures */
  }
};

/**
 * Resolve the active context for a given pathname and search string.
 * Automatically checks for saved user choices per page and applies them if present.
 */
export const resolveAgentContext = (
  pathname: string,
  search = '',
  customRules?: AgentContextRule[],
): AgentResolvedContext => {
  const normPath = pathname.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const rules = getAgentContextRules(customRules);

  let matchedRule: AgentContextRule | null = null;
  let matchedParams: Record<string, string> = {};

  for (const rule of rules) {
    if (typeof rule.match === 'string') {
      const params = matchRoutePattern(rule.match, normPath);
      if (params !== null) {
        matchedRule = rule;
        matchedParams = params;
        break;
      }
    } else if (rule.match instanceof RegExp) {
      if (rule.match.test(normPath)) {
        matchedRule = rule;
        break;
      }
    } else if (typeof rule.match === 'function') {
      const res = rule.match(normPath, searchParams);
      if (res) {
        matchedRule = rule;
        if (typeof res === 'object') {
          matchedParams = res;
        }
        break;
      }
    }
  }

  // Fallback if somehow nothing matched (should never happen due to default rule)
  if (!matchedRule) {
    matchedRule = DEFAULT_AGENT_CONTEXT_RULES[DEFAULT_AGENT_CONTEXT_RULES.length - 1];
  }

  const storageKey = matchedRule.getStorageKey
    ? matchedRule.getStorageKey(matchedParams, normPath)
    : matchedRule.id;

  // Check if the user previously saved a choice for this page
  const savedChoice = getPageContextChoice(storageKey);
  const isOverridden = !!savedChoice && (savedChoice.apps !== undefined || savedChoice.presetId !== undefined);

  const effectiveApps = savedChoice?.apps ?? matchedRule.defaultApps;
  const effectivePresetId = savedChoice?.presetId !== undefined
    ? (savedChoice.presetId ?? undefined)
    : matchedRule.defaultPresetId;

  const title = typeof matchedRule.title === 'function'
    ? matchedRule.title(matchedParams, normPath)
    : matchedRule.title ?? 'Agent';

  const subtitle = typeof matchedRule.subtitle === 'function'
    ? matchedRule.subtitle(matchedParams, normPath)
    : matchedRule.subtitle ?? 'Context aware assistant';

  const defaultPrompt = typeof matchedRule.defaultPrompt === 'function'
    ? matchedRule.defaultPrompt(matchedParams, normPath)
    : matchedRule.defaultPrompt ?? '';

  return {
    ruleId: matchedRule.id,
    apps: effectiveApps,
    presetId: effectivePresetId,
    title,
    subtitle,
    defaultPrompt,
    placeholder: matchedRule.placeholder,
    storageKey,
    params: matchedParams,
    pathname: normPath,
    isOverridden,
    originalDefaultApps: matchedRule.defaultApps,
    originalDefaultPresetId: matchedRule.defaultPresetId,
  };
};
