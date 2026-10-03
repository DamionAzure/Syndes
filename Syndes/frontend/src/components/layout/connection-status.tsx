"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Online or Offline, straight from the browser's connection events. Offline is
 * a normal state, so it is never styled as an error. Nothing renders on the
 * server, where the connection is unknown.
 */
export function ConnectionStatus({ className }: { className?: string }) {
  const online = useSyncExternalStore<boolean | null>(
    subscribe,
    () => navigator.onLine,
    () => null,
  );

  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-2 text-meta text-muted-foreground",
        className,
      )}
    >
      {online === null ? null : (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "size-2",
              online ? "bg-success" : "border border-muted-foreground",
            )}
          />
          {online ? "Online" : "Offline"}
        </>
      )}
    </p>
  );
}
