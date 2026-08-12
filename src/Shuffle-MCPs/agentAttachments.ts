/**
 * Helpers for pulling image attachments out of an agent run's `llm_requests`.
 *
 * The backend now attaches the raw LLM request payloads to the agent output.
 * Each request looks roughly like:
 *
 *   { model: "...", messages: [ { role: "user", content: [
 *        { type: "text", text: "..." },
 *        { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
 *   ] } ] }
 *
 * We deep-walk the agent payload (run level and per-decision) so images can be
 * surfaced in the UI — which matters when going back and forth between the
 * Detailed and Start views, or when rerunning the exact same prompt.
 */

export interface LlmImageAttachment {
  /** Full image src (data: URI or https URL). */
  url: string;
  /** Model the request was sent to, when known. */
  model?: string;
  /** Message role the image was attached to. */
  role?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const extractUrl = (block: Record<string, unknown>): string | null => {
  const iu = block.image_url ?? (block as any).imageUrl;
  if (typeof iu === 'string') return iu;
  if (isRecord(iu) && typeof iu.url === 'string') return iu.url;
  return null;
};

const collectFromRequest = (req: unknown, out: LlmImageAttachment[]) => {
  if (!isRecord(req)) return;
  const model = typeof req.model === 'string' ? req.model : undefined;
  const messages = Array.isArray(req.messages) ? req.messages : [];
  for (const msg of messages) {
    if (!isRecord(msg)) continue;
    const role = typeof msg.role === 'string' ? msg.role : undefined;
    const content = msg.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!isRecord(block)) continue;
      if (String(block.type || '') !== 'image_url') continue;
      const url = extractUrl(block);
      if (url) out.push({ url, model, role });
    }
  }
};

/**
 * Deep-walk any agent payload and return every image attached to an
 * `llm_requests` entry, de-duplicated by URL and in first-seen order.
 */
export const collectLlmImageAttachments = (root: unknown, maxDepth = 6): LlmImageAttachment[] => {
  const found: LlmImageAttachment[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown, depth: number) => {
    if (depth > maxDepth || !node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }

    const rec = node as Record<string, unknown>;
    const reqs = rec.llm_requests ?? (rec as any).llmRequests;
    if (Array.isArray(reqs)) {
      for (const req of reqs) collectFromRequest(req, found);
    }
    for (const value of Object.values(rec)) walk(value, depth + 1);
  };

  walk(root, 0);

  const deduped: LlmImageAttachment[] = [];
  const urls = new Set<string>();
  for (const item of found) {
    if (urls.has(item.url)) continue;
    urls.add(item.url);
    deduped.push(item);
  }
  return deduped;
};
