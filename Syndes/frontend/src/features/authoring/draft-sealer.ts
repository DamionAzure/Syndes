import { invoke, isTauri } from "@tauri-apps/api/core";
import { publishModule } from "@/lib/moduleStore";
import type { Module } from "@/lib/types";
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
      const sealed = await invoke<Module>("seal_module", { draft: file });
      await publishModule(sealed);
      return { status: "published" };
    } catch (error) {
      return { status: "invalid", message: error instanceof Error ? error.message : String(error) };
    }
  },
};

export function useDraftSealer(): DraftSealer {
  return activeSealer;
}
