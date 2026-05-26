/**
 * Build/parse the URL segment used to identify a host monitor in routes like
 *   /monitors/:id
 *   /monitors/:hostUuid/terminal
 *
 * We intentionally avoid using the host's `uuid` in URLs because the agent's
 * uuid changes whenever the user re-installs / restarts the host monitor.
 * Instead we encode the host as `${hostname}:${arch}@${group}` (e.g.
 * `DAVID:windows@Production`). The trailing `@group` is included whenever
 * we know the monitor group so the resolver can disambiguate when the same
 * hostname exists in multiple sensor groups.
 *
 * Resolvers should match the parsed `hostname` (+ `group` when present)
 * against the host list. The `arch` is a hint to disambiguate when two
 * hosts in the same group share a hostname.
 *
 * Backwards-compat: a raw uuid still works as the URL segment — resolvers
 * fall back to uuid matching when the segment doesn't look like a hostname
 * we recognise. Segments without `@group` also still resolve.
 */

export const hostUrlSegment = (
  host: { hostname?: unknown; arch?: unknown; uuid?: unknown; groupName?: unknown } | null | undefined,
): string => {
  const hostname = String((host as { hostname?: unknown })?.hostname || '').trim();
  if (!hostname) {
    // Last-resort fallback: still better than a broken link.
    return String((host as { uuid?: unknown })?.uuid || '').trim();
  }
  const arch = String((host as { arch?: unknown })?.arch || '').trim();
  const group = String((host as { groupName?: unknown })?.groupName || '').trim();
  const base = arch ? `${hostname}:${arch}` : hostname;
  return group ? `${base}@${group}` : base;
};

export interface ParsedHostSegment {
  /** The original (decoded) segment as supplied. */
  raw: string;
  /** Hostname portion (everything before the LAST `:` in the pre-`@` part). */
  hostname: string;
  /** Arch portion (everything after the LAST `:` in the pre-`@` part), lower-case. May be ''. */
  arch: string;
  /** Group name portion (everything after the FIRST `@`), trimmed. May be ''. */
  group: string;
}

export const parseHostUrlSegment = (segment: string | null | undefined): ParsedHostSegment => {
  const raw = (() => {
    try { return decodeURIComponent(segment || ''); } catch { return String(segment || ''); }
  })().trim();
  // Split off group first — group may contain spaces, but '@' is disallowed in
  // env names by convention, so splitting on the first '@' is safe.
  const atIdx = raw.indexOf('@');
  const head = atIdx >= 0 ? raw.slice(0, atIdx) : raw;
  const group = atIdx >= 0 ? raw.slice(atIdx + 1).trim() : '';
  const idx = head.lastIndexOf(':');
  if (idx < 0) return { raw, hostname: head.trim(), arch: '', group };
  return {
    raw,
    hostname: head.slice(0, idx).trim(),
    arch: head.slice(idx + 1).trim().toLowerCase(),
    group,
  };
};
