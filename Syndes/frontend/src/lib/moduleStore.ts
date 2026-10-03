// Data-access layer for the online module store (spec: supabase-database).
//
// This module reads and publishes Supabase Modules. Account-scoped downloads
// are owned by features/modules/module-source.ts.

import { supabase } from "./supabase";
import { canTeach } from "./access/access";
import { resolveAccess } from "./access/access-bridge";
import type { ListFilter, Module, ModuleSummary } from "./types";

// Row shape as stored/returned by the `modules` table. Only `data` + `published`
// (+ owner) are ever written by the client; the metadata columns are derived
// server-side by the validation trigger (migration 0002), so they are read-only
// projections here.
interface ModuleRow {
  data: Module;
  owner: string | null;
  published: boolean;
}

type SummaryRow = Omit<ModuleSummary, "published_at"> & { created_at: string };

/**
 * Publish a SEALED module (Req 1.1, 1.3-1.5, 9.1).
 *
 * Accepts ONLY the sealed `Module` type — a DraftModule (plaintext) is a
 * different type and will not type-check as an argument, so a plaintext-carrying
 * draft cannot be passed in. Sealing happened in the Rust core BEFORE this call
 * (client-side; plaintext never crosses the network — Req 12.1, 12.2). The
 * server-side sealed-shape trigger is the backstop and surfaces rejections here.
 */
export async function publishModule(sealed: Module): Promise<void> {
  const access = await resolveAccess(true);
  if (!canTeach(access) || access.source !== "onlineGate") {
    throw new Error("Teacher access must be verified online before publishing.");
  }
  const { data: auth } = await supabase.auth.getUser(); // teacher must be signed in
  if (!auth.user || !("accountId" in access) || access.accountId !== auth.user.id) {
    throw new Error("Teacher access does not match the signed-in Account.");
  }
  const row: ModuleRow = {
    data: sealed,
    owner: auth.user?.id ?? null,
    published: true,
  };
  const { error } = await supabase.from("modules").insert(row);
  if (error) throw error; // trigger rejections (unsealed/plaintext/contract) surface here
}

/**
 * Browse: lightweight summaries of PUBLISHED modules (Req 5.1-5.6).
 * Filtered/sorted server-side; no full module JSON is downloaded.
 */
export async function listModules(filter?: ListFilter): Promise<ModuleSummary[]> {
  let query = supabase
    .from("modules")
    .select("id,title,subject,grade_level,type,question_count,created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (filter?.subject) query = query.eq("subject", filter.subject);
  if (filter?.grade_level) query = query.eq("grade_level", filter.grade_level);
  if (filter?.search) query = query.ilike("title", `%${filter.search}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as SummaryRow[];
  return rows.map(({ created_at, ...rest }) => ({ ...rest, published_at: created_at }));
}

/**
 * Pull step 1 (Req 6.1): fetch the full sealed Module JSON — the source of truth,
 * the exact bytes load_module will consume.
 */
export async function getModule(id: string): Promise<Module> {
  const { data, error } = await supabase
    .from("modules")
    .select("data")
    .eq("id", id)
    .single<{ data: Module }>();
  if (error) throw error;
  return data.data;
}
