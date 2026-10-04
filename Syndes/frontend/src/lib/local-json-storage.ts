/**
 * A JSON value kept in localStorage that React can subscribe to with
 * `useSyncExternalStore`. Stored data is untrusted: every read goes through
 * `parse`, which must return a safe value for anything it does not recognise.
 */
export type StoredValue<T> = {
  get(): T;
  getServerSnapshot(): T;
  set(next: T): void;
  update(change: (current: T) => T): void;
  subscribe(onChange: () => void): () => void;
};

const SAME_TAB_EVENT = "syndes:local-json-storage";

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function createStoredValue<T>(
  key: string,
  parse: (raw: unknown) => T,
  fallback: T,
): StoredValue<T> {
  // Cache by raw string so snapshots stay referentially stable between reads.
  let cachedRaw: string | null | undefined;
  let cachedValue: T = fallback;

  function get(): T {
    if (typeof window === "undefined") return fallback;
    const raw = readRaw(key);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (raw === null) {
      cachedValue = fallback;
    } else {
      try {
        cachedValue = parse(JSON.parse(raw));
      } catch {
        cachedValue = fallback;
      }
    }
    return cachedValue;
  }

  function set(next: T): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage can be full or disabled; the in-memory UI keeps working.
    }
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: key }));
  }

  function subscribe(onChange: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) onChange();
    };
    const onSameTab = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SAME_TAB_EVENT, onSameTab);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SAME_TAB_EVENT, onSameTab);
    };
  }

  return {
    get,
    getServerSnapshot: () => fallback,
    set,
    update: (change) => set(change(get())),
    subscribe,
  };
}

/**
 * A process-wide cache of `StoredValue`s keyed by their storage key, so that
 * account-scoped stores (ADR 0007) can resolve a STABLE instance per key without
 * re-creating subscriptions on every render. `useSyncExternalStore` requires the
 * `subscribe`/`getSnapshot` identities to be stable for a given key, which this
 * guarantees: the same key always returns the same `StoredValue`.
 *
 * `parse` and `fallback` are bound on first creation for a key; callers must use
 * the same parse/fallback for a given base key (the drafts and progress stores
 * each use exactly one), so this is safe.
 */
const storedValueCache = new Map<string, StoredValue<unknown>>();

export function getStoredValue<T>(
  key: string,
  parse: (raw: unknown) => T,
  fallback: T,
): StoredValue<T> {
  const existing = storedValueCache.get(key);
  if (existing) return existing as StoredValue<T>;
  const created = createStoredValue(key, parse, fallback);
  storedValueCache.set(key, created as StoredValue<unknown>);
  return created;
}
