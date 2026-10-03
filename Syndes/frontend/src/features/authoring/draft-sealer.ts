import type { DraftModuleFile } from "./module-file";

export type SealOutcome =
  | { status: "sealed"; fileName: string }
  /** Sealing runs in the Rust core, which this runtime cannot reach. */
  | { status: "unsupported" }
  | { status: "invalid"; message: string };

/**
 * Seals a draft into a shareable Module file: plaintext answers become salted
 * hashes in the Rust core (`seal_module`), never in the browser.
 */
export interface DraftSealer {
  seal(file: DraftModuleFile): Promise<SealOutcome>;
}

const unavailableSealer: DraftSealer = {
  seal: async () => ({ status: "unsupported" }),
};

/** The one place the active sealer is chosen; the Tauri bridge replaces it here. */
const activeSealer: DraftSealer = unavailableSealer;

export function useDraftSealer(): DraftSealer {
  return activeSealer;
}
