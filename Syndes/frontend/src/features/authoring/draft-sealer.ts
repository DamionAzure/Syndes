import { invoke, isTauri } from "@tauri-apps/api/core";
import { writeTextFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { isModule, readAppError } from "@/lib/bridge";
import type { Module } from "@/lib/types";
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

/**
 * Real sealer: hands the draft to the Rust core and writes the sealed result to
 * local disk the same way lib/moduleStore.ts writes module files (AppLocalData
 * `modules/<id>.json` via @tauri-apps/plugin-fs).
 *
 * The `DraftModuleFile` already matches the Rust `DraftModule` deserializer field
 * for field (src-tauri/src/model.rs): its content keys stay snake_case
 * (`schema_version`, `grade_level`, `hash_algo`, question `answer`, and the
 * `type` key) while the COMMAND arg is the single-word `draft` — no remapping is
 * needed, so the file is passed straight through.
 */
const tauriDraftSealer: DraftSealer = {
  async seal(file: DraftModuleFile): Promise<SealOutcome> {
    if (!isTauri()) return { status: "unsupported" };
    let sealed: unknown;
    try {
      sealed = await invoke<unknown>("seal_module", { draft: file });
    } catch (error) {
      // AppError (e.g. kind:"Forbidden" for a non-teacher, "ValidationError" for
      // a bad draft) surfaces to the seal panel as the invalid message.
      return { status: "invalid", message: readAppError(error).message };
    }

    // IPC payloads are untrusted: confirm the shape before trusting module.id.
    if (!isModule(sealed)) {
      return { status: "invalid", message: "the core returned an unexpected sealed module" };
    }

    const sealedModule: Module = sealed;
    const fileName = `${sealedModule.module.id}.json`;
    try {
      await mkdir("modules", { baseDir: BaseDirectory.AppLocalData, recursive: true });
      await writeTextFile(`modules/${fileName}`, JSON.stringify(sealedModule), {
        baseDir: BaseDirectory.AppLocalData,
      });
    } catch (error) {
      return { status: "invalid", message: readAppError(error).message };
    }

    return { status: "sealed", fileName };
  },
};

/** The one place the active sealer is chosen; the Tauri bridge replaces it here. */
const activeSealer: DraftSealer = isTauri() ? tauriDraftSealer : unavailableSealer;

export function useDraftSealer(): DraftSealer {
  return activeSealer;
}
