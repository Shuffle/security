/**
 * Agent tools assignment.
 *
 * Stores which tool/app names are assigned to which agent + action type.
 * Multiple agents can exist (default name "default"), each with multiple
 * action types (e.g. "timeline_reply", "task_reply"). The shape is a flat
 * array so it serializes cleanly and is easy to extend.
 *
 *   [
 *     { agent: 'default', actionType: 'timeline_reply', tools: ['Wazuh', ...] },
 *     ...
 *   ]
 *
 * Persistence: backed by the Shuffle datastore under category
 * `shuffle-security_agent_tools` / key `config`. localStorage is used purely
 * as a synchronous cache so existing call sites stay non-async; mutators
 * update the cache immediately and then write through to the datastore in
 * the background. Call `loadAgentToolsFromDatastore()` once on app startup
 * to hydrate the cache from the server.
 *
 * Components subscribe to in-process changes via the `agent-tools-changed`
 * window event so the UI updates without a reload.
 */

import { getDatastoreItem, setDatastoreItem } from '@/Shuffle-MCPs/datastore';

const STORAGE_KEY = 'agent_tools_config';
const DATASTORE_CATEGORY = 'shuffle-security_agent_tools';
const DATASTORE_KEY = 'config';

export const AGENT_TOOLS_CHANGED_EVENT = 'agent-tools-changed';

export const DEFAULT_AGENT = 'default';
export const DEFAULT_ACTION_TYPE = 'timeline_reply';

export interface AgentToolsEntry {
  agent: string;
  actionType: string;
  tools: string[];
}

const sanitize = (parsed: unknown): AgentToolsEntry[] => {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e: any) => e && typeof e.agent === 'string' && typeof e.actionType === 'string' && Array.isArray(e.tools))
    .map((e: any) => ({
      agent: e.agent,
      actionType: e.actionType,
      tools: e.tools.filter((t: unknown) => typeof t === 'string'),
    }));
};

const readAll = (): AgentToolsEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
};

const writeCache = (entries: AgentToolsEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent(AGENT_TOOLS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
};

const persistToDatastore = (entries: AgentToolsEntry[]) => {
  // Fire-and-forget: UI already updated from cache. Failures are logged
  // so users can see them in the console but do not block interaction.
  setDatastoreItem(DATASTORE_KEY, entries, DATASTORE_CATEGORY).catch((err) => {
    console.warn('[agentTools] Failed to persist to datastore:', err);
  });
};

const writeAll = (entries: AgentToolsEntry[]) => {
  writeCache(entries);
  persistToDatastore(entries);
};

/**
 * Hydrate the local cache from the datastore. Call once on app startup
 * (e.g. from DashboardLayout). Safe to call repeatedly — last write wins.
 */
export const loadAgentToolsFromDatastore = async (): Promise<AgentToolsEntry[]> => {
  try {
    const res = await getDatastoreItem(DATASTORE_KEY, DATASTORE_CATEGORY);
    if (!res.success || !res.item) return readAll();
    let value: unknown = res.item.value;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { /* fall through */ }
    }
    const entries = sanitize(value);
    writeCache(entries);
    return entries;
  } catch {
    return readAll();
  }
};

export const getAgentTools = (
  agent: string = DEFAULT_AGENT,
  actionType: string = DEFAULT_ACTION_TYPE,
): string[] => {
  const all = readAll();
  return all.find((e) => e.agent === agent && e.actionType === actionType)?.tools ?? [];
};

export const setAgentTools = (
  tools: string[],
  agent: string = DEFAULT_AGENT,
  actionType: string = DEFAULT_ACTION_TYPE,
) => {
  const all = readAll();
  const idx = all.findIndex((e) => e.agent === agent && e.actionType === actionType);
  const dedup = Array.from(new Set(tools.filter((t) => typeof t === 'string' && t.trim().length > 0)));
  if (idx >= 0) all[idx] = { agent, actionType, tools: dedup };
  else all.push({ agent, actionType, tools: dedup });
  writeAll(all);
};

export const addAgentTool = (
  tool: string,
  agent: string = DEFAULT_AGENT,
  actionType: string = DEFAULT_ACTION_TYPE,
) => {
  const current = getAgentTools(agent, actionType);
  if (current.includes(tool)) return;
  setAgentTools([...current, tool], agent, actionType);
};

export const removeAgentTool = (
  tool: string,
  agent: string = DEFAULT_AGENT,
  actionType: string = DEFAULT_ACTION_TYPE,
) => {
  const current = getAgentTools(agent, actionType);
  setAgentTools(current.filter((t) => t !== tool), agent, actionType);
};

export const formatToolName = (name: string): string =>
  name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
