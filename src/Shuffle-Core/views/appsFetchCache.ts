/**
 * Shared fetch and module-level memory cache for apps and integrations in Usecases.
 * Coalesces in-flight requests, preserves parsed results across drawer opens/closes,
 * and eliminates layout shifts and loading flashes.
 */

export interface IntegrationItem {
  id: string;
  name: string;
  icon: string;
  /** Validated (tested) — highest priority */
  validated: boolean;
  /** Active auth entry */
  active: boolean;
}

export interface AlluvialCache {
  allApps: any[];
  ingestAppNames: Set<string>;
  forwardAppNames: Set<string>;
  webhookInfo: { url: string | null; exists: boolean; enabled: boolean; workflowId: string | null };
  ts: number;
}

const APPS_TTL_MS = 60_000;
type CacheEntry = { ts: number; promise: Promise<Response> };
const _appsFetchCache = new Map<string, CacheEntry>();

export function fetchAppsCached(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const cached = _appsFetchCache.get(url);
  if (cached && now - cached.ts < APPS_TTL_MS) {
    // Clone so multiple consumers can each read the body.
    return cached.promise.then((res) => res.clone());
  }
  const promise = fetch(url, init);
  _appsFetchCache.set(url, { ts: now, promise });
  return promise.then((res) => res.clone());
}

// Module-level parsed in-memory caches
let _cachedIntegrations: IntegrationItem[] | null = null;
let _cachedCatalogIcons: Record<string, string> = {};
let _cachedCategoryAppNames: Record<string, string[]> | null = null;
let _cachedValidatedAppsByCategory: Record<string, Array<{ name: string; icon: string }>> | null = null;
let _cachedValidatedCategories: Set<string> | null = null;
let _alluvialCache: AlluvialCache | null = null;
export const _algoliaIconCache = new Map<string, string>();

export function getCachedIntegrations(): IntegrationItem[] | null {
  return _cachedIntegrations;
}
export function setCachedIntegrations(items: IntegrationItem[]) {
  _cachedIntegrations = items;
}

export function getCachedCatalogIcons(): Record<string, string> {
  return _cachedCatalogIcons;
}
export function updateCachedCatalogIcons(icons: Record<string, string>) {
  Object.assign(_cachedCatalogIcons, icons);
}

export function getCachedCategoryAppNames(): Record<string, string[]> | null {
  return _cachedCategoryAppNames;
}
export function setCachedCategoryAppNames(val: Record<string, string[]>) {
  _cachedCategoryAppNames = val;
}

export function getCachedValidatedAppsByCategory(): Record<string, Array<{ name: string; icon: string }>> | null {
  return _cachedValidatedAppsByCategory;
}
export function setCachedValidatedAppsByCategory(val: Record<string, Array<{ name: string; icon: string }>>) {
  _cachedValidatedAppsByCategory = val;
}

export function getCachedValidatedCategories(): Set<string> | null {
  return _cachedValidatedCategories;
}
export function setCachedValidatedCategories(val: Set<string>) {
  _cachedValidatedCategories = val;
}

export function getAlluvialCache(): AlluvialCache | null {
  return _alluvialCache;
}
export function setAlluvialCache(cache: AlluvialCache) {
  _alluvialCache = cache;
}
export function updateAlluvialIngest(appName: string, enabled: boolean, normalizeAppName: (n: string) => string) {
  if (!_alluvialCache) return;
  const next = new Set(_alluvialCache.ingestAppNames);
  const norm = normalizeAppName(appName);
  if (enabled) next.add(norm); else next.delete(norm);
  _alluvialCache.ingestAppNames = next;
  _alluvialCache.ts = Date.now();
}
export function updateAlluvialForward(desiredAppNames: string[], normalizeAppName: (n: string) => string) {
  if (!_alluvialCache) return;
  _alluvialCache.forwardAppNames = new Set(desiredAppNames.map(normalizeAppName));
  _alluvialCache.ts = Date.now();
}
export function invalidateAlluvialCache() {
  _alluvialCache = null;
}

export function invalidateAppsCache() {
  _appsFetchCache.clear();
  _cachedIntegrations = null;
  _cachedCatalogIcons = {};
  _cachedCategoryAppNames = null;
  _cachedValidatedAppsByCategory = null;
  _cachedValidatedCategories = null;
  _alluvialCache = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shuffle-apps-invalidated'));
  }
}
