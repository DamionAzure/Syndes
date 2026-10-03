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
