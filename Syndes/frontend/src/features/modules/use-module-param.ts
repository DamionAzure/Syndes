import { useSearchParams } from "next/navigation";
import { useModule } from "./module-source";
import type { Module } from "./module-types";

/** The Module named by `?module=`, or null when it is missing or not on this device. */
export function useModuleParam(): Module | null {
  const searchParams = useSearchParams();
  return useModule(searchParams.get("module"));
}

/** A 1-based position param, or null when absent or not a positive integer. */
export function usePositionParam(name: string): number | null {
  const raw = useSearchParams().get(name);
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 ? value : null;
}
