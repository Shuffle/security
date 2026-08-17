// Lightweight cross-component sync for agent runs.
//
// Two concerns live here:
//  1. Optimistic abort broadcasting — when a run is aborted anywhere in the UI
//     (Agent drawer, activity list), every mounted list should flip that run to
//     ABORTED instantly instead of waiting for the next poll.
//  2. "Last opened" run tracking — so the activity list can subtly highlight the
//     run the user came back from.

export const AGENT_ABORTED_EVENT = 'shuffle-agent-run-aborted';
export const AGENT_LAST_OPENED_EVENT = 'shuffle-agent-run-opened';

const LAST_OPENED_KEY = 'shuffle-agent-last-opened-run';

/** Broadcast that an execution has been (optimistically) aborted. */
export const broadcastAgentAborted = (executionId?: string | null) => {
  if (!executionId || typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(AGENT_ABORTED_EVENT, { detail: { executionId } }));
  } catch { /* noop */ }
};

/** Subscribe to optimistic abort broadcasts. Returns an unsubscribe function. */
export const subscribeAgentAborted = (cb: (executionId: string) => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const id = (e as CustomEvent)?.detail?.executionId;
    if (typeof id === 'string' && id) cb(id);
  };
  window.addEventListener(AGENT_ABORTED_EVENT, handler as EventListener);
  return () => window.removeEventListener(AGENT_ABORTED_EVENT, handler as EventListener);
};

export const setLastOpenedAgentRun = (executionId?: string | null) => {
  if (!executionId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_OPENED_KEY, executionId);
    window.dispatchEvent(new CustomEvent(AGENT_LAST_OPENED_EVENT, { detail: { executionId } }));
  } catch { /* noop */ }
};

export const getLastOpenedAgentRun = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LAST_OPENED_KEY);
  } catch {
    return null;
  }
};

export const subscribeLastOpenedAgentRun = (cb: (executionId: string) => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const id = (e as CustomEvent)?.detail?.executionId;
    if (typeof id === 'string' && id) cb(id);
  };
  window.addEventListener(AGENT_LAST_OPENED_EVENT, handler as EventListener);
  return () => window.removeEventListener(AGENT_LAST_OPENED_EVENT, handler as EventListener);
};
