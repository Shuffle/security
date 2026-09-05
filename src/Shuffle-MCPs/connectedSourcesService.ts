/**
 * connectedSourcesService — Discovers and connects tenant ingestion sources and forward destinations
 * as active AI tools in contextual Ask AI panels.
 *
 * Self-contained: relative imports only within Shuffle-MCPs.
 */

import {
  isVulnScannerApp,
  isIgnoredWorkflowAppName,
  normalizeAppName,
  findIngestTicketsWorkflow,
  findForwardTicketsWorkflow,
  extractWorkflowAppNames,
  CASES_PATTERNS,
  COMMUNICATION_PATTERNS_NAMES,
  SIEM_PATTERNS,
  EDR_PATTERNS,
  EMAIL_APP_PATTERNS,
  VULN_SCANNER_PATTERNS,
} from './ingestionDetection';

export interface ConnectedToolApp {
  name: string;
  id?: string;
  icon?: string;
}

const CACHE_PREFIX = 'shuffle:connected_tools:';

/**
 * Retrieve cached connected tools from localStorage for immediate synchronous render.
 */
export function getCachedConnectedTools(category?: string): ConnectedToolApp[] {
  if (!category || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${category}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save discovered connected tools to localStorage cache.
 */
export function setCachedConnectedTools(category: string, tools: ConnectedToolApp[]): void {
  if (!category || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}${category}`, JSON.stringify(tools));
  } catch {
    /* ignore storage write errors */
  }
}

/**
 * Merge connected tools into a base app list without duplicating entries.
 */
export function mergeConnectedTools(
  baseApps: ConnectedToolApp[],
  connectedTools: ConnectedToolApp[],
): ConnectedToolApp[] {
  if (!connectedTools || connectedTools.length === 0) return baseApps;
  const seen = new Set<string>();
  const merged: ConnectedToolApp[] = [];

  for (const app of baseApps) {
    if (!app?.name) continue;
    const norm = normalizeAppName(app.name);
    if (!seen.has(norm)) {
      seen.add(norm);
      merged.push(app);
    }
  }

  for (const app of connectedTools) {
    if (!app?.name) continue;
    const norm = normalizeAppName(app.name);
    if (!seen.has(norm) && !isIgnoredWorkflowAppName(norm)) {
      seen.add(norm);
      merged.push(app);
    }
  }

  return merged;
}

/**
 * Derives connected tools (sources & destinations) from raw API responses.
 */
export function resolveConnectedTools(
  category: 'incidents' | 'vulnerabilities' | string,
  authApiResponse: any[] = [],
  workflowsResponse: any[] = [],
): ConnectedToolApp[] {
  const tools: ConnectedToolApp[] = [];
  const seen = new Set<string>();

  const authList = Array.isArray(authApiResponse)
    ? authApiResponse
    : (authApiResponse as any)?.data || [];

  const workflows = Array.isArray(workflowsResponse)
    ? workflowsResponse
    : (workflowsResponse as any)?.workflows || [];

  // Helper to add tool avoiding duplicates & ignored runtime apps
  const addTool = (name: string, id?: string, icon?: string) => {
    if (!name || typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const norm = normalizeAppName(trimmed);
    if (!norm || seen.has(norm) || isIgnoredWorkflowAppName(norm)) return;
    seen.add(norm);
    tools.push({ name: trimmed, id: id || undefined, icon: icon || undefined });
  };

  // Build lookup of auth apps by normalized name and id
  const authByName = new Map<string, { name: string; id?: string; icon?: string; active: boolean; valid: boolean }>();
  for (const entry of authList) {
    const app = entry?.app || entry;
    const rawName = app?.name;
    if (!rawName) continue;
    const norm = normalizeAppName(rawName);
    const isValid =
      entry?.active === true ||
      entry?.validation?.valid === true ||
      entry?.hasValidAuth === true ||
      app?.is_valid === true ||
      app?.tested === true;
    const img = app?.large_image || app?.image_url || app?.image || entry?.bestImage || '';
    if (!authByName.has(norm) || isValid) {
      authByName.set(norm, {
        name: rawName,
        id: app?.id || entry?.id,
        icon: img,
        active: Boolean(entry?.active),
        valid: isValid,
      });
    }
  }

  if (category === 'incidents') {
    // 1. Workflow Sources: Ingest Tickets
    const ingestWf = findIngestTicketsWorkflow(workflows);
    const ingestAppNames = ingestWf ? extractWorkflowAppNames(ingestWf) : new Set<string>();

    // 2. Workflow Destinations: Forward Tickets
    const forwardWf = findForwardTicketsWorkflow(workflows);
    const forwardAppNames = forwardWf ? extractWorkflowAppNames(forwardWf) : new Set<string>();

    // Add apps that are in the Ingest Tickets workflow actions (e.g. Elastic Security, Wazuh, Splunk)
    ingestAppNames.forEach((norm) => {
      const auth = authByName.get(norm);
      if (auth) {
        addTool(auth.name, auth.id, auth.icon);
      } else {
        const formatted = norm
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        addTool(formatted);
      }
    });

    // Add apps that are in the Forward Tickets workflow actions (e.g. Jira, ServiceNow, Slack)
    forwardAppNames.forEach((norm) => {
      const auth = authByName.get(norm);
      if (auth) {
        addTool(auth.name, auth.id, auth.icon);
      } else {
        const formatted = norm
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        addTool(formatted);
      }
    });

    // Also inspect authenticated apps: if validated/active and matching SIEM, EDR, Email, Cases, or Comms:
    // If the user has authenticated Elastic Security, Splunk, Jira, ServiceNow, etc., include them!
    for (const [norm, auth] of authByName.entries()) {
      if (!auth.valid && !auth.active) continue;
      const isSiem = SIEM_PATTERNS.some((p) => norm.includes(p));
      const isEdr = EDR_PATTERNS.some((p) => norm.includes(p));
      const isEmail = EMAIL_APP_PATTERNS.some((p) => norm.includes(p));
      const isCases = CASES_PATTERNS.some((p) => norm.includes(p));
      const isComms = COMMUNICATION_PATTERNS_NAMES.some((p) => norm.includes(p));

      if (isSiem || isEdr || isEmail || isCases || isComms) {
        addTool(auth.name, auth.id, auth.icon);
      }
    }
  } else if (category === 'vulnerabilities') {
    // 1. Workflow Sources: Ingest Vulnerabilities
    const ingestVulnWf = workflows.find((w: any) =>
      typeof w?.name === 'string' && (
        w.name === 'Ingest Vulnerabilities' ||
        w.name.toLowerCase().includes('ingest vulnerabilit')
      )
    );
    const vulnAppNames = ingestVulnWf ? extractWorkflowAppNames(ingestVulnWf) : new Set<string>();

    vulnAppNames.forEach((norm) => {
      const auth = authByName.get(norm);
      if (auth) {
        addTool(auth.name, auth.id, auth.icon);
      } else {
        const formatted = norm
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        addTool(formatted);
      }
    });

    // Also inspect authenticated apps: any validated/active vuln scanner (Qualys, Tenable, Nessus, Snyk, Rapid7, etc.)
    for (const [norm, auth] of authByName.entries()) {
      if (!auth.valid && !auth.active) continue;
      const isScanner = isVulnScannerApp(auth.name) || VULN_SCANNER_PATTERNS.some((p) => norm.includes(p));
      if (isScanner) {
        addTool(auth.name, auth.id, auth.icon);
      }
    }
  }

  return tools;
}

/**
 * Fetch live connected tools from tenant workflows and authenticated apps.
 */
export async function fetchConnectedTools(
  category: string,
  resolveUrl: (path: string) => string = (p) => p,
  resolveHeaders: () => Record<string, string> = () => ({}),
): Promise<ConnectedToolApp[]> {
  if (!category || (category !== 'incidents' && category !== 'vulnerabilities')) {
    return [];
  }

  try {
    const [authRes, wfRes] = await Promise.allSettled([
      fetch(resolveUrl('/api/v1/apps/authentication'), {
        credentials: 'include',
        headers: resolveHeaders(),
      }),
      fetch(resolveUrl('/api/v1/workflows'), {
        credentials: 'include',
        headers: resolveHeaders(),
      }),
    ]);

    const authData = authRes.status === 'fulfilled' && authRes.value.ok ? await authRes.value.json() : [];
    const wfData = wfRes.status === 'fulfilled' && wfRes.value.ok ? await wfRes.value.json() : [];

    const tools = resolveConnectedTools(category, authData, wfData);
    if (tools.length > 0) {
      setCachedConnectedTools(category, tools);
    }
    return tools;
  } catch {
    return getCachedConnectedTools(category);
  }
}
