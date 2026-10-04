import { invoke, isTauri } from "@tauri-apps/api/core";
import { isModule, readAppError } from "@/lib/bridge";
import { publishModule } from "@/lib/moduleStore";
import type { DraftModuleFile } from "./module-file";

export type SealOutcome =
  | { status: "published" }
  /** Sealing runs in the Rust core, which this runtime cannot reach. */
  | { status: "unsupported" }
  | { status: "invalid"; message: string };

/**
 * Seals a Draft in the Rust core, then publishes only the sealed Module.
 */
export interface DraftSealer {
  seal(file: DraftModuleFile): Promise<SealOutcome>;
}

const activeSealer: DraftSealer = {
  async seal(file) {
    if (!isTauri()) return { status: "unsupported" };
    try {
      // Native sealing checks Teacher permission online before touching the
      // plaintext Draft. Publishing checks it again at the Supabase boundary.
      const sealed: unknown = await invoke("seal_module", { draft: file });
      if (!isModule(sealed)) {
        return { status: "invalid", message: "The core returned an unexpected sealed module." };
      }
      await publishModule(sealed);
      return { status: "published" };
    } catch (error) {
      return { status: "invalid", message: readAppError(error).message };
    }
  },
};

export function useDraftSealer(): DraftSealer {
  return activeSealer;
}
