"use client";

import { use, useSyncExternalStore } from "react";
import { useAccess } from "@/components/access/access-provider";
import { canLearn } from "@/lib/access/access";
import { accountScopedKey } from "@/lib/account-scope";
import type { Module as SealedModule, ModuleSummary as PublishedSummary } from "@/lib/types";
import { toLearnerModule, toPublishedSummary } from "./sealed-module-view";
import type { Module, ModuleSummary } from "./module-types";

const MODULES_KEY = "syndes:modules:v1";
const CHANGE_EVENT = "syndes:modules-changed";

export type OpenModuleFileResult =
  | { status: "opened"; moduleId: string }
  | { status: "cancelled" }
  | { status: "unsupported" }
  | { status: "invalid"; message: string };

export interface ModuleSource {
  listModules(): Promise<ModuleSummary[]>;
  getModule(id: string): Promise<Module | null>;
  downloadModule(id: string): Promise<void>;
  openModuleFile(file: File): Promise<OpenModuleFileResult>;
}

type Remote = {
  listModules(): Promise<PublishedSummary[]>;
  getModule(id: string): Promise<SealedModule>;
};
type Native = { load(module: SealedModule, accountId: string): Promise<SealedModule> };

type SourceOptions = {
  accountId: string | null;
  approved: boolean;
  online: boolean;
  storage: Storage;
  remote: Remote;
  native: Native;
};

function validSealed(raw: unknown): raw is SealedModule {
  if (typeof raw !== "object" || raw === null) return false;
  const file = raw as Record<string, unknown>;
  if (file["schema_version"] !== "1.0" || typeof file["module"] !== "object" || file["module"] === null) return false;
  const meta = file["module"] as Record<string, unknown>;
  return typeof meta["id"] === "string" && /^[a-zA-Z0-9_-]+$/.test(meta["id"])
    && typeof meta["title"] === "string" && (meta["type"] === "quiz" || meta["type"] === "lesson");
}

function parseDownloads(raw: string | null): Record<string, SealedModule> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([id, value]) => validSealed(value) && value.module.id === id));
  } catch {
    return {};
  }
}

/** Account and approval are bound when the source is created. */
export function createModuleSource(options: SourceOptions): ModuleSource {
  const { accountId, approved, online, storage, remote, native } = options;
  const permitted = Boolean(accountId && approved);
  const key = accountScopedKey(MODULES_KEY, accountId);
  const local = () => parseDownloads(storage.getItem(key));

  async function save(sealed: SealedModule): Promise<void> {
    if (!permitted || !validSealed(sealed)) throw new Error("The Module file is invalid or access is unavailable.");
    const checked = await native.load(sealed, accountId as string);
    if (!validSealed(checked) || checked.module.id !== sealed.module.id) throw new Error("The Module file is invalid.");
    storage.setItem(key, JSON.stringify({ ...local(), [checked.module.id]: checked }));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return {
    async listModules() {
      if (!permitted) return [];
      const downloaded = Object.values(local()).map((sealed) => toLearnerModule(sealed));
      if (!online) return downloaded;
      try {
        const rows = await remote.listModules();
        const byId = new Map<string, ModuleSummary>(rows.map((row) => [row.id, toPublishedSummary(row)]));
        for (const downloadedModule of downloaded) byId.set(downloadedModule.id, downloadedModule);
        return [...byId.values()];
      } catch {
        return downloaded;
      }
    },
    async getModule(id) {
      if (!permitted) return null;
      const sealed = local()[id];
      if (!sealed) return null;
      const checked = await native.load(sealed, accountId as string);
      return validSealed(checked) && checked.module.id === id ? toLearnerModule(checked) : null;
    },
    async downloadModule(id) {
      if (!permitted || !online) throw new Error("Connect and sign in with an approved Account to save this Module.");
      const sealed = await remote.getModule(id);
      if (sealed.module.id !== id) throw new Error("The published Module did not match the requested Module.");
      await save(sealed);
    },
    async openModuleFile(file) {
      if (!permitted) return { status: "invalid", message: "Your Account needs approval before opening a Module." };
      try {
        const raw: unknown = JSON.parse(await file.text());
        if (!validSealed(raw)) return { status: "invalid", message: "This is not a valid sealed Module file." };
        await save(raw);
        return { status: "opened", moduleId: raw.module.id };
      } catch {
        return { status: "invalid", message: "This Module file could not be opened." };
      }
    },
  };
}

const remote: Remote = {
  async listModules() {
    const store = await import("@/lib/moduleStore");
    return store.listModules();
  },
  async getModule(id) {
    const store = await import("@/lib/moduleStore");
    return store.getModule(id);
  },
};

const native: Native = {
  async load(module, accountId) {
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (!isTauri()) throw new Error("Opening Modules requires the Syndes desktop app.");
    const { mkdir, writeTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const { appLocalDataDir, join } = await import("@tauri-apps/api/path");
    if (!/^[a-zA-Z0-9_-]+$/.test(accountId)) throw new Error("Invalid Account id.");
    const directory = `modules/${accountId}`;
    await mkdir(directory, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    const fileName = `${module.module.id}.json`;
    await writeTextFile(`${directory}/${fileName}`, JSON.stringify(module), { baseDir: BaseDirectory.AppLocalData });
    return invoke<SealedModule>("load_module", { path: await join(await appLocalDataDir(), directory, fileName) });
  },
};

const reads = new Map<string, Promise<unknown>>();
let revision = 0;
const subscribe = (notify: () => void) => {
  const onChange = () => { revision += 1; reads.clear(); notify(); };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};
const getRevision = () => revision;
const getServerRevision = () => 0;

function currentSource(accountId: string | null, approved: boolean): ModuleSource {
  return createModuleSource({
    accountId,
    approved,
    online: typeof navigator !== "undefined" && navigator.onLine,
    storage: window.localStorage,
    remote,
    native,
  });
}

export function useModuleSource(): ModuleSource {
  const state = useAccess();
  return currentSource(state.accountId, canLearn(state.context));
}

function cachedRead<T>(key: string, load: () => Promise<T>): Promise<T> {
  let pending = reads.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = load();
    reads.set(key, pending);
  }
  return pending;
}

export function useModules(): ModuleSummary[] {
  const state = useAccess();
  const changed = useSyncExternalStore(subscribe, getRevision, getServerRevision);
  if (!state.accountId || !canLearn(state.context)) return [];
  const source = currentSource(state.accountId, true);
  return use(cachedRead(`${state.accountId}:modules:${changed}`, () => source.listModules()));
}

export function useModule(id: string | null): Module | null {
  const state = useAccess();
  const changed = useSyncExternalStore(subscribe, getRevision, getServerRevision);
  if (!id || !state.accountId || !canLearn(state.context)) return null;
  const source = currentSource(state.accountId, true);
  return use(cachedRead(`${state.accountId}:module:${id}:${changed}`, () => source.getModule(id)));
}
