/**
 * Safely sanitizes internal platform destinations for post-login redirects.
 * Ensures the target ONLY stays within the platform and never redirects
 * to third-party or untrusted external websites.
 */
export function sanitizeInternalDestination(
  rawCandidate: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!rawCandidate || typeof rawCandidate !== 'string') {
    return fallback;
  }

  let candidate = rawCandidate.trim();
  try {
    candidate = decodeURIComponent(candidate).trim();
  } catch {
    // ignore decode error
  }

  // Remove ASCII control characters, newlines, and whitespace
  candidate = candidate.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '');

  if (!candidate) {
    return fallback;
  }

  // Reject dangerous schemes
  const lower = candidate.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return fallback;
  }

  // Reject protocol-relative URLs (e.g. //evil.com, /\evil.com, \/evil.com)
  if (
    candidate.startsWith('//') ||
    candidate.startsWith('/\\') ||
    candidate.startsWith('\\/') ||
    candidate.startsWith('\\\\')
  ) {
    return fallback;
  }

  // Handle absolute HTTP/HTTPS URLs:
  // ONLY permit if it matches window.location.origin (strictly the current platform)
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const parsed = new URL(candidate);
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      if (!currentOrigin || parsed.origin !== currentOrigin) {
        // Disallowed external third-party origin
        return fallback;
      }
      // Same-origin URL: extract path, query, hash
      candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return fallback;
    }
  }

  // If candidate is a bare view name like "workflows" or "admin", prepend "/"
  if (!candidate.startsWith('/')) {
    // If it contains a scheme separator like "foo:bar", reject it
    if (candidate.includes(':')) {
      return fallback;
    }
    candidate = `/${candidate}`;
  }

  // Re-verify no protocol-relative or backslash escape
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return fallback;
  }

  // Disallow bouncing back to auth endpoints
  const cleanPath = candidate.split('?')[0].split('#')[0];
  if (
    cleanPath === '/login' ||
    cleanPath === '/mobile-login' ||
    cleanPath === '/register' ||
    !cleanPath ||
    cleanPath === '/'
  ) {
    return fallback;
  }

  return candidate;
}
