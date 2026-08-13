import { getApiUrl } from '@/Shuffle-MCPs/api';

export interface RemoteDocEntry {
  name: string;
  contributors?: { name?: string; url?: string; image?: string }[];
  read_time?: number;
  edited?: string;
  link?: string;
}

// Slugs are lowercase/dashed for URLs, but the API name is case sensitive ("AI", "API").
export const docSlug = (name: string) => name.replace(/_+/g, '-').toLowerCase();

let cachedList: RemoteDocEntry[] | null = null;
let inflight: Promise<RemoteDocEntry[]> | null = null;

export const fetchDocsList = async (resetCache = false): Promise<RemoteDocEntry[]> => {
  if (!resetCache && cachedList) return cachedList;
  if (!resetCache && inflight) return inflight;

  const run = (async () => {
    try {
      const res = await fetch(getApiUrl(`/api/v1/docs${resetCache ? '?resetCache=true' : ''}`));
      if (!res.ok) return cachedList ?? [];
      const data = await res.json();
      if (!data?.success || !Array.isArray(data.list)) return cachedList ?? [];
      cachedList = (data.list as RemoteDocEntry[]).filter((d) => d?.name);
      return cachedList;
    } catch {
      return cachedList ?? [];
    } finally {
      inflight = null;
    }
  })();

  inflight = run;
  return run;
};

// Resolve a URL slug to the exact document name the API expects.
export const resolveDocName = async (slug: string, resetCache = false): Promise<string | null> => {
  const list = await fetchDocsList(resetCache);
  const match = list.find((d) => docSlug(d.name) === slug.toLowerCase());
  return match?.name ?? null;
};
