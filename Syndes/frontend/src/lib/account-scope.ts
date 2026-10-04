/**
 * Account-scoped localStorage keys (ADR 0007: account-scoped learning data).
 *
 * Each Learner's downloaded Modules, saved answers, Progress, and a Teacher's
 * Drafts belong to that Learner's Account and must be hidden from every other
 * Account on a shared device. We achieve that by partitioning the storage key by
 * Account id.
 *
 * The ORIGINAL device-wide key (e.g. "syndes:progress:v1") is preserved verbatim
 * as the LEGACY bucket. ADR 0007 is explicit: existing device-wide data is NEVER
 * auto-assigned to the first Account that signs in. The legacy bucket is only
 * ever read for an explicit, one-time import an approved Account chooses to run.
 *
 * A signed-out session has no Account; its key uses the SIGNED_OUT sentinel so a
 * signed-out view never reads or writes another Account's partition. (In the MVP
 * a signed-out, unapproved caller cannot study at all — this is defence in depth.)
 */

/** Sentinel partition for "no signed-in Account". */
export const SIGNED_OUT = "signed-out";

/**
 * The account-scoped key for a base store key and an Account id. A null/empty
 * accountId maps to the SIGNED_OUT partition, never to the legacy device-wide key
 * — so no code path silently adopts legacy data by writing into its key.
 */
export function accountScopedKey(baseKey: string, accountId: string | null | undefined): string {
  const account = accountId && accountId.length > 0 ? accountId : SIGNED_OUT;
  return `${baseKey}:acct:${account}`;
}

/**
 * The legacy device-wide key = the base key unchanged. Read-only: it is the
 * source for a one-time import, never a write target once scoping is live.
 */
export function legacyDeviceWideKey(baseKey: string): string {
  return baseKey;
}
