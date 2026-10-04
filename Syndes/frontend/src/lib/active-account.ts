/**
 * The process-wide "active Account id" for partitioning account-scoped local
 * stores (ADR 0007). The `AccessProvider` sets it once access resolves; the
 * drafts and progress stores read it to pick their account partition.
 *
 * Why a module-level registry rather than threading the id through every call:
 * the store mutators (`updateProgress`, `editDraft`, …) are called from event
 * handlers all over the app where a React hook cannot run. A single source of
 * truth for "who is signed in right now" lets those call sites stay unchanged
 * while still writing into the correct Account partition.
 *
 * Access decisions do NOT come from here — they come from the Rust core via
 * `resolveAccess`. This id is only ever a storage-partition selector.
 */

let activeAccountId: string | null = null;
const listeners = new Set<() => void>();

/** The current Account id, or null when signed out. */
export function getActiveAccountId(): string | null {
  return activeAccountId;
}

/** Set by the AccessProvider when the signed-in Account changes. */
export function setActiveAccountId(accountId: string | null): void {
  const next = accountId && accountId.length > 0 ? accountId : null;
  if (next === activeAccountId) return;
  activeAccountId = next;
  // Notify store subscribers so a sign-in/out swaps the visible partition.
  for (const listener of listeners) listener();
}

/** Subscribe to active-account changes (used by the account-scoped stores). */
export function subscribeToActiveAccount(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
