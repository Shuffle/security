/**
 * Server-side documentation fetching for SSR.
 *
 * Fetches the docs list and the raw markdown for a single doc from the
 * Shuffle Core API so route loaders can render the full page — including
 * YouTube / Loom embeds — into the SSR HTML. Also derives SEO metadata
 * (title, description, VideoObject data) from the markdown. Client-side
 * fetching in MarkdownRenderer remains the fallback for self-hosted builds.
 */

export interface ServerDocMeta {
  name?: string;
  contributors?: { name?: string; url?: string; image?: string }[];
  read_time?: number;
  edited?: string;
  link?: string;
}

export interface ServerDocVideo {
  kind: 'youtube' | 'loom' | 'file';
  name: string;
  description: string;
  thumbnailUrl?: string;
  /** Iframe embed URL (youtube-nocookie style embed, loom embed). */
  embedUrl: string;
  /** Watch page URL (YouTube only — used as VideoObject contentUrl). */
  contentUrl?: string;
}

export interface ServerDocContent {
  markdown: string;
  meta: ServerDocMeta | null;
  /** First H1 in the markdown, when present. */
  title: string | null;
  /** First readable paragraph, markdown stripped, capped at ~155 chars. */
  description: string | null;
  /** Videos referenced by the doc, enriched with oEmbed metadata. */
  videos: ServerDocVideo[];
  /** ISO upload date derived from the doc's last-edited timestamp. */
  uploadDate?: string;
}

interface DocsListEntry {
  name?: string;
}

// Same rule as src/components/docs/remoteDocs.ts — GitHub raw 404 bodies are
// passed through as markdown by the API and must be treated as missing docs.
const isMissingDocBody = (markdown: string): boolean => {
  const trimmed = markdown.trim();
  if (trimmed.length > 200) return false;
  return /^(404\s*:?\s*not\s*found|not\s*found|400\s*:\s*.*|no\s*such\s*file.*)$/i.test(trimmed);
};

const docSlug = (name: string): string => name.replace(/_+/g, '-').toLowerCase();

const getBaseUrl = (): string =>
  (process.env['VITE_SHUFFLE_API_URL'] || 'https://shuffler.io').replace(/\/+$/, '');

const fetchJson = async (url: string, timeoutMs = 8000): Promise<unknown> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Markdown-derived SEO metadata
// ---------------------------------------------------------------------------

/** Strip inline markdown so text is usable in <meta> tags. */
const stripMarkdownInline = (value: string): string =>
  value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → label
    .replace(/<[^>]+>/g, '') // html tags
    .replace(/[`*_~#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const extractDocTitle = (markdown: string): string | null => {
  for (const line of markdown.split('\n')) {
    const match = line.match(/^#\s+(.+?)\s*$/);
    if (match) {
      const title = stripMarkdownInline(match[1]);
      if (title) return title;
    }
  }
  return null;
};

export const extractDocDescription = (markdown: string, maxLength = 155): string | null => {
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue; // headings
    if (/^[-*]\s+\[/.test(line)) continue; // toc-style link lists
    if (/^\|/.test(line)) continue; // tables
    const text = stripMarkdownInline(line);
    if (text.length < 40) continue;
    if (text.length <= maxLength) return text;
    const cut = text.slice(0, maxLength);
    return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Video extraction + oEmbed enrichment
// ---------------------------------------------------------------------------

const URL_PATTERN = /https?:\/\/[^\s)\]"'<>]+/g;

interface RawVideoRef {
  kind: 'youtube' | 'loom' | 'file';
  id?: string;
  embedUrl: string;
  watchUrl?: string;
}

/** Find every YouTube / Loom / video-file reference in the markdown. */
export const extractDocVideos = (markdown: string): RawVideoRef[] => {
  const seen = new Set<string>();
  const videos: RawVideoRef[] = [];

  const urls = markdown.match(URL_PATTERN) ?? [];
  for (const rawUrl of urls) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      continue;
    }
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    let video: RawVideoRef | null = null;

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) {
        video = {
          kind: 'youtube',
          id,
          embedUrl: `https://www.youtube.com/embed/${id}`,
          watchUrl: `https://www.youtube.com/watch?v=${id}`,
        };
      }
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      let id = parsed.searchParams.get('v');
      if (!id) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(parts[0]) && parts[1]) id = parts[1];
      }
      if (id) {
        video = {
          kind: 'youtube',
          id,
          embedUrl: `https://www.youtube.com/embed/${id}`,
          watchUrl: `https://www.youtube.com/watch?v=${id}`,
        };
      }
    } else if (host === 'loom.com' || host.endsWith('.loom.com')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p === 'share' || p === 'embed');
      const id = idx >= 0 ? parts[idx + 1] : undefined;
      if (id) {
        video = {
          kind: 'loom',
          id,
          embedUrl: `https://www.loom.com/embed/${id}`,
        };
      }
    } else if (/\.(mp4|webm|ogg|ogv|mov)(\?.*)?$/i.test(parsed.pathname)) {
      video = { kind: 'file', embedUrl: rawUrl };
    }

    if (video && !seen.has(video.embedUrl)) {
      seen.add(video.embedUrl);
      videos.push(video);
    }
  }

  return videos;
};

interface OEmbedResponse {
  title?: string;
  thumbnail_url?: string;
}

/** oEmbed lookup for a video's public title and thumbnail. */
const fetchVideoOEmbed = async (video: RawVideoRef): Promise<OEmbedResponse | null> => {
  let endpoint: string | null = null;
  if (video.kind === 'youtube' && video.watchUrl) {
    endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(video.watchUrl)}&format=json`;
  } else if (video.kind === 'loom' && video.id) {
    endpoint = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(`https://www.loom.com/share/${video.id}`)}&format=json`;
  }
  if (!endpoint) return null;
  return (await fetchJson(endpoint, 3000)) as OEmbedResponse | null;
};

const MAX_VIDEOS = 4;

const enrichVideos = async (refs: RawVideoRef[], docTitle: string | null): Promise<ServerDocVideo[]> => {
  const capped = refs.slice(0, MAX_VIDEOS);
  const oembeds = await Promise.all(capped.map((ref) => fetchVideoOEmbed(ref)));

  const videos: ServerDocVideo[] = [];
  for (let i = 0; i < capped.length; i++) {
    const ref = capped[i];
    const oembed = oembeds[i];

    // YouTube thumbnails are predictable; Loom and files need oEmbed.
    const thumbnailUrl =
      oembed?.thumbnail_url ||
      (ref.kind === 'youtube' && ref.id ? `https://img.youtube.com/vi/${ref.id}/hqdefault.jpg` : undefined);

    // Without a thumbnail Google will not pick up the VideoObject — skip it.
    if (!thumbnailUrl) continue;

    videos.push({
      kind: ref.kind,
      name: oembed?.title?.trim() || (docTitle ? `${docTitle} — video` : 'Shuffle documentation video'),
      description:
        oembed?.title?.trim() ||
        (docTitle ? `Video walkthrough from the "${docTitle}" Shuffle Security documentation.` : 'Shuffle Security documentation video.'),
      thumbnailUrl,
      embedUrl: ref.embedUrl,
      contentUrl: ref.watchUrl,
    });
  }
  return videos;
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Resolve a URL slug to markdown + metadata. Returns null when the doc does
 * not exist or the API is unreachable (callers then fall back to client fetch).
 */
export const fetchDocContentServer = async (slug: string): Promise<ServerDocContent | null> => {
  const base = getBaseUrl();

  const listData = (await fetchJson(`${base}/api/v1/docs`)) as
    | { success?: boolean; list?: DocsListEntry[] }
    | null;
  const list = Array.isArray(listData?.list)
    ? listData!.list.filter((d): d is { name: string } => typeof d?.name === 'string')
    : [];

  const exact = list.find((d) => docSlug(d.name) === slug.toLowerCase())?.name ?? null;
  const candidates = Array.from(
    new Set([exact, slug, slug.replace(/-/g, '_')].filter(Boolean) as string[]),
  );

  for (const name of candidates) {
    const data = (await fetchJson(`${base}/api/v1/docs/${encodeURIComponent(name)}`)) as
      | { success?: boolean; reason?: string; meta?: ServerDocMeta }
      | null;
    if (data?.success && typeof data.reason === 'string' && data.reason.trim().length > 0) {
      if (isMissingDocBody(data.reason)) continue;

      const markdown = data.reason;
      const meta = data.meta ?? null;
      const title = extractDocTitle(markdown);
      const description = extractDocDescription(markdown);
      const videos = await enrichVideos(extractDocVideos(markdown), title);

      let uploadDate: string | undefined;
      if (meta?.edited) {
        const parsed = new Date(meta.edited);
        if (!Number.isNaN(parsed.getTime())) uploadDate = parsed.toISOString();
      }

      return { markdown, meta, title, description, videos, uploadDate };
    }
  }

  return null;
};
