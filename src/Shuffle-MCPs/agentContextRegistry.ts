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
  /** Explicit flag indicating this route lacks a dedicated MCP mapping */
  missingConfig?: boolean;
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
  /** True when no specific rule was configured for this route (fallback rule used) */
  missingConfig: boolean;
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

/** Checks whether the given pathname is an Agent-specific route that must disable Ask AI */
export const isAgentRoute = (pathname: string): boolean => {
  const norm = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return norm === '/agents' || norm === '/agent' || norm.startsWith('/agents/') || norm.startsWith('/agent/');
};

/** Attempts to discover the primary entity name/title from the active DOM (e.g. incident/case/alert title input) */
export const getActivePageEntityName = (): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  try {
    const titleInput = document.querySelector(
      '[data-incident-field="title"] input, [data-case-field="title"] input, [data-ticket-field="title"] input, [data-alert-field="title"] input, [data-host-field="name"] input, [data-monitor-field="name"] input'
    ) as HTMLInputElement | null;
    if (titleInput?.value && titleInput.value.trim().length > 0) {
      return titleInput.value.trim();
    }
    const heading = document.querySelector('h1, h2, [data-entity-title]') as HTMLElement | null;
    if (heading?.textContent && heading.textContent.trim().length > 0 && heading.textContent.trim().length < 90) {
      return heading.textContent.trim();
    }
  } catch {
    /* ignore DOM query errors */
  }
  return undefined;
};

/**
 * Built-in context rules for Shuffle.
 * Most specific rules are defined first.
 */
export const DEFAULT_AGENT_CONTEXT_RULES: AgentContextRule[] = [
  // ==========================================
  // 1. Incidents, Cases, Tickets, Alerts (Grouped)
  // ==========================================
  // Specific Incident Detail
  {
    id: 'incident-detail',
    match: '/incidents/:id',
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: (params) => {
      const entity = getActivePageEntityName();
      return entity ? `How can we help handle incident "${entity}"?` : `How can we help handle incident #${params.id}?`;
    },
    subtitle: () => 'Shuffle Incidents MCP',
    defaultPrompt: (params) => `Investigate incident ${params.id} and recommend next steps: `,
    placeholder: 'Ask about this incident, triage observables, or correlate...',
    getStorageKey: (params) => `incident_${params.id}`,
    description: 'Focused on the currently viewed incident with Shuffle Incidents MCP',
  },
  // Simplified Incident Detail
  {
    id: 'incident-simple-detail',
    match: '/incidents-simple/:id',
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: (params) => {
      const entity = getActivePageEntityName();
      return entity ? `How can we help handle incident "${entity}"?` : `How can we help handle incident #${params.id}?`;
    },
    subtitle: () => 'Shuffle Incidents MCP',
    defaultPrompt: (params) => `Investigate incident ${params.id} and recommend next steps: `,
    placeholder: 'Ask about this incident, triage observables, or correlate...',
    getStorageKey: (params) => `incident_${params.id}`,
    description: 'Focused on the currently viewed incident with Shuffle Incidents MCP',
  },
  // Specific Case Detail
  {
    id: 'case-detail',
    match: '/cases/:id',
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: (params) => {
      const entity = getActivePageEntityName();
      return entity ? `How can we help handle case "${entity}"?` : `How can we help handle case #${params.id}?`;
    },
    subtitle: () => 'Shuffle Incidents MCP',
    defaultPrompt: (params) => `Investigate case ${params.id} and recommend next steps: `,
    placeholder: 'Review case evidence, correlate events, or recommend response actions...',
    getStorageKey: (params) => `case_${params.id}`,
    description: 'Focused on the currently viewed case with Shuffle Incidents MCP',
  },
  // Specific Ticket Detail
  {
    id: 'ticket-detail',
    match: '/tickets/:id',
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: (params) => {
      const entity = getActivePageEntityName();
      return entity ? `How can we help handle ticket "${entity}"?` : `How can we help handle ticket #${params.id}?`;
    },
    subtitle: () => 'Shuffle Incidents MCP',
    defaultPrompt: (params) => `Investigate ticket ${params.id} and recommend next steps: `,
    placeholder: 'Investigate ticket, draft reply, or correlate related incidents...',
    getStorageKey: (params) => `ticket_${params.id}`,
    description: 'Focused on the currently viewed ticket with Shuffle Incidents MCP',
  },
  // Specific Alert Detail
  {
    id: 'alert-detail',
    match: '/alerts/:id',
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: (params) => {
      const entity = getActivePageEntityName();
      return entity ? `How can we help handle alert "${entity}"?` : `How can we help handle alert #${params.id}?`;
    },
    subtitle: () => 'Shuffle Incidents MCP',
    defaultPrompt: (params) => `Investigate alert ${params.id} and recommend next steps: `,
    placeholder: 'Analyze alert telemetry, assess false positive probability, or escalate...',
    getStorageKey: (params) => `alert_${params.id}`,
    description: 'Focused on the currently viewed alert with Shuffle Incidents MCP',
  },
  // Incidents Overview & Subpages (/incidents/*)
  {
    id: 'incidents-group',
    match: (pathname) => pathname.startsWith('/incidents') || pathname.startsWith('/incidents-simple'),
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: 'How can we help handle incidents?',
    subtitle: 'Shuffle Incidents MCP',
    defaultPrompt: 'Investigate this incident and recommend next steps: ',
    placeholder: 'Triage incidents, correlate alerts, or search threat intelligence...',
    getStorageKey: () => 'incidents_list',
    description: 'Incidents overview with Shuffle Incidents MCP',
  },
  // Cases Overview & Subpages (/cases/*)
  {
    id: 'cases-group',
    match: (pathname) => pathname.startsWith('/cases'),
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: 'How can we help handle cases?',
    subtitle: 'Shuffle Incidents MCP',
    defaultPrompt: 'Investigate this case and recommend next steps: ',
    placeholder: 'Review active cases, correlate investigations, or log evidence...',
    getStorageKey: () => 'cases_list',
    description: 'Cases overview with Shuffle Incidents MCP',
  },
  // Tickets Overview & Subpages (/tickets/*)
  {
    id: 'tickets-group',
    match: (pathname) => pathname.startsWith('/tickets'),
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: 'How can we help handle tickets?',
    subtitle: 'Shuffle Incidents MCP',
    defaultPrompt: 'Investigate this ticket and recommend next steps: ',
    placeholder: 'Triage incoming tickets, automate assignments, or resolve issues...',
    getStorageKey: () => 'tickets_list',
    description: 'Tickets overview with Shuffle Incidents MCP',
  },
  // Alerts Overview & Subpages (/alerts/*, /notifications/*)
  {
    id: 'alerts-group',
    match: (pathname) => pathname.startsWith('/alerts') || pathname.startsWith('/notifications'),
    defaultApps: [{ name: 'shuffle_incidents' }],
    defaultPresetId: 'incident-response',
    title: 'How can we help handle alerts?',
    subtitle: 'Shuffle Incidents MCP',
    defaultPrompt: 'Investigate this alert and recommend next steps: ',
    placeholder: 'Triage incoming security alerts, filter noise, or escalate to incident...',
    getStorageKey: () => 'alerts_list',
    description: 'Alert and notification triage with Shuffle Incidents MCP',
  },

  // ==========================================
  // 2. Vulnerabilities (shuffle_vulnerabilities)
  // ==========================================
  // Specific Vulnerability Detail
  {
    id: 'vulnerability-detail',
    match: '/vulnerabilities/:id',
    defaultApps: [{ name: 'shuffle_vulnerabilities' }],
    defaultPresetId: 'vulnerability',
    title: (params) => {
      const entity = getActivePageEntityName();
      return entity ? `How can we help with ${entity}?` : `How can we help with vulnerability ${params.id}?`;
    },
    subtitle: () => 'Shuffle Vulnerabilities MCP',
    defaultPrompt: (params) => `Review vulnerability ${params.id} and draft remediation plan: `,
    placeholder: 'Analyze this CVE, check affected hosts, and draft remediation...',
    getStorageKey: (params) => `vulnerability_${params.id}`,
    description: 'Focused on the selected vulnerability with Shuffle Vulnerabilities MCP',
  },
  // Vulnerabilities List & Subpages
  {
    id: 'vulnerabilities-list',
    match: (pathname) => pathname.startsWith('/vulnerabilities'),
    defaultApps: [{ name: 'shuffle_vulnerabilities' }],
    defaultPresetId: 'vulnerability',
    title: 'How can we help review vulnerabilities?',
    subtitle: 'Shuffle Vulnerabilities MCP',
    defaultPrompt: 'Review my current vulnerabilities and prioritize them by ',
    placeholder: 'Review CVEs, prioritize by exploitability, or draft patch workflows...',
    getStorageKey: () => 'vulnerabilities_list',
    description: 'Vulnerabilities overview with Shuffle Vulnerabilities MCP',
  },

  // ==========================================
  // 3. Monitors & Computer Use (shuffle_host_monitors for all)
  // ==========================================
  // Specific Host Terminal (/monitors/:id/terminal)
  {
    id: 'monitor-terminal-detail',
    match: '/monitors/:id/terminal',
    defaultApps: [{ name: 'shuffle_host_monitors' }],
    defaultPresetId: 'host-monitor-control',
    title: (params) => {
      const entity = getActivePageEntityName();
      return entity ? `How can we help in terminal for "${entity}"?` : `How can we help in terminal on host #${params.id}?`;
    },
    subtitle: () => 'Shuffle Host Monitors MCP',
    defaultPrompt: (params) => `Run commands on host ${params.id} to `,
    placeholder: 'Ask the agent to execute shell commands, inspect logs, or debug...',
    getStorageKey: (params) => `monitor_terminal_${params.id}`,
    description: 'Interactive terminal control with Shuffle Host Monitors MCP',
  },
  // General Host Terminal (/monitors/terminal)
  {
    id: 'monitor-terminal',
    match: '/monitors/terminal',
    defaultApps: [{ name: 'shuffle_host_monitors' }],
    defaultPresetId: 'host-monitor-control',
    title: 'How can we help in the host terminal?',
    subtitle: 'Shuffle Host Monitors MCP',
    defaultPrompt: 'Run terminal commands on this host to ',
    placeholder: 'Ask the agent to execute shell commands, inspect files, or debug...',
    getStorageKey: () => 'monitors_terminal',
    description: 'Interactive terminal control with Shuffle Host Monitors MCP',
  },
  // Host Response Actions (/monitors/response)
  {
    id: 'monitor-response',
    match: '/monitors/response',
    defaultApps: [{ name: 'shuffle_host_monitors' }],
    defaultPresetId: 'host-monitor-control',
    title: 'How can we help with host response?',
    subtitle: 'Shuffle Host Monitors MCP',
    defaultPrompt: 'Take response actions on this host to ',
    placeholder: 'Isolate host, terminate suspicious processes, or run remediation...',
    getStorageKey: () => 'monitors_response',
    description: 'Host response actions with Shuffle Host Monitors MCP',
  },
  // Specific Host Overview (/monitors/:id)
  {
    id: 'monitor-detail',
    match: '/monitors/:id',
    defaultApps: [{ name: 'shuffle_host_monitors' }],
    defaultPresetId: 'host-monitor-control',
    title: (params) => {
      const entity = getActivePageEntityName();
      return entity ? `How can we help with host "${entity}"?` : `How can we help with host #${params.id}?`;
    },
    subtitle: () => 'Shuffle Host Monitors MCP',
    defaultPrompt: (params) => `Take control of host ${params.id} and help me with: `,
    placeholder: 'Inspect host telemetry, running processes, network connections, or remediate...',
    getStorageKey: (params) => `monitor_${params.id}`,
    description: 'Host detail view with Shuffle Host Monitors MCP',
  },
  // Monitors Fleet Overview & Subpages (/monitors, /monitors/*)
  {
    id: 'host-monitors-group',
    match: (pathname) => pathname.startsWith('/monitors'),
    defaultApps: [{ name: 'shuffle_host_monitors' }],
    defaultPresetId: 'host-monitor-control',
    title: 'How can we help with host monitors?',
    subtitle: 'Shuffle Host Monitors MCP',
    defaultPrompt: 'Take control of this host and help me with: ',
    placeholder: 'Ask the agent to run terminal commands, inspect files, or remediate...',
    getStorageKey: () => 'host_monitors',
    description: 'Computer use and host monitors control with Shuffle Host Monitors MCP',
  },

  // ==========================================
  // 4. Workflows & Automations
  // ==========================================
  // Specific Workflow Detail (/workflows/:id)
  {
    id: 'workflow-detail',
    match: '/workflows/:id',
    defaultApps: [{ name: 'shuffle_workflows_builder' }, { name: 'shuffle_apps' }],
    defaultPresetId: 'edit-workflow',
    title: (params) => {
      const entity = getActivePageEntityName();
      return entity ? `How can we help edit "${entity}"?` : `How can we help edit workflow #${params.id}?`;
    },
    subtitle: () => 'Shuffle Workflows Builder & Shuffle Apps',
    defaultPrompt: (params) => `Edit workflow ${params.id} to `,
    placeholder: 'Describe the changes, new actions, or logic to add...',
    getStorageKey: (params) => `workflow_${params.id}`,
    description: 'Focused on editing the selected workflow with Shuffle Workflows Builder and Shuffle Apps',
  },
  // Workflows Overview & Subpages (/workflows, /workflows/*)
  {
    id: 'workflows-group',
    match: (pathname) =>
      pathname === '/workflows' ||
      pathname.startsWith('/workflows') ||
      pathname.startsWith('/usecases') ||
      pathname.startsWith('/infrastructure/flows'),
    defaultApps: [{ name: 'shuffle_workflows_builder' }, { name: 'shuffle_apps' }],
    defaultPresetId: 'edit-workflow',
    title: 'How can we help edit workflows?',
    subtitle: 'Shuffle Workflows Builder & Shuffle Apps',
    defaultPrompt: 'Edit this Shuffle workflow to ',
    placeholder: 'Describe the workflow you want to build or edit...',
    getStorageKey: () => 'workflows_builder',
    description: 'Workflow builder with Shuffle Workflows Builder and Shuffle Apps',
  },

  // ==========================================
  // 5. Detection & Sigma
  // ==========================================
  {
    id: 'detection',
    match: (pathname) => pathname.startsWith('/detection'),
    defaultApps: [{ name: 'shuffle_detection' }],
    defaultPresetId: 'detection',
    title: 'How can we help tune detections?',
    subtitle: 'Shuffle Detection MCP',
    defaultPrompt: 'Modify my detections to ',
    placeholder: 'Create Sigma rules, tune detection pipelines, or filter false positives...',
    getStorageKey: () => 'detection',
    description: 'Detection engineering with Shuffle Detection MCP',
  },

  // ==========================================
  // 6. Default Fallback (Support)
  // ==========================================
  {
    id: 'default',
    match: () => true,
    defaultApps: [{ name: 'shuffle_tools' }],
    defaultPresetId: 'support',
    title: 'How can we help on this page?',
    subtitle: 'General Platform Assistant',
    defaultPrompt: 'Help me with the following on this page: ',
    placeholder: 'Ask anything about Shuffle, integrations, or workflows...',
    getStorageKey: (params, pathname) => `page_${pathname.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    description: 'General support agent for the platform',
    missingConfig: true,
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

  const missingConfig = Boolean(matchedRule.missingConfig ?? (matchedRule.id === 'default'));

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
    missingConfig,
  };
};
