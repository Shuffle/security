/**
 * Demo Mode service.
 *
 * Seeds sample data (incidents, assets, users) into the real Shuffle datastore
 * so users can experience the platform without setting anything up.
 *
 * Cleanup is driven by a localStorage index of every key we wrote, per category.
 * The `metadata.extensions.custom_attributes.demo = true` flag on each item is
 * a safety net for orphans.
 */

import { setDatastoreItems, deleteDatastoreItem, DATASTORE_CATEGORIES, getDatastoreByCategory } from '@/services/datastore';
import { buildDemoIncidents, buildDemoAssets, buildDemoUsers, DEMO_FLAG_KEY, DEMO_ACTIVE_KEY } from '@/lib/demoSeedData';

interface SeededIndex {
  [category: string]: string[]; // category -> list of keys we wrote
}

const readIndex = (): SeededIndex => {
  try {
    return JSON.parse(localStorage.getItem(DEMO_FLAG_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeIndex = (idx: SeededIndex) => {
  localStorage.setItem(DEMO_FLAG_KEY, JSON.stringify(idx));
};

export const isDemoActive = (): boolean => {
  return localStorage.getItem(DEMO_ACTIVE_KEY) === 'true';
};

export const getDemoStats = () => {
  const idx = readIndex();
  return {
    incidents: idx[DATASTORE_CATEGORIES.INCIDENTS]?.length || 0,
    assets: idx[DATASTORE_CATEGORIES.ASSETS]?.length || 0,
    users: idx[DATASTORE_CATEGORIES.USERS]?.length || 0,
  };
};

export interface SeedResult {
  success: boolean;
  counts: { incidents: number; assets: number; users: number };
  error?: string;
}

/**
 * Seed all demo data. Safe to call multiple times — duplicate keys will be
 * overwritten by the backend (set_cache is idempotent on key).
 */
export const seedDemoData = async (): Promise<SeedResult> => {
  const incidents = buildDemoIncidents();
  const assets = buildDemoAssets();
  const users = buildDemoUsers();

  try {
    const [incRes, astRes, usrRes] = await Promise.all([
      setDatastoreItems(incidents, DATASTORE_CATEGORIES.INCIDENTS),
      setDatastoreItems(assets, DATASTORE_CATEGORIES.ASSETS),
      setDatastoreItems(users, DATASTORE_CATEGORIES.USERS),
    ]);

    const idx = readIndex();
    if (incRes.success) idx[DATASTORE_CATEGORIES.INCIDENTS] = [...(idx[DATASTORE_CATEGORIES.INCIDENTS] || []), ...incidents.map(i => i.key)];
    if (astRes.success) idx[DATASTORE_CATEGORIES.ASSETS] = [...(idx[DATASTORE_CATEGORIES.ASSETS] || []), ...assets.map(i => i.key)];
    if (usrRes.success) idx[DATASTORE_CATEGORIES.USERS] = [...(idx[DATASTORE_CATEGORIES.USERS] || []), ...users.map(i => i.key)];
    writeIndex(idx);

    if (incRes.success || astRes.success || usrRes.success) {
      localStorage.setItem(DEMO_ACTIVE_KEY, 'true');
    }

    const allOk = incRes.success && astRes.success && usrRes.success;
    return {
      success: allOk,
      counts: {
        incidents: incRes.success ? incidents.length : 0,
        assets: astRes.success ? assets.length : 0,
        users: usrRes.success ? users.length : 0,
      },
      error: allOk ? undefined : (incRes.error || astRes.error || usrRes.error),
    };
  } catch (err) {
    return {
      success: false,
      counts: { incidents: 0, assets: 0, users: 0 },
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

export interface CleanupResult {
  success: boolean;
  deleted: number;
  failed: number;
}

/**
 * Delete every seeded item.
 *
 * 1. Primary path: iterate the localStorage index of keys we wrote and call
 *    deleteDatastoreItem() for each.
 * 2. Safety net: also scan each category for any item with
 *    metadata.extensions.custom_attributes.demo === true and delete those
 *    (catches items where the local index was lost, e.g. cross-browser).
 */
export const cleanupDemoData = async (): Promise<CleanupResult> => {
  const idx = readIndex();
  let deleted = 0;
  let failed = 0;

  // Pass 1: indexed deletions
  for (const category of Object.keys(idx)) {
    const keys = idx[category] || [];
    const results = await Promise.allSettled(keys.map(k => deleteDatastoreItem(k, category)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.success) deleted++;
      else failed++;
    }
  }

  // Pass 2: scan for orphaned demo: true items
  const safetyCategories = [DATASTORE_CATEGORIES.INCIDENTS, DATASTORE_CATEGORIES.ASSETS, DATASTORE_CATEGORIES.USERS];
  for (const category of safetyCategories) {
    try {
      const res = await getDatastoreByCategory(category);
      if (res.success && res.data) {
        const orphans = res.data.filter(item => {
          try {
            const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            return parsed?.metadata?.extensions?.custom_attributes?.demo === true;
          } catch {
            return false;
          }
        });
        const orphanResults = await Promise.allSettled(
          orphans.map(o => deleteDatastoreItem(o.key, category))
        );
        for (const r of orphanResults) {
          if (r.status === 'fulfilled' && r.value.success) deleted++;
          else failed++;
        }
      }
    } catch {
      // best-effort
    }
  }

  // Clear local index + active flag
  localStorage.removeItem(DEMO_FLAG_KEY);
  localStorage.removeItem(DEMO_ACTIVE_KEY);

  return { success: failed === 0, deleted, failed };
};
