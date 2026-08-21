/**
 * SSR storage shim.
 *
 * This app is a client-first dashboard: many modules read `localStorage` /
 * `sessionStorage` at module scope or during the first render. Under SSR those
 * globals do not exist, which crashes the whole render. Installing an
 * in-memory Storage during SSR keeps every read/write harmless on the server
 * while the browser keeps using the real thing.
 *
 * Imported for its side effect from the server entry, before any app module.
 */

const createMemoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
  } as Storage;
};

const g = globalThis as typeof globalThis & {
  localStorage?: Storage;
  sessionStorage?: Storage;
};

if (typeof window === "undefined") {
  if (!g.localStorage) g.localStorage = createMemoryStorage();
  if (!g.sessionStorage) g.sessionStorage = createMemoryStorage();
}

export {};

/**
 * Always-safe storage accessor. Use this instead of the bare `localStorage`
 * global in modules that can be evaluated or rendered on the server, where the
 * global may not exist at all (Workers runtime).
 */
const memoryFallback = createMemoryStorage();

export const safeLocalStorage: Storage = new Proxy({} as Storage, {
  get(_t, prop) {
    let store: Storage = memoryFallback;
    try {
      if (typeof window !== "undefined" && window.localStorage) store = window.localStorage;
      else if (g.localStorage) store = g.localStorage;
    } catch {
      store = memoryFallback;
    }
    const value = (store as unknown as Record<string, unknown>)[prop as string];
    return typeof value === "function" ? value.bind(store) : value;
  },
});
