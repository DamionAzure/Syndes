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

/**
 * A placeholder shaped like a panel of rows, with the label said in words.
 * The bars are decoration; the status text is what assistive tech announces.
 */
export function LoadingState({ label }: { label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
        <p role="status" className="text-meta text-muted-foreground">
          {label}
        </p>
        <span aria-hidden="true" className="skeleton hidden h-9 w-28 rounded-md sm:block" />
      </div>
      <div aria-hidden="true" className="divide-y divide-border">
        {[0.72, 0.56, 0.64].map((width) => (
          <div key={width} className="grid gap-2.5 px-6 py-5">
            <span className="skeleton h-4 rounded-sm" style={{ width: `${width * 100}%` }} />
            <span className="skeleton h-3 rounded-sm" style={{ width: `${width * 70}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
