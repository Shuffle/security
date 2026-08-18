/**
 * Shared defaults for the react18-json-view renderer used across the platform.
 *
 * By default, all JSON arrays are collapsed on first render so large lists
 * (llm_requests, llm_responses, observables, etc.) don't overwhelm the UI.
 * Root nodes stay expanded so users can still see the top-level structure.
 */

export const defaultCollapsed = ({
  node,
  depth,
}: {
  node: any;
  depth: number;
}): boolean => {
  // Keep the root node expanded so the top-level keys are visible.
  if (depth === 0) return false;

  // Collapse every array by default (the user can expand them as needed).
  if (Array.isArray(node)) return true;

  // Objects remain expanded at any depth so their keys are discoverable.
  return false;
};
