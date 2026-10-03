"use client";

import { Suspense, useSyncExternalStore, type ReactNode } from "react";

const noopSubscribe = () => () => {};

/**
 * Wraps views that read device-local data (modules, progress, search params).
 * The static HTML only ever shows `fallback`, so a prerendered page never
 * claims content or progress that the device has not confirmed.
 */
export function LocalDataBoundary({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <Suspense fallback={fallback}>{hydrated ? children : fallback}</Suspense>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <p role="status" className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-muted-foreground">
      {label}
    </p>
  );
}
